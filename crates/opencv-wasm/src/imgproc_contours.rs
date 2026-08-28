use std::{collections::VecDeque, error::Error, fmt};

use crate::{
    mat::{Mat, MatDepth, MatError},
    mat_vector::MatVector,
};

pub(crate) const RETR_EXTERNAL: i32 = 0;
pub(crate) const RETR_LIST: i32 = 1;
pub(crate) const CHAIN_APPROX_NONE: i32 = 1;
pub(crate) const CHAIN_APPROX_SIMPLE: i32 = 2;

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) enum FindContoursError {
    EmptySource,
    InvalidMethod(i32),
    InvalidMode(i32),
    Matrix(MatError),
    RequiresSingleChannel,
    UnsupportedDepth(MatDepth),
}

impl fmt::Display for FindContoursError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::EmptySource => formatter.write_str("findContours source must not be empty"),
            Self::InvalidMethod(value) => write!(formatter, "unsupported contour method {value}"),
            Self::InvalidMode(value) => write!(formatter, "unsupported contour mode {value}"),
            Self::Matrix(error) => error.fmt(formatter),
            Self::RequiresSingleChannel => {
                formatter.write_str("findContours requires a single-channel source")
            }
            Self::UnsupportedDepth(depth) => {
                write!(
                    formatter,
                    "findContours source depth {depth:?} is not implemented"
                )
            }
        }
    }
}

impl Error for FindContoursError {
    fn source(&self) -> Option<&(dyn Error + 'static)> {
        match self {
            Self::Matrix(error) => Some(error),
            _ => None,
        }
    }
}

impl From<MatError> for FindContoursError {
    fn from(error: MatError) -> Self {
        Self::Matrix(error)
    }
}

#[allow(clippy::too_many_arguments)]
pub(crate) fn find_contours_into(
    source: &Mat,
    contours: &MatVector,
    hierarchy: &Mat,
    mode: i32,
    method: i32,
    offset_x: i32,
    offset_y: i32,
) -> Result<(), FindContoursError> {
    if source.rows() == 0 || source.columns() == 0 {
        return Err(FindContoursError::EmptySource);
    }
    if source.depth() != MatDepth::U8 {
        return Err(FindContoursError::UnsupportedDepth(source.depth()));
    }
    if source.channels() != 1 {
        return Err(FindContoursError::RequiresSingleChannel);
    }
    if !matches!(mode, RETR_EXTERNAL | RETR_LIST) {
        return Err(FindContoursError::InvalidMode(mode));
    }
    if !matches!(method, CHAIN_APPROX_NONE | CHAIN_APPROX_SIMPLE) {
        return Err(FindContoursError::InvalidMethod(method));
    }

    let input = source.compact_bytes();
    let rows = usize::try_from(source.rows()).expect("WASM rows fit usize");
    let columns = usize::try_from(source.columns()).expect("WASM columns fit usize");
    let mut visited = vec![false; input.len()];
    let mut found = Vec::new();
    for row in 0..rows {
        for column in 0..columns {
            let index = row * columns + column;
            if input[index] == 0 || visited[index] {
                continue;
            }
            mark_component(&input, &mut visited, rows, columns, row, column);
            let mut points = trace_boundary(&input, rows, columns, row, column);
            if method == CHAIN_APPROX_SIMPLE {
                points = simplify_chain(&points);
            }
            let mut bytes = Vec::with_capacity(points.len() * 2 * i32::BITS as usize / 8);
            for (x, y) in points {
                bytes.extend_from_slice(&(x.saturating_add(offset_x)).to_ne_bytes());
                bytes.extend_from_slice(&(y.saturating_add(offset_y)).to_ne_bytes());
            }
            let point_count =
                u32::try_from(bytes.len() / 8).map_err(|_| MatError::BufferSizeOverflow)?;
            found.push(Mat::from_owned_bytes(
                bytes,
                point_count,
                1,
                2,
                MatDepth::I32,
            )?);
        }
    }

    let mut hierarchy_values = Vec::with_capacity(found.len() * 4);
    for index in 0..found.len() {
        let next = if index + 1 < found.len() {
            i32::try_from(index + 1).unwrap_or(-1)
        } else {
            -1
        };
        let previous = if index == 0 {
            -1
        } else {
            i32::try_from(index - 1).unwrap_or(-1)
        };
        hierarchy_values.extend_from_slice(&[next, previous, -1, -1]);
    }
    if hierarchy_values.is_empty() {
        hierarchy.write_output(Vec::new(), 0, 0, 1, MatDepth::U8)?;
    } else {
        let mut hierarchy_bytes = Vec::with_capacity(hierarchy_values.len() * 4);
        for value in hierarchy_values {
            hierarchy_bytes.extend_from_slice(&value.to_ne_bytes());
        }
        hierarchy.write_output(
            hierarchy_bytes,
            1,
            u32::try_from(found.len()).map_err(|_| MatError::BufferSizeOverflow)?,
            4,
            MatDepth::I32,
        )?;
    }
    contours.replace(found);
    Ok(())
}

fn mark_component(
    input: &[u8],
    visited: &mut [bool],
    rows: usize,
    columns: usize,
    start_y: usize,
    start_x: usize,
) {
    let mut queue = VecDeque::from([(start_y, start_x)]);
    visited[start_y * columns + start_x] = true;
    while let Some((row, column)) = queue.pop_front() {
        for y in row.saturating_sub(1)..=(row + 1).min(rows - 1) {
            for x in column.saturating_sub(1)..=(column + 1).min(columns - 1) {
                let index = y * columns + x;
                if input[index] != 0 && !visited[index] {
                    visited[index] = true;
                    queue.push_back((y, x));
                }
            }
        }
    }
}

fn trace_boundary(
    input: &[u8],
    rows: usize,
    columns: usize,
    start_y: usize,
    start_x: usize,
) -> Vec<(i32, i32)> {
    let start = (
        i32::try_from(start_x).expect("column fits i32"),
        i32::try_from(start_y).expect("row fits i32"),
    );
    let mut points = vec![start];
    let mut current = start;
    let mut backtrack = (start.0 - 1, start.1);
    let Some((first, first_backtrack)) = next_boundary(input, rows, columns, current, backtrack)
    else {
        return points;
    };
    current = first;
    backtrack = first_backtrack;
    let maximum_steps = input.len().saturating_mul(8).max(8);
    for _ in 0..maximum_steps {
        if current != start {
            points.push(current);
        }
        let Some((next, next_backtrack)) = next_boundary(input, rows, columns, current, backtrack)
        else {
            break;
        };
        if current == start && next == first {
            break;
        }
        current = next;
        backtrack = next_backtrack;
    }
    points
}

fn next_boundary(
    input: &[u8],
    rows: usize,
    columns: usize,
    current: (i32, i32),
    backtrack: (i32, i32),
) -> Option<((i32, i32), (i32, i32))> {
    const DIRECTIONS: [(i32, i32); 8] = [
        (-1, 0),
        (-1, 1),
        (0, 1),
        (1, 1),
        (1, 0),
        (1, -1),
        (0, -1),
        (-1, -1),
    ];
    let relative = (backtrack.0 - current.0, backtrack.1 - current.1);
    let start_index = DIRECTIONS
        .iter()
        .position(|&direction| direction == relative)
        .unwrap_or(0);
    for scan in 0..8 {
        let direction_index = (start_index + scan) % 8;
        let direction = DIRECTIONS[direction_index];
        let candidate = (current.0 + direction.0, current.1 + direction.1);
        if foreground(input, rows, columns, candidate) {
            let previous = DIRECTIONS[(direction_index + 7) % 8];
            return Some((candidate, (current.0 + previous.0, current.1 + previous.1)));
        }
    }
    None
}

fn foreground(input: &[u8], rows: usize, columns: usize, point: (i32, i32)) -> bool {
    let (Ok(x), Ok(y)) = (usize::try_from(point.0), usize::try_from(point.1)) else {
        return false;
    };
    y < rows && x < columns && input[y * columns + x] != 0
}

fn simplify_chain(points: &[(i32, i32)]) -> Vec<(i32, i32)> {
    if points.len() <= 2 {
        return points.to_vec();
    }
    let mut output = Vec::new();
    for index in 0..points.len() {
        let previous = points[(index + points.len() - 1) % points.len()];
        let current = points[index];
        let next = points[(index + 1) % points.len()];
        let incoming = (
            (current.0 - previous.0).signum(),
            (current.1 - previous.1).signum(),
        );
        let outgoing = ((next.0 - current.0).signum(), (next.1 - current.1).signum());
        if incoming != outgoing {
            output.push(current);
        }
    }
    output
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{mat::mat_from_u8, mat_vector::mat_vector_new};

    #[test]
    fn simple_external_rectangle_matches_browser_point_order() {
        let source = mat_from_u8(
            &[
                0, 0, 0, 0, 0, 0, 255, 255, 255, 0, 0, 255, 255, 255, 0, 0, 255, 255, 255, 0, 0, 0,
                0, 0, 0,
            ],
            5,
            5,
            1,
        )
        .expect("source");
        let contours = mat_vector_new();
        let hierarchy = crate::mat::mat_empty();
        find_contours_into(
            &source,
            &contours,
            &hierarchy,
            RETR_EXTERNAL,
            CHAIN_APPROX_SIMPLE,
            0,
            0,
        )
        .expect("contours");
        assert_eq!(contours.size(), 1);
        let contour = contours.get(0).expect("first contour");
        let points = contour
            .compact_bytes()
            .chunks_exact(4)
            .map(|bytes| i32::from_ne_bytes(bytes.try_into().expect("i32 bytes")))
            .collect::<Vec<_>>();
        assert_eq!(points, [1, 1, 1, 3, 3, 3, 3, 1]);
        let hierarchy_values = hierarchy
            .compact_bytes()
            .chunks_exact(4)
            .map(|bytes| i32::from_ne_bytes(bytes.try_into().expect("i32 bytes")))
            .collect::<Vec<_>>();
        assert_eq!(hierarchy_values, [-1, -1, -1, -1]);
    }
}
