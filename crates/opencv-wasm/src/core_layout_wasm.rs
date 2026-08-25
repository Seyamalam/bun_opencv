//! Matrix-aware WebAssembly adapters for depth-agnostic layout kernels.

use std::{error::Error, fmt};

use wasm_bindgen::prelude::*;

use crate::{
    core_layout::{
        ByteMatrix, LayoutError, MatLayout, OwnedByteMatrix, flip_bytes, repeat_bytes,
        rotate_bytes, transpose_bytes,
    },
    mat::{Mat, MatError},
};

#[derive(Debug, Clone, PartialEq, Eq)]
enum LayoutWasmError {
    ElementWidthOverflow(usize),
    Kernel(LayoutError),
    Matrix(MatError),
}

impl fmt::Display for LayoutWasmError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::ElementWidthOverflow(width) => {
                write!(
                    formatter,
                    "matrix scalar width {width} exceeds the layout limit"
                )
            }
            Self::Kernel(error) => error.fmt(formatter),
            Self::Matrix(error) => error.fmt(formatter),
        }
    }
}

impl Error for LayoutWasmError {
    fn source(&self) -> Option<&(dyn Error + 'static)> {
        match self {
            Self::Kernel(error) => Some(error),
            Self::Matrix(error) => Some(error),
            Self::ElementWidthOverflow(_) => None,
        }
    }
}

impl From<LayoutError> for LayoutWasmError {
    fn from(error: LayoutError) -> Self {
        Self::Kernel(error)
    }
}

impl From<MatError> for LayoutWasmError {
    fn from(error: MatError) -> Self {
        Self::Matrix(error)
    }
}

/// Flips a matrix vertically, horizontally, or across both axes.
///
/// The accepted codes match `OpenCV`: `0` flips rows, `1` flips columns, and `-1` flips both.
///
/// # Errors
///
/// Returns an error when `flip_code` is not `-1`, `0`, or `1`, or when the output cannot be
/// allocated.
#[wasm_bindgen(js_name = matFlip)]
pub fn mat_flip(source: &Mat, flip_code: i32) -> Result<Mat, JsError> {
    apply_layout(source, |matrix| flip_bytes(matrix, flip_code)).map_err(JsError::from)
}

/// Transposes a matrix while preserving its scalar depth and interleaved channels.
///
/// # Errors
///
/// Returns an error when the output shape or allocation exceeds the WASM matrix limit.
#[wasm_bindgen(js_name = matTranspose)]
pub fn mat_transpose(source: &Mat) -> Result<Mat, JsError> {
    apply_layout(source, transpose_bytes).map_err(JsError::from)
}

/// Rotates a matrix by 90 degrees clockwise, 180 degrees, or 90 degrees counterclockwise.
///
/// The accepted codes match `OpenCV`: `0`, `1`, and `2`, respectively.
///
/// # Errors
///
/// Returns an error when `rotate_code` is outside `0..=2`, or when the output cannot be
/// allocated.
#[wasm_bindgen(js_name = matRotate)]
pub fn mat_rotate(source: &Mat, rotate_code: i32) -> Result<Mat, JsError> {
    apply_layout(source, |matrix| rotate_bytes(matrix, rotate_code)).map_err(JsError::from)
}

/// Tiles a matrix by positive row and column repeat counts.
///
/// # Errors
///
/// Returns an error when either count is not positive or the repeated shape exceeds the WASM
/// matrix limit.
#[wasm_bindgen(js_name = matRepeat)]
pub fn mat_repeat(source: &Mat, row_repeats: i32, column_repeats: i32) -> Result<Mat, JsError> {
    apply_layout(source, |matrix| {
        repeat_bytes(matrix, row_repeats, column_repeats)
    })
    .map_err(JsError::from)
}

fn apply_layout(
    source: &Mat,
    kernel: impl FnOnce(ByteMatrix<'_>) -> Result<OwnedByteMatrix, LayoutError>,
) -> Result<Mat, LayoutWasmError> {
    let bytes = source.compact_bytes();
    let element_width = u8::try_from(source.depth().byte_width())
        .map_err(|_| LayoutWasmError::ElementWidthOverflow(source.depth().byte_width()))?;
    let layout = MatLayout::new(
        source.rows(),
        source.columns(),
        source.channels(),
        element_width,
    )?;
    let output = kernel(ByteMatrix::new(&bytes, layout)?)?;
    let (bytes, layout) = output.into_parts();
    Mat::from_owned_bytes(
        bytes,
        layout.rows(),
        layout.columns(),
        layout.channels(),
        source.depth(),
    )
    .map_err(LayoutWasmError::from)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::mat::MatDepth;

    fn u8_matrix(bytes: Vec<u8>, rows: u32, columns: u32, channels: u16) -> Mat {
        Mat::from_owned_bytes(bytes, rows, columns, channels, MatDepth::U8)
            .expect("valid U8 test matrix")
    }

    #[test]
    fn transpose_preserves_metadata_and_compacts_a_strided_region() {
        let parent = u8_matrix((1..=18).collect(), 3, 3, 2);
        let region = parent.roi(0, 1, 3, 2).expect("valid strided region");
        assert!(!region.is_continuous());

        let output = apply_layout(&region, transpose_bytes).expect("transpose region");

        assert_eq!(output.rows(), 2);
        assert_eq!(output.columns(), 3);
        assert_eq!(output.channels(), 2);
        assert_eq!(output.depth(), MatDepth::U8);
        assert!(output.is_continuous());
        assert_eq!(
            output.to_u8_array(),
            [3, 4, 9, 10, 15, 16, 5, 6, 11, 12, 17, 18]
        );
    }

    #[test]
    fn flip_keeps_f64_scalar_bytes_together() {
        let values = [1.25_f64, -2.5, 3.75, 4.5];
        let bytes = values
            .into_iter()
            .flat_map(f64::to_ne_bytes)
            .collect::<Vec<_>>();
        let source =
            Mat::from_owned_bytes(bytes, 2, 2, 1, MatDepth::F64).expect("valid F64 test matrix");

        let output =
            apply_layout(&source, |matrix| flip_bytes(matrix, 1)).expect("horizontal flip");

        assert_eq!(output.depth(), MatDepth::F64);
        assert_eq!(output.channels(), 1);
        assert_eq!(
            output.to_f64_array().expect("F64 output"),
            [-2.5, 1.25, 4.5, 3.75]
        );
    }

    #[test]
    fn every_scalar_depth_passes_through_the_adapter() {
        let depths = [
            MatDepth::U8,
            MatDepth::I8,
            MatDepth::U16,
            MatDepth::I16,
            MatDepth::I32,
            MatDepth::F32,
            MatDepth::F64,
        ];

        for depth in depths {
            let width = depth.byte_width();
            let bytes = (0..width * 2)
                .map(|index| u8::try_from(index + 1).expect("test element fits in U8"))
                .collect::<Vec<_>>();
            let source = Mat::from_owned_bytes(bytes.clone(), 1, 2, 1, depth)
                .expect("valid matrix for scalar depth");

            let output = apply_layout(&source, |matrix| flip_bytes(matrix, 1))
                .expect("layout adapter accepts scalar depth");
            let mut expected = bytes[width..].to_vec();
            expected.extend_from_slice(&bytes[..width]);

            assert_eq!(output.depth(), depth);
            assert_eq!(output.to_u8_array(), expected);
        }
    }

    #[test]
    fn rotate_and_repeat_return_expected_shapes() {
        let source = u8_matrix(vec![1, 2, 3, 4, 5, 6], 2, 3, 1);

        let rotated =
            apply_layout(&source, |matrix| rotate_bytes(matrix, 0)).expect("clockwise rotation");
        assert_eq!((rotated.rows(), rotated.columns()), (3, 2));
        assert_eq!(rotated.to_u8_array(), [4, 1, 5, 2, 6, 3]);

        let repeated =
            apply_layout(&source, |matrix| repeat_bytes(matrix, 2, 1)).expect("row repeat");
        assert_eq!((repeated.rows(), repeated.columns()), (4, 3));
        assert_eq!(repeated.to_u8_array(), [1, 2, 3, 4, 5, 6, 1, 2, 3, 4, 5, 6]);
    }

    #[test]
    fn adapters_reject_invalid_codes_and_repeat_counts() {
        let source = u8_matrix(vec![1], 1, 1, 1);

        assert!(matches!(
            apply_layout(&source, |matrix| flip_bytes(matrix, 7)),
            Err(LayoutWasmError::Kernel(LayoutError::InvalidFlipCode(7)))
        ));
        assert!(matches!(
            apply_layout(&source, |matrix| rotate_bytes(matrix, -1)),
            Err(LayoutWasmError::Kernel(LayoutError::InvalidRotateCode(-1)))
        ));
        assert!(matches!(
            apply_layout(&source, |matrix| repeat_bytes(matrix, 0, 2)),
            Err(LayoutWasmError::Kernel(LayoutError::InvalidRepeatCount {
                rows: 0,
                columns: 2
            }))
        ));
    }
}
