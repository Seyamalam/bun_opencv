//! Matrix-aware WebAssembly adapters for unsigned 8-bit core kernels.

use std::{error::Error, fmt};

use wasm_bindgen::prelude::*;

use crate::{
    core_ops::{
        CoreOpError, absdiff_u8, add_u8, bitwise_and_u8, bitwise_not_u8, bitwise_or_u8,
        bitwise_xor_u8, compare_eq_u8, count_non_zero_u8, in_range_u8, max_u8, min_u8, subtract_u8,
    },
    mat::{Mat, MatDepth, MatError},
};

type BinaryKernel = fn(&[u8], &[u8]) -> Result<Vec<u8>, CoreOpError>;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct MatShape {
    rows: u32,
    columns: u32,
    channels: u16,
}

impl MatShape {
    fn of(matrix: &Mat) -> Self {
        Self {
            rows: matrix.rows(),
            columns: matrix.columns(),
            channels: matrix.channels(),
        }
    }
}

impl fmt::Display for MatShape {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            formatter,
            "{} row(s) by {} column(s) with {} channel(s)",
            self.rows, self.columns, self.channels
        )
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
enum CoreWasmError {
    IncorrectDepth {
        operand: &'static str,
        actual: MatDepth,
    },
    ShapeMismatch {
        operand: &'static str,
        expected: MatShape,
        actual: MatShape,
    },
    IncorrectChannelCount {
        expected: u16,
        actual: u16,
    },
    CountOverflow,
    Kernel(CoreOpError),
    Matrix(MatError),
}

impl fmt::Display for CoreWasmError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::IncorrectDepth { operand, actual } => {
                write!(
                    formatter,
                    "{operand} matrix depth is {actual:?}; expected U8"
                )
            }
            Self::ShapeMismatch {
                operand,
                expected,
                actual,
            } => write!(
                formatter,
                "{operand} matrix shape is {actual}; expected {expected}"
            ),
            Self::IncorrectChannelCount { expected, actual } => write!(
                formatter,
                "matrix has {actual} channel(s); expected {expected} channel(s)"
            ),
            Self::CountOverflow => {
                formatter.write_str("non-zero element count exceeds the WASM integer limit")
            }
            Self::Kernel(error) => error.fmt(formatter),
            Self::Matrix(error) => error.fmt(formatter),
        }
    }
}

impl Error for CoreWasmError {
    fn source(&self) -> Option<&(dyn Error + 'static)> {
        match self {
            Self::Kernel(error) => Some(error),
            Self::Matrix(error) => Some(error),
            Self::IncorrectDepth { .. }
            | Self::ShapeMismatch { .. }
            | Self::IncorrectChannelCount { .. }
            | Self::CountOverflow => None,
        }
    }
}

impl From<CoreOpError> for CoreWasmError {
    fn from(error: CoreOpError) -> Self {
        Self::Kernel(error)
    }
}

impl From<MatError> for CoreWasmError {
    fn from(error: MatError) -> Self {
        Self::Matrix(error)
    }
}

/// Adds corresponding U8 matrix elements with saturation at 255.
///
/// # Errors
///
/// Returns an error unless both matrices have U8 depth and identical shapes.
#[wasm_bindgen(js_name = matAddU8)]
pub fn mat_add_u8(left: &Mat, right: &Mat) -> Result<Mat, JsError> {
    apply_binary_u8(left, right, add_u8).map_err(JsError::from)
}

/// Subtracts corresponding U8 matrix elements with saturation at zero.
///
/// # Errors
///
/// Returns an error unless both matrices have U8 depth and identical shapes.
#[wasm_bindgen(js_name = matSubtractU8)]
pub fn mat_subtract_u8(left: &Mat, right: &Mat) -> Result<Mat, JsError> {
    apply_binary_u8(left, right, subtract_u8).map_err(JsError::from)
}

/// Computes the absolute difference between corresponding U8 matrix elements.
///
/// # Errors
///
/// Returns an error unless both matrices have U8 depth and identical shapes.
#[wasm_bindgen(js_name = matAbsdiffU8)]
pub fn mat_absdiff_u8(left: &Mat, right: &Mat) -> Result<Mat, JsError> {
    apply_binary_u8(left, right, absdiff_u8).map_err(JsError::from)
}

/// Computes a bitwise AND between corresponding U8 matrix elements.
///
/// # Errors
///
/// Returns an error unless both matrices have U8 depth and identical shapes.
#[wasm_bindgen(js_name = matBitwiseAndU8)]
pub fn mat_bitwise_and_u8(left: &Mat, right: &Mat) -> Result<Mat, JsError> {
    apply_binary_u8(left, right, bitwise_and_u8).map_err(JsError::from)
}

/// Computes a bitwise OR between corresponding U8 matrix elements.
///
/// # Errors
///
/// Returns an error unless both matrices have U8 depth and identical shapes.
#[wasm_bindgen(js_name = matBitwiseOrU8)]
pub fn mat_bitwise_or_u8(left: &Mat, right: &Mat) -> Result<Mat, JsError> {
    apply_binary_u8(left, right, bitwise_or_u8).map_err(JsError::from)
}

/// Computes a bitwise XOR between corresponding U8 matrix elements.
///
/// # Errors
///
/// Returns an error unless both matrices have U8 depth and identical shapes.
#[wasm_bindgen(js_name = matBitwiseXorU8)]
pub fn mat_bitwise_xor_u8(left: &Mat, right: &Mat) -> Result<Mat, JsError> {
    apply_binary_u8(left, right, bitwise_xor_u8).map_err(JsError::from)
}

/// Inverts every bit in a U8 matrix.
///
/// # Errors
///
/// Returns an error unless the matrix has U8 depth.
#[wasm_bindgen(js_name = matBitwiseNotU8)]
pub fn mat_bitwise_not_u8(source: &Mat) -> Result<Mat, JsError> {
    apply_unary_u8(source, bitwise_not_u8).map_err(JsError::from)
}

/// Selects the smaller corresponding U8 matrix element.
///
/// # Errors
///
/// Returns an error unless both matrices have U8 depth and identical shapes.
#[wasm_bindgen(js_name = matMinU8)]
pub fn mat_min_u8(left: &Mat, right: &Mat) -> Result<Mat, JsError> {
    apply_binary_u8(left, right, min_u8).map_err(JsError::from)
}

/// Selects the larger corresponding U8 matrix element.
///
/// # Errors
///
/// Returns an error unless both matrices have U8 depth and identical shapes.
#[wasm_bindgen(js_name = matMaxU8)]
pub fn mat_max_u8(left: &Mat, right: &Mat) -> Result<Mat, JsError> {
    apply_binary_u8(left, right, max_u8).map_err(JsError::from)
}

/// Compares corresponding U8 elements for equality and returns a 255/0 mask.
///
/// # Errors
///
/// Returns an error unless both matrices have U8 depth and identical shapes.
#[wasm_bindgen(js_name = matCompareEqU8)]
pub fn mat_compare_eq_u8(left: &Mat, right: &Mat) -> Result<Mat, JsError> {
    apply_binary_u8(left, right, compare_eq_u8).map_err(JsError::from)
}

/// Tests U8 elements against corresponding inclusive lower and upper bounds.
///
/// The result has one U8 channel. A pixel is 255 only when every source channel lies within its
/// corresponding bounds.
///
/// # Errors
///
/// Returns an error unless all matrices have U8 depth and identical shapes.
#[wasm_bindgen(js_name = matInRangeU8)]
pub fn mat_in_range_u8(source: &Mat, lower_bound: &Mat, upper_bound: &Mat) -> Result<Mat, JsError> {
    apply_in_range_u8(source, lower_bound, upper_bound).map_err(JsError::from)
}

/// Counts non-zero elements in a single-channel U8 matrix.
///
/// # Errors
///
/// Returns an error unless the matrix has U8 depth and exactly one channel.
#[wasm_bindgen(js_name = matCountNonZeroU8)]
pub fn mat_count_non_zero_u8(source: &Mat) -> Result<u32, JsError> {
    count_mat_non_zero_u8(source).map_err(JsError::from)
}

fn apply_binary_u8(left: &Mat, right: &Mat, kernel: BinaryKernel) -> Result<Mat, CoreWasmError> {
    validate_u8(left, "left")?;
    validate_u8(right, "right")?;
    validate_shape(MatShape::of(left), right, "right")?;

    let output = kernel(&left.compact_bytes(), &right.compact_bytes())?;
    matrix_from_u8(output, MatShape::of(left))
}

fn apply_unary_u8(source: &Mat, kernel: fn(&[u8]) -> Vec<u8>) -> Result<Mat, CoreWasmError> {
    validate_u8(source, "source")?;
    matrix_from_u8(kernel(&source.compact_bytes()), MatShape::of(source))
}

fn apply_in_range_u8(
    source: &Mat,
    lower_bound: &Mat,
    upper_bound: &Mat,
) -> Result<Mat, CoreWasmError> {
    validate_u8(source, "source")?;
    validate_u8(lower_bound, "lower bound")?;
    validate_u8(upper_bound, "upper bound")?;
    let source_shape = MatShape::of(source);
    validate_shape(source_shape, lower_bound, "lower bound")?;
    validate_shape(source_shape, upper_bound, "upper bound")?;

    let component_mask = in_range_u8(
        &source.compact_bytes(),
        &lower_bound.compact_bytes(),
        &upper_bound.compact_bytes(),
    )?;
    let pixel_mask = component_mask
        .chunks_exact(usize::from(source_shape.channels))
        .map(|channels| u8::from(channels.iter().all(|&value| value == u8::MAX)) * u8::MAX)
        .collect();

    matrix_from_u8(
        pixel_mask,
        MatShape {
            channels: 1,
            ..source_shape
        },
    )
}

fn count_mat_non_zero_u8(source: &Mat) -> Result<u32, CoreWasmError> {
    validate_u8(source, "source")?;
    if source.channels() != 1 {
        return Err(CoreWasmError::IncorrectChannelCount {
            expected: 1,
            actual: source.channels(),
        });
    }

    u32::try_from(count_non_zero_u8(&source.compact_bytes()))
        .map_err(|_| CoreWasmError::CountOverflow)
}

fn validate_u8(matrix: &Mat, operand: &'static str) -> Result<(), CoreWasmError> {
    if matrix.depth() != MatDepth::U8 {
        return Err(CoreWasmError::IncorrectDepth {
            operand,
            actual: matrix.depth(),
        });
    }
    Ok(())
}

fn validate_shape(
    expected: MatShape,
    actual: &Mat,
    operand: &'static str,
) -> Result<(), CoreWasmError> {
    let actual = MatShape::of(actual);
    if actual != expected {
        return Err(CoreWasmError::ShapeMismatch {
            operand,
            expected,
            actual,
        });
    }
    Ok(())
}

fn matrix_from_u8(data: Vec<u8>, shape: MatShape) -> Result<Mat, CoreWasmError> {
    Mat::from_owned_bytes(
        data,
        shape.rows,
        shape.columns,
        shape.channels,
        MatDepth::U8,
    )
    .map_err(CoreWasmError::from)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn u8_matrix(data: Vec<u8>, rows: u32, columns: u32, channels: u16) -> Mat {
        Mat::from_owned_bytes(data, rows, columns, channels, MatDepth::U8)
            .expect("valid U8 test matrix")
    }

    #[test]
    fn binary_adapter_rejects_shape_mismatches_before_running_a_kernel() {
        let left = u8_matrix(vec![1, 2], 1, 2, 1);
        let right = u8_matrix(vec![1, 2], 2, 1, 1);

        let error =
            apply_binary_u8(&left, &right, add_u8).expect_err("different matrix shapes must fail");
        assert_eq!(
            error,
            CoreWasmError::ShapeMismatch {
                operand: "right",
                expected: MatShape {
                    rows: 1,
                    columns: 2,
                    channels: 1,
                },
                actual: MatShape {
                    rows: 2,
                    columns: 1,
                    channels: 1,
                },
            }
        );
    }

    #[test]
    fn adapter_rejects_non_u8_depths() {
        let left = u8_matrix(vec![1], 1, 1, 1);
        let right = Mat::from_owned_bytes(vec![1, 0], 1, 1, 1, MatDepth::I16)
            .expect("valid I16 test matrix");

        let error = apply_binary_u8(&left, &right, add_u8).expect_err("non-U8 matrix must fail");
        assert_eq!(
            error,
            CoreWasmError::IncorrectDepth {
                operand: "right",
                actual: MatDepth::I16,
            }
        );
    }

    #[test]
    fn binary_adapter_compacts_strided_regions_before_processing() {
        let source = u8_matrix(vec![1, 2, 3, 4, 5, 6, 7, 8], 2, 4, 1);
        let region = source.roi(0, 1, 2, 2).expect("valid strided region");
        let right = u8_matrix(vec![10, 20, 30, 40], 2, 2, 1);

        let output = apply_binary_u8(&region, &right, add_u8).expect("matching U8 matrices");
        assert_eq!(output.compact_bytes(), [12, 23, 36, 47]);
    }

    #[test]
    fn element_wise_output_preserves_source_metadata() {
        let source = u8_matrix(vec![0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], 2, 2, 3);
        let output = apply_unary_u8(&source, bitwise_not_u8).expect("U8 matrix");

        assert_eq!(output.rows(), 2);
        assert_eq!(output.columns(), 2);
        assert_eq!(output.channels(), 3);
        assert_eq!(output.depth(), MatDepth::U8);
        assert!(output.is_continuous());
        assert_eq!(output.compact_bytes()[0], 255);
        assert_eq!(output.compact_bytes()[11], 244);
    }

    #[test]
    fn in_range_combines_channels_into_a_single_channel_mask() {
        let source = u8_matrix(vec![10, 20, 30, 10, 99, 30], 1, 2, 3);
        let lower = u8_matrix(vec![10, 20, 30, 10, 20, 30], 1, 2, 3);
        let upper = u8_matrix(vec![10, 20, 30, 10, 50, 30], 1, 2, 3);

        let output = apply_in_range_u8(&source, &lower, &upper).expect("matching U8 matrices");
        assert_eq!(output.rows(), 1);
        assert_eq!(output.columns(), 2);
        assert_eq!(output.channels(), 1);
        assert_eq!(output.depth(), MatDepth::U8);
        assert_eq!(output.compact_bytes(), [255, 0]);
    }

    #[test]
    fn count_handles_strided_single_channel_regions() {
        let source = u8_matrix(vec![0, 1, 9, 0, 2, 3, 9, 9], 2, 4, 1);
        let region = source.roi(0, 0, 2, 2).expect("valid strided region");
        assert_eq!(count_mat_non_zero_u8(&region), Ok(3));
    }

    #[test]
    fn count_rejects_multi_channel_input() {
        let source = u8_matrix(vec![1, 2], 1, 1, 2);
        assert_eq!(
            count_mat_non_zero_u8(&source),
            Err(CoreWasmError::IncorrectChannelCount {
                expected: 1,
                actual: 2,
            })
        );
    }
}
