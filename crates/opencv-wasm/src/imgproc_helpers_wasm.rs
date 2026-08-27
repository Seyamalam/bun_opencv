//! Browser WebAssembly bindings for small image-processing helpers.

use std::{error::Error, fmt};

use wasm_bindgen::prelude::*;

use crate::{
    imgproc_helpers::{
        HelperError, Point, Rect, clip_line, ellipse_poly, hanning_window, structuring_element,
    },
    mat::{Mat, MatDepth, MatError},
};

#[derive(Debug)]
enum HelperWasmError {
    UnsupportedWindowDepth(MatDepth),
    Kernel(HelperError),
    Matrix(MatError),
}

impl fmt::Display for HelperWasmError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::UnsupportedWindowDepth(depth) => write!(
                formatter,
                "Hanning window depth must be F32 or F64; received {depth:?}"
            ),
            Self::Kernel(error) => error.fmt(formatter),
            Self::Matrix(error) => error.fmt(formatter),
        }
    }
}

impl Error for HelperWasmError {
    fn source(&self) -> Option<&(dyn Error + 'static)> {
        match self {
            Self::Kernel(error) => Some(error),
            Self::Matrix(error) => Some(error),
            Self::UnsupportedWindowDepth(_) => None,
        }
    }
}

impl From<HelperError> for HelperWasmError {
    fn from(error: HelperError) -> Self {
        Self::Kernel(error)
    }
}

impl From<MatError> for HelperWasmError {
    fn from(error: MatError) -> Self {
        Self::Matrix(error)
    }
}

/// Creates a single-channel U8 structuring kernel.
///
/// Supported shape codes are 0 for rectangle, 1 for cross, 2 for ellipse, and 3 for diamond. An anchor
/// coordinate of -1 selects that dimension's center. The anchor changes the cross intersection;
/// rectangle and ellipse geometry remain centered. This partial binding accepts positive kernel
/// dimensions whose compact U8 result fits the WASM matrix limit.
///
/// # Errors
///
/// Returns an error for an unsupported shape, empty size, invalid anchor, or size overflow.
#[wasm_bindgen(js_name = getStructuringElement)]
pub fn get_structuring_element(
    shape: i32,
    columns: u32,
    rows: u32,
    anchor_x: i32,
    anchor_y: i32,
) -> Result<Mat, JsError> {
    let element = structuring_element(shape, columns, rows, anchor_x, anchor_y)
        .map_err(HelperWasmError::from)?;
    Mat::from_owned_bytes(
        element.bytes,
        element.rows,
        element.columns,
        1,
        MatDepth::U8,
    )
    .map_err(HelperWasmError::from)
    .map_err(JsError::from)
}

/// Creates a two-dimensional Hanning window with F32 or F64 elements.
///
/// The result is the outer product of the non-negative sine weights that are the square roots of
/// the one-dimensional Hann coefficients. Both dimensions must be at least two. This partial
/// binding supports only F32 and F64 output and caps allocation at the conservative F64 WASM
/// matrix limit.
///
/// # Errors
///
/// Returns an error for dimensions below two, another depth, or size overflow.
#[wasm_bindgen(js_name = createHanningWindow)]
pub fn create_hanning_window(columns: u32, rows: u32, depth: MatDepth) -> Result<Mat, JsError> {
    create_hanning_window_mat(columns, rows, depth).map_err(JsError::from)
}

fn create_hanning_window_mat(
    columns: u32,
    rows: u32,
    depth: MatDepth,
) -> Result<Mat, HelperWasmError> {
    if !matches!(depth, MatDepth::F32 | MatDepth::F64) {
        return Err(HelperWasmError::UnsupportedWindowDepth(depth));
    }
    let values = hanning_window(columns, rows)?;
    let mut bytes = Vec::with_capacity(values.len() * depth.byte_width());
    match depth {
        MatDepth::F32 => {
            for value in values {
                bytes.extend_from_slice(&narrow_window_value(value).to_ne_bytes());
            }
        }
        MatDepth::F64 => {
            for value in values {
                bytes.extend_from_slice(&value.to_ne_bytes());
            }
        }
        _ => unreachable!("window depth was validated"),
    }
    Mat::from_owned_bytes(bytes, rows, columns, 1, depth).map_err(HelperWasmError::from)
}

#[allow(clippy::cast_possible_truncation)]
fn narrow_window_value(value: f64) -> f32 {
    value as f32
}

/// Samples an integer polyline along a rotated ellipse arc.
///
/// The returned `Int32Array` stores interleaved x and y coordinates. Axes must be non-negative,
/// arc bounds must satisfy `0 <= start <= end <= 360`, and the angular step must be in 1 through
/// 180. The exact end angle is always sampled. Consecutive points that round to the same integer
/// coordinate are collapsed. This partial binding does not normalize or swap arc bounds.
///
/// # Errors
///
/// Returns an error for invalid axes, arc bounds, angular step, or generated coordinate overflow.
#[wasm_bindgen(js_name = ellipse2Poly)]
#[allow(clippy::too_many_arguments)]
pub fn ellipse_2_poly(
    center_x: i32,
    center_y: i32,
    axis_x: i32,
    axis_y: i32,
    rotation_degrees: i32,
    arc_start: i32,
    arc_end: i32,
    delta: i32,
) -> Result<Vec<i32>, JsError> {
    let points = ellipse_poly(
        Point {
            x: center_x,
            y: center_y,
        },
        axis_x,
        axis_y,
        rotation_degrees,
        arc_start,
        arc_end,
        delta,
    )
    .map_err(HelperWasmError::from)?;
    Ok(flatten_points(&points))
}

/// Clips a line segment to the inclusive pixel bounds of an integer rectangle.
///
/// A visible segment returns `[x1, y1, x2, y2]`; a disjoint segment returns an empty
/// `Int32Array`. Width and height must be positive, and the inclusive right and bottom edges must
/// fit signed 32-bit coordinates. This partial binding returns coordinates rather than mutating
/// caller-owned point objects.
///
/// # Errors
///
/// Returns an error for an empty rectangle or a rectangle edge outside the signed 32-bit range.
#[wasm_bindgen(js_name = clipLine)]
#[allow(clippy::too_many_arguments)]
pub fn clip_line_rect(
    rectangle_x: i32,
    rectangle_y: i32,
    rectangle_width: u32,
    rectangle_height: u32,
    start_x: i32,
    start_y: i32,
    end_x: i32,
    end_y: i32,
) -> Result<Vec<i32>, JsError> {
    let clipped = clip_line(
        Rect {
            x: rectangle_x,
            y: rectangle_y,
            width: rectangle_width,
            height: rectangle_height,
        },
        Point {
            x: start_x,
            y: start_y,
        },
        Point { x: end_x, y: end_y },
    )
    .map_err(HelperWasmError::from)?;
    Ok(clipped.map_or_else(Vec::new, |(start, end)| {
        vec![start.x, start.y, end.x, end.y]
    }))
}

fn flatten_points(points: &[Point]) -> Vec<i32> {
    let mut output = Vec::with_capacity(points.len() * 2);
    for point in points {
        output.extend_from_slice(&[point.x, point.y]);
    }
    output
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn browser_adapters_return_typed_matrices_and_flat_point_arrays() {
        let kernel = get_structuring_element(1, 3, 3, 1, 1).expect("valid kernel");
        assert_eq!(kernel.depth(), MatDepth::U8);
        assert_eq!(kernel.to_u8_array(), [0, 1, 0, 1, 1, 1, 0, 1, 0]);

        let window = create_hanning_window(3, 3, MatDepth::F32).expect("valid window");
        assert_eq!(
            window.to_f32_array().expect("F32 output"),
            [0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0]
        );
        let window_f64 = create_hanning_window(3, 3, MatDepth::F64).expect("valid window");
        assert_eq!(
            window_f64.to_f64_array().expect("F64 output"),
            [0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0]
        );

        assert_eq!(
            ellipse_2_poly(0, 0, 10, 5, 0, 0, 90, 90).expect("valid arc"),
            [10, 0, 0, 5]
        );
        assert_eq!(
            clip_line_rect(10, 20, 5, 4, 8, 21, 16, 21).expect("valid clip"),
            [10, 21, 14, 21]
        );
    }
}
