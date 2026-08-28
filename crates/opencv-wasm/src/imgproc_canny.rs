use std::{collections::VecDeque, error::Error, fmt};

use crate::{
    imgproc_border::{BORDER_REFLECT_101, border_index},
    mat::{Mat, MatDepth, MatError},
};

#[derive(Debug, Clone, PartialEq)]
pub(crate) enum CannyError {
    EmptySource,
    InvalidAperture(i32),
    Matrix(MatError),
    RequiresSingleChannel,
    UnsupportedDepth(MatDepth),
}

impl fmt::Display for CannyError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::EmptySource => formatter.write_str("Canny source must not be empty"),
            Self::InvalidAperture(value) => {
                write!(formatter, "Canny aperture size {value} is not implemented")
            }
            Self::Matrix(error) => error.fmt(formatter),
            Self::RequiresSingleChannel => {
                formatter.write_str("Canny requires a single-channel source")
            }
            Self::UnsupportedDepth(depth) => {
                write!(formatter, "Canny source depth {depth:?} is not implemented")
            }
        }
    }
}

impl Error for CannyError {
    fn source(&self) -> Option<&(dyn Error + 'static)> {
        match self {
            Self::Matrix(error) => Some(error),
            _ => None,
        }
    }
}

impl From<MatError> for CannyError {
    fn from(error: MatError) -> Self {
        Self::Matrix(error)
    }
}

pub(crate) fn canny_into(
    source: &Mat,
    destination: &Mat,
    threshold_1: f64,
    threshold_2: f64,
    aperture_size: i32,
    l2_gradient: bool,
) -> Result<(), CannyError> {
    if source.rows() == 0 || source.columns() == 0 {
        return Err(CannyError::EmptySource);
    }
    if source.depth() != MatDepth::U8 {
        return Err(CannyError::UnsupportedDepth(source.depth()));
    }
    if source.channels() != 1 {
        return Err(CannyError::RequiresSingleChannel);
    }
    if aperture_size != 3 {
        return Err(CannyError::InvalidAperture(aperture_size));
    }

    let input = source.compact_bytes();
    let rows = usize::try_from(source.rows()).expect("WASM rows fit usize");
    let columns = usize::try_from(source.columns()).expect("WASM columns fit usize");
    let mut x_gradient = vec![0_i32; input.len()];
    let mut y_gradient = vec![0_i32; input.len()];
    let smooth = [1_i32, 2, 1];
    let derivative = [-1_i32, 0, 1];
    for row in 0..rows {
        for column in 0..columns {
            let mut x_value = 0_i32;
            let mut y_value = 0_i32;
            for kernel_y in 0..3 {
                let source_y = mapped_index(row, kernel_y, source.rows());
                for kernel_x in 0..3 {
                    let source_x = mapped_index(column, kernel_x, source.columns());
                    let value = i32::from(input[source_y * columns + source_x]);
                    x_value += value * smooth[kernel_y] * derivative[kernel_x];
                    y_value += value * derivative[kernel_y] * smooth[kernel_x];
                }
            }
            x_gradient[row * columns + column] = x_value;
            y_gradient[row * columns + column] = y_value;
        }
    }

    let magnitude = x_gradient
        .iter()
        .zip(&y_gradient)
        .map(|(&x, &y)| {
            if l2_gradient {
                f64::from(x * x + y * y).sqrt()
            } else {
                f64::from(x.abs() + y.abs())
            }
        })
        .collect::<Vec<_>>();
    let mut suppressed = vec![0.0; magnitude.len()];
    for row in 0..rows {
        for column in 0..columns {
            let index = row * columns + column;
            let (first, second) = gradient_neighbors(
                row,
                column,
                rows,
                columns,
                x_gradient[index],
                y_gradient[index],
            );
            let current = magnitude[index];
            if current > magnitude[first] && current >= magnitude[second] {
                suppressed[index] = current;
            }
        }
    }

    let low = threshold_1.min(threshold_2);
    let high = threshold_1.max(threshold_2);
    let mut state = vec![0_u8; suppressed.len()];
    let mut queue = VecDeque::new();
    for (index, &value) in suppressed.iter().enumerate() {
        if value > high {
            state[index] = 2;
            queue.push_back(index);
        } else if value > low {
            state[index] = 1;
        }
    }
    while let Some(index) = queue.pop_front() {
        let row = index / columns;
        let column = index % columns;
        for neighbor_y in row.saturating_sub(1)..=(row + 1).min(rows - 1) {
            for neighbor_x in column.saturating_sub(1)..=(column + 1).min(columns - 1) {
                let neighbor = neighbor_y * columns + neighbor_x;
                if state[neighbor] == 1 {
                    state[neighbor] = 2;
                    queue.push_back(neighbor);
                }
            }
        }
    }
    let output = state
        .into_iter()
        .map(|value| if value == 2 { 255 } else { 0 })
        .collect();
    destination.write_output(output, source.rows(), source.columns(), 1, MatDepth::U8)?;
    Ok(())
}

fn mapped_index(position: usize, kernel: usize, length: u32) -> usize {
    let index = i64::try_from(position).expect("position fits i64")
        + i64::try_from(kernel).expect("kernel index fits i64")
        - 1;
    usize::try_from(
        border_index(index, length, BORDER_REFLECT_101)
            .expect("reflect border always maps an index"),
    )
    .expect("mapped position fits usize")
}

#[allow(clippy::too_many_arguments)]
fn gradient_neighbors(
    row: usize,
    column: usize,
    rows: usize,
    columns: usize,
    x_gradient: i32,
    y_gradient: i32,
) -> (usize, usize) {
    let absolute_x = x_gradient.abs();
    let absolute_y = y_gradient.abs();
    let at = |y: isize, x: isize| {
        usize::try_from(y.clamp(0, isize::try_from(rows - 1).expect("rows fit isize")))
            .expect("clamped row is nonnegative")
            * columns
            + usize::try_from(x.clamp(0, isize::try_from(columns - 1).expect("columns fit isize")))
                .expect("clamped column is nonnegative")
    };
    let row = isize::try_from(row).expect("row fits isize");
    let column = isize::try_from(column).expect("column fits isize");
    if absolute_y * 1000 <= absolute_x * 414 {
        (at(row, column - 1), at(row, column + 1))
    } else if absolute_x * 1000 <= absolute_y * 414 {
        (at(row - 1, column), at(row + 1, column))
    } else if x_gradient.signum() == y_gradient.signum() {
        (at(row - 1, column - 1), at(row + 1, column + 1))
    } else {
        (at(row + 1, column - 1), at(row - 1, column + 1))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::mat::{mat_empty, mat_from_u8};

    #[test]
    fn vertical_step_produces_one_pixel_edge() {
        let source = mat_from_u8(
            &[
                0, 0, 255, 255, 255, 0, 0, 255, 255, 255, 0, 0, 255, 255, 255, 0, 0, 255, 255, 255,
                0, 0, 255, 255, 255,
            ],
            5,
            5,
            1,
        )
        .expect("source");
        let destination = mat_empty();
        canny_into(&source, &destination, 50.0, 100.0, 3, false).expect("Canny");
        assert_eq!(
            destination.compact_bytes(),
            [
                0, 255, 0, 0, 0, 0, 255, 0, 0, 0, 0, 255, 0, 0, 0, 0, 255, 0, 0, 0, 0, 255, 0, 0,
                0,
            ]
        );
    }
}
