//! Matrix-aware WebAssembly adapters for depth-agnostic layout kernels.

use std::{error::Error, fmt};

use wasm_bindgen::prelude::*;

use crate::{
    core_layout::{
        ByteMatrix, LayoutError, MatLayout, OwnedByteMatrix, flip_bytes, hconcat_bytes,
        repeat_bytes, rotate_bytes, transpose_bytes, vconcat_bytes,
    },
    mat::{Mat, MatDepth, MatError},
};

#[derive(Debug, Clone, PartialEq, Eq)]
enum LayoutWasmError {
    IncompatibleSourceDepth {
        index: usize,
        expected: MatDepth,
        actual: MatDepth,
    },
    ElementWidthOverflow(usize),
    Kernel(LayoutError),
    Matrix(MatError),
}

impl fmt::Display for LayoutWasmError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::IncompatibleSourceDepth {
                index,
                expected,
                actual,
            } => write!(
                formatter,
                "source matrix {index} has depth {actual:?}; expected {expected:?}"
            ),
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
            Self::ElementWidthOverflow(_) | Self::IncompatibleSourceDepth { .. } => None,
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

/// Flips a matrix into a caller-provided destination.
///
/// # Errors
///
/// Returns an error for an invalid flip code or an incompatible ROI destination.
#[wasm_bindgen(js_name = matFlipInto)]
pub fn mat_flip_into(source: &Mat, destination: &Mat, flip_code: i32) -> Result<(), JsError> {
    apply_layout_into(source, destination, |matrix| flip_bytes(matrix, flip_code))
        .map_err(JsError::from)
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

/// Transposes a matrix into a caller-provided destination.
///
/// # Errors
///
/// Returns an error when an ROI destination does not match the transposed output.
#[wasm_bindgen(js_name = matTransposeInto)]
pub fn mat_transpose_into(source: &Mat, destination: &Mat) -> Result<(), JsError> {
    apply_layout_into(source, destination, transpose_bytes).map_err(JsError::from)
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

/// Rotates a matrix into a caller-provided destination.
///
/// # Errors
///
/// Returns an error for an invalid rotation code or an incompatible ROI destination.
#[wasm_bindgen(js_name = matRotateInto)]
pub fn mat_rotate_into(source: &Mat, destination: &Mat, rotate_code: i32) -> Result<(), JsError> {
    apply_layout_into(source, destination, |matrix| {
        rotate_bytes(matrix, rotate_code)
    })
    .map_err(JsError::from)
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

/// Repeats a matrix into a caller-provided destination.
///
/// # Errors
///
/// Returns an error for invalid repeat counts or an incompatible ROI destination.
#[wasm_bindgen(js_name = matRepeatInto)]
pub fn mat_repeat_into(
    source: &Mat,
    destination: &Mat,
    row_repeats: i32,
    column_repeats: i32,
) -> Result<(), JsError> {
    apply_layout_into(source, destination, |matrix| {
        repeat_bytes(matrix, row_repeats, column_repeats)
    })
    .map_err(JsError::from)
}

/// Horizontally concatenates two matrices with identical rows, channels, and depth.
///
/// # Errors
///
/// Returns an error when source metadata is incompatible or the output cannot be allocated.
#[wasm_bindgen(js_name = matHconcat2)]
pub fn mat_hconcat2(first: &Mat, second: &Mat) -> Result<Mat, JsError> {
    apply_concat(&[first, second], hconcat_bytes).map_err(JsError::from)
}

/// Horizontally concatenates three compatible matrices.
///
/// # Errors
///
/// Returns an error when source metadata is incompatible or the output cannot be allocated.
#[wasm_bindgen(js_name = matHconcat3)]
pub fn mat_hconcat3(first: &Mat, second: &Mat, third: &Mat) -> Result<Mat, JsError> {
    apply_concat(&[first, second, third], hconcat_bytes).map_err(JsError::from)
}

/// Horizontally concatenates four compatible matrices.
///
/// # Errors
///
/// Returns an error when source metadata is incompatible or the output cannot be allocated.
#[wasm_bindgen(js_name = matHconcat4)]
pub fn mat_hconcat4(first: &Mat, second: &Mat, third: &Mat, fourth: &Mat) -> Result<Mat, JsError> {
    apply_concat(&[first, second, third, fourth], hconcat_bytes).map_err(JsError::from)
}

/// Vertically concatenates two matrices with identical columns, channels, and depth.
///
/// # Errors
///
/// Returns an error when source metadata is incompatible or the output cannot be allocated.
#[wasm_bindgen(js_name = matVconcat2)]
pub fn mat_vconcat2(first: &Mat, second: &Mat) -> Result<Mat, JsError> {
    apply_concat(&[first, second], vconcat_bytes).map_err(JsError::from)
}

/// Vertically concatenates three compatible matrices.
///
/// # Errors
///
/// Returns an error when source metadata is incompatible or the output cannot be allocated.
#[wasm_bindgen(js_name = matVconcat3)]
pub fn mat_vconcat3(first: &Mat, second: &Mat, third: &Mat) -> Result<Mat, JsError> {
    apply_concat(&[first, second, third], vconcat_bytes).map_err(JsError::from)
}

/// Vertically concatenates four compatible matrices.
///
/// # Errors
///
/// Returns an error when source metadata is incompatible or the output cannot be allocated.
#[wasm_bindgen(js_name = matVconcat4)]
pub fn mat_vconcat4(first: &Mat, second: &Mat, third: &Mat, fourth: &Mat) -> Result<Mat, JsError> {
    apply_concat(&[first, second, third, fourth], vconcat_bytes).map_err(JsError::from)
}

fn apply_concat(
    sources: &[&Mat],
    kernel: impl FnOnce(&[ByteMatrix<'_>]) -> Result<OwnedByteMatrix, LayoutError>,
) -> Result<Mat, LayoutWasmError> {
    let depth = sources
        .first()
        .expect("fixed-arity concat adapters always provide sources")
        .depth();
    for (index, source) in sources.iter().enumerate().skip(1) {
        if source.depth() != depth {
            return Err(LayoutWasmError::IncompatibleSourceDepth {
                index,
                expected: depth,
                actual: source.depth(),
            });
        }
    }

    let element_width = u8::try_from(depth.byte_width())
        .map_err(|_| LayoutWasmError::ElementWidthOverflow(depth.byte_width()))?;
    let snapshots = sources
        .iter()
        .map(|source| source.compact_bytes())
        .collect::<Vec<_>>();
    let layouts = sources
        .iter()
        .map(|source| {
            MatLayout::new(
                source.rows(),
                source.columns(),
                source.channels(),
                element_width,
            )
        })
        .collect::<Result<Vec<_>, _>>()?;
    let matrices = snapshots
        .iter()
        .zip(layouts)
        .map(|(bytes, layout)| ByteMatrix::new(bytes, layout))
        .collect::<Result<Vec<_>, _>>()?;
    let output = kernel(&matrices)?;
    let (bytes, layout) = output.into_parts();
    Mat::from_owned_bytes(
        bytes,
        layout.rows(),
        layout.columns(),
        layout.channels(),
        depth,
    )
    .map_err(LayoutWasmError::from)
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

fn apply_layout_into(
    source: &Mat,
    destination: &Mat,
    kernel: impl FnOnce(ByteMatrix<'_>) -> Result<OwnedByteMatrix, LayoutError>,
) -> Result<(), LayoutWasmError> {
    // Snapshot and compute before inspecting or writing the destination. This makes overlapping
    // source and destination regions, including exact in-place operations, deterministic.
    let bytes = source.compact_bytes();
    let element_width = u8::try_from(source.depth().byte_width())
        .map_err(|_| LayoutWasmError::ElementWidthOverflow(source.depth().byte_width()))?;
    let source_layout = MatLayout::new(
        source.rows(),
        source.columns(),
        source.channels(),
        element_width,
    )?;
    let output = kernel(ByteMatrix::new(&bytes, source_layout)?)?;
    let (bytes, layout) = output.into_parts();

    destination.write_output(
        bytes,
        layout.rows(),
        layout.columns(),
        layout.channels(),
        source.depth(),
    )?;
    Ok(())
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

    #[test]
    fn into_supports_exact_in_place_aliasing() {
        let matrix = u8_matrix(vec![1, 2, 3, 4, 5, 6], 2, 3, 1);

        apply_layout_into(&matrix, &matrix, |source| flip_bytes(source, -1))
            .expect("in-place flip");

        assert_eq!(matrix.to_u8_array(), [6, 5, 4, 3, 2, 1]);
    }

    #[test]
    fn into_writes_through_a_strided_destination_region() {
        let source = u8_matrix(vec![1, 2, 3, 4], 2, 2, 1);
        let parent = u8_matrix(vec![0; 16], 4, 4, 1);
        let destination = parent.roi(1, 1, 2, 2).expect("valid destination ROI");
        assert!(!destination.is_continuous());

        apply_layout_into(&source, &destination, transpose_bytes).expect("transpose into ROI");

        assert_eq!(destination.to_u8_array(), [1, 3, 2, 4]);
        assert_eq!(
            parent.to_u8_array(),
            [0, 0, 0, 0, 0, 1, 3, 0, 0, 2, 4, 0, 0, 0, 0, 0]
        );
    }

    #[test]
    fn into_rebinds_each_incompatible_ordinary_destination() {
        let source = u8_matrix(vec![1, 2, 3, 4, 5, 6], 2, 3, 1);
        let wrong_shape = u8_matrix(vec![9; 6], 2, 3, 1);
        let wrong_channels = u8_matrix(vec![8; 6], 3, 1, 2);
        let wrong_depth = Mat::from_owned_bytes(vec![7; 12], 3, 2, 1, MatDepth::U16)
            .expect("valid wrong-depth destination");

        for destination in [&wrong_shape, &wrong_channels, &wrong_depth] {
            apply_layout_into(&source, destination, transpose_bytes)
                .expect("ordinary destination header can rebind");
            assert_eq!((destination.rows(), destination.columns()), (3, 2));
            assert_eq!(destination.channels(), 1);
            assert_eq!(destination.depth(), MatDepth::U8);
            assert_eq!(destination.to_u8_array(), [1, 4, 2, 5, 3, 6]);
        }
    }

    #[test]
    fn into_rejects_incompatible_roi_without_changing_parent_or_header() {
        let source = u8_matrix(vec![1, 2, 3, 4, 5, 6], 2, 3, 1);
        let parent = u8_matrix(vec![9; 12], 3, 4, 1);
        let destination = parent.roi(0, 0, 2, 3).expect("valid ROI");
        let before = parent.to_u8_array();

        assert!(matches!(
            apply_layout_into(&source, &destination, transpose_bytes),
            Err(LayoutWasmError::Matrix(MatError::IncompatibleRegionOutput))
        ));
        assert_eq!(parent.to_u8_array(), before);
        assert_eq!((destination.rows(), destination.columns()), (2, 3));
    }

    #[test]
    fn rotate_and_repeat_into_write_expected_outputs() {
        let source = u8_matrix(vec![1, 2, 3, 4, 5, 6], 2, 3, 1);
        let rotated = u8_matrix(vec![0; 6], 3, 2, 1);
        let repeated = u8_matrix(vec![0; 12], 4, 3, 1);

        apply_layout_into(&source, &rotated, |matrix| rotate_bytes(matrix, 0))
            .expect("rotate into destination");
        apply_layout_into(&source, &repeated, |matrix| repeat_bytes(matrix, 2, 1))
            .expect("repeat into destination");

        assert_eq!(rotated.to_u8_array(), [4, 1, 5, 2, 6, 3]);
        assert_eq!(repeated.to_u8_array(), [1, 2, 3, 4, 5, 6, 1, 2, 3, 4, 5, 6]);
    }

    #[test]
    fn horizontal_concat_compacts_two_strided_rois_without_mutating_inputs() {
        let left_parent = u8_matrix(vec![1, 2, 3, 4, 5, 6, 7, 8], 2, 4, 1);
        let right_parent = u8_matrix(vec![9, 10, 11, 12, 13, 14, 15, 16], 2, 4, 1);
        let left = left_parent.roi(0, 1, 2, 2).expect("left ROI");
        let right = right_parent.roi(0, 0, 2, 1).expect("right ROI");
        let left_before = left_parent.to_u8_array();
        let right_before = right_parent.to_u8_array();

        let output = apply_concat(&[&left, &right], hconcat_bytes).expect("horizontal concat");

        assert_eq!((output.rows(), output.columns()), (2, 3));
        assert_eq!(output.to_u8_array(), [2, 3, 9, 6, 7, 13]);
        assert_eq!(left_parent.to_u8_array(), left_before);
        assert_eq!(right_parent.to_u8_array(), right_before);
    }

    #[test]
    fn vertical_concat_supports_four_all_depth_channel_matrices() {
        let values = [
            [1.25_f64, -2.5],
            [3.75_f64, 4.5],
            [-6.0_f64, 7.25],
            [8.5_f64, -9.75],
        ];
        let matrices = values.map(|row| {
            Mat::from_owned_bytes(
                row.into_iter().flat_map(f64::to_ne_bytes).collect(),
                1,
                1,
                2,
                MatDepth::F64,
            )
            .expect("valid F64 matrix")
        });

        let output = apply_concat(
            &[&matrices[0], &matrices[1], &matrices[2], &matrices[3]],
            vconcat_bytes,
        )
        .expect("vertical concat");

        assert_eq!(
            (output.rows(), output.columns(), output.channels()),
            (4, 1, 2)
        );
        assert_eq!(output.depth(), MatDepth::F64);
        assert_eq!(
            output.to_f64_array().expect("F64 output"),
            [1.25, -2.5, 3.75, 4.5, -6.0, 7.25, 8.5, -9.75]
        );
    }

    #[test]
    fn concat_rejects_equal_width_but_different_depths() {
        let unsigned =
            Mat::from_owned_bytes(vec![1, 0], 1, 1, 1, MatDepth::U16).expect("valid U16 matrix");
        let signed =
            Mat::from_owned_bytes(vec![1, 0], 1, 1, 1, MatDepth::I16).expect("valid I16 matrix");

        assert!(matches!(
            apply_concat(&[&unsigned, &signed], hconcat_bytes),
            Err(LayoutWasmError::IncompatibleSourceDepth {
                index: 1,
                expected: MatDepth::U16,
                actual: MatDepth::I16
            })
        ));
    }

    #[test]
    fn concat_rejects_shape_and_channel_mismatches() {
        let first = u8_matrix(vec![1, 2], 1, 2, 1);
        let wrong_rows = u8_matrix(vec![3, 4, 5, 6], 2, 2, 1);
        let wrong_columns = u8_matrix(vec![3, 4], 2, 1, 1);
        let wrong_channels = u8_matrix(vec![3, 4, 5, 6], 1, 2, 2);

        for result in [
            apply_concat(&[&first, &wrong_rows], hconcat_bytes),
            apply_concat(&[&first, &wrong_columns], vconcat_bytes),
            apply_concat(&[&first, &wrong_channels], hconcat_bytes),
        ] {
            assert!(matches!(
                result,
                Err(LayoutWasmError::Kernel(LayoutError::IncompatibleSource {
                    index: 1,
                    ..
                }))
            ));
        }
    }
}
