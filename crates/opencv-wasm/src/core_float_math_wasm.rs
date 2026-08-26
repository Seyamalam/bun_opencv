//! Matrix-aware WebAssembly adapters for floating-point math kernels.

use crate::{
    core_float_math::{self, FloatMathError},
    mat::{Mat, MatDepth, MatError},
};
use std::{error::Error, fmt};
use wasm_bindgen::prelude::*;

#[derive(Debug, Clone, PartialEq, Eq)]
enum FloatMathWasmError {
    FloatingPointDepthRequired(MatDepth),
    ShapeMismatch,
    Kernel(FloatMathError),
    Matrix(MatError),
}

impl fmt::Display for FloatMathWasmError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::FloatingPointDepthRequired(depth) => write!(
                f,
                "floating-point matrix depth F32 or F64 is required; received {depth:?}"
            ),
            Self::ShapeMismatch => {
                f.write_str("matrix rows, columns, channels, and depth must match")
            }
            Self::Kernel(error) => error.fmt(f),
            Self::Matrix(error) => error.fmt(f),
        }
    }
}
impl Error for FloatMathWasmError {}
impl From<FloatMathError> for FloatMathWasmError {
    fn from(value: FloatMathError) -> Self {
        Self::Kernel(value)
    }
}
impl From<MatError> for FloatMathWasmError {
    fn from(value: MatError) -> Self {
        Self::Matrix(value)
    }
}

type UnaryKernel = fn(&[u8]) -> Result<Vec<u8>, FloatMathError>;
type BinaryKernel = fn(&[u8], &[u8]) -> Result<Vec<u8>, FloatMathError>;
type UnaryScalarKernel = fn(&[u8], &mut [u8]);
type BinaryScalarKernel = fn(&[u8], &[u8], &mut [u8]);

#[derive(Clone, Copy)]
struct BinaryKernels {
    compact_f32: BinaryKernel,
    compact_f64: BinaryKernel,
    scalar_f32: BinaryScalarKernel,
    scalar_f64: BinaryScalarKernel,
}

/// Computes the natural exponential element-wise.
/// # Errors
/// Returns an error unless the source has F32 or F64 depth.
#[wasm_bindgen(js_name = matExp)]
pub fn mat_exp(source: &Mat) -> Result<Mat, JsError> {
    unary(source, core_float_math::exp_f32, core_float_math::exp_f64).map_err(JsError::from)
}

/// Computes the natural exponential into a caller-owned destination.
/// # Errors
/// Returns an error unless the source has F32 or F64 depth.
#[wasm_bindgen(js_name = matExpInto)]
pub fn mat_exp_into(source: &Mat, destination: &Mat) -> Result<(), JsError> {
    unary_into(
        source,
        destination,
        core_float_math::exp_f32,
        core_float_math::exp_f64,
        exp_scalar_f32,
        exp_scalar_f64,
    )
    .map_err(JsError::from)
}

/// Computes the natural logarithm element-wise.
/// # Errors
/// Returns an error unless the source has F32 or F64 depth.
#[wasm_bindgen(js_name = matLog)]
pub fn mat_log(source: &Mat) -> Result<Mat, JsError> {
    unary(source, core_float_math::log_f32, core_float_math::log_f64).map_err(JsError::from)
}

/// Computes the natural logarithm into a caller-owned destination.
/// # Errors
/// Returns an error unless the source has F32 or F64 depth.
#[wasm_bindgen(js_name = matLogInto)]
pub fn mat_log_into(source: &Mat, destination: &Mat) -> Result<(), JsError> {
    unary_into(
        source,
        destination,
        core_float_math::log_f32,
        core_float_math::log_f64,
        log_scalar_f32,
        log_scalar_f64,
    )
    .map_err(JsError::from)
}

/// Computes the square root element-wise.
/// # Errors
/// Returns an error unless the source has F32 or F64 depth.
#[wasm_bindgen(js_name = matSqrt)]
pub fn mat_sqrt(source: &Mat) -> Result<Mat, JsError> {
    unary(source, core_float_math::sqrt_f32, core_float_math::sqrt_f64).map_err(JsError::from)
}

/// Computes the square root into a caller-owned destination.
/// # Errors
/// Returns an error unless a nonempty source has F32 or F64 depth.
#[wasm_bindgen(js_name = matSqrtInto)]
pub fn mat_sqrt_into(source: &Mat, destination: &Mat) -> Result<(), JsError> {
    if source.rows() == 0 && source.columns() == 0 && source.depth() == MatDepth::U8 {
        if destination.rows() != 0 || destination.columns() != 0 {
            destination.release_output_retaining_type();
        }
        return Ok(());
    }
    unary_into(
        source,
        destination,
        core_float_math::sqrt_f32,
        core_float_math::sqrt_f64,
        sqrt_scalar_f32,
        sqrt_scalar_f64,
    )
    .map_err(JsError::from)
}

/// Raises every element to a scalar exponent.
/// # Errors
/// Returns an error unless the source has F32 or F64 depth.
#[wasm_bindgen(js_name = matPow)]
pub fn mat_pow(source: &Mat, exponent: f64) -> Result<Mat, JsError> {
    pow(source, exponent).map_err(JsError::from)
}

/// Raises every element to a scalar exponent in a caller-owned destination.
/// # Errors
/// Returns an error when an integer source receives a non-integral or out-of-range exponent.
#[wasm_bindgen(js_name = matPowInto)]
pub fn mat_pow_into(source: &Mat, exponent: f64, destination: &Mat) -> Result<(), JsError> {
    pow_into(source, exponent, destination).map_err(JsError::from)
}

/// Computes Cartesian magnitude element-wise.
/// # Errors
/// Returns an error unless both inputs match and have F32 or F64 depth.
#[wasm_bindgen(js_name = matMagnitude)]
pub fn mat_magnitude(x: &Mat, y: &Mat) -> Result<Mat, JsError> {
    binary(
        x,
        y,
        core_float_math::magnitude_f32,
        core_float_math::magnitude_f64,
    )
    .map_err(JsError::from)
}

/// Computes Cartesian magnitude into a caller-owned destination.
/// # Errors
/// Returns an error unless both inputs match and have F32 or F64 depth.
#[wasm_bindgen(js_name = matMagnitudeInto)]
pub fn mat_magnitude_into(x: &Mat, y: &Mat, destination: &Mat) -> Result<(), JsError> {
    binary_into(
        x,
        y,
        destination,
        BinaryKernels {
            compact_f32: core_float_math::magnitude_f32,
            compact_f64: core_float_math::magnitude_f64,
            scalar_f32: magnitude_scalar_f32,
            scalar_f64: magnitude_scalar_f64,
        },
    )
    .map_err(JsError::from)
}

/// Converts Cartesian coordinates into caller-owned magnitude and angle destinations.
/// # Errors
/// Returns an error unless every matrix matches and has F32 or F64 depth.
#[wasm_bindgen(js_name = matCartToPolar)]
pub fn mat_cart_to_polar(
    x: &Mat,
    y: &Mat,
    magnitude: &Mat,
    angle: &Mat,
    degrees: bool,
) -> Result<(), JsError> {
    pair_into(x, y, magnitude, angle, |depth, a, b| match depth {
        MatDepth::F32 => core_float_math::cart_to_polar_f32(a, b, degrees),
        MatDepth::F64 => core_float_math::cart_to_polar_f64(a, b, degrees),
        _ => unreachable!(),
    })
    .map_err(JsError::from)
}

/// Converts polar coordinates into caller-owned Cartesian destinations.
/// # Errors
/// Returns an error unless every matrix matches and has F32 or F64 depth.
#[wasm_bindgen(js_name = matPolarToCart)]
pub fn mat_polar_to_cart(
    magnitude: &Mat,
    angle: &Mat,
    x: &Mat,
    y: &Mat,
    degrees: bool,
) -> Result<(), JsError> {
    pair_into(magnitude, angle, x, y, |depth, a, b| match depth {
        MatDepth::F32 => core_float_math::polar_to_cart_f32(a, b, degrees),
        MatDepth::F64 => core_float_math::polar_to_cart_f64(a, b, degrees),
        _ => unreachable!(),
    })
    .map_err(JsError::from)
}

fn float_depth(mat: &Mat) -> Result<MatDepth, FloatMathWasmError> {
    match mat.depth() {
        depth @ (MatDepth::F32 | MatDepth::F64) => Ok(depth),
        depth => Err(FloatMathWasmError::FloatingPointDepthRequired(depth)),
    }
}
fn matches(a: &Mat, b: &Mat) -> bool {
    a.rows() == b.rows()
        && a.columns() == b.columns()
        && a.channels() == b.channels()
        && a.depth() == b.depth()
}
fn from_bytes(like: &Mat, bytes: Vec<u8>) -> Result<Mat, FloatMathWasmError> {
    Ok(Mat::from_owned_bytes(
        bytes,
        like.rows(),
        like.columns(),
        like.channels(),
        like.depth(),
    )?)
}
fn unary(
    source: &Mat,
    f32_kernel: UnaryKernel,
    f64_kernel: UnaryKernel,
) -> Result<Mat, FloatMathWasmError> {
    unary_with(source, |depth, bytes| match depth {
        MatDepth::F32 => f32_kernel(bytes),
        MatDepth::F64 => f64_kernel(bytes),
        _ => unreachable!(),
    })
}
fn unary_into(
    source: &Mat,
    destination: &Mat,
    f32_kernel: UnaryKernel,
    f64_kernel: UnaryKernel,
    f32_scalar_kernel: UnaryScalarKernel,
    f64_scalar_kernel: UnaryScalarKernel,
) -> Result<(), FloatMathWasmError> {
    let depth = float_depth(source)?;
    if source.rows() == 0 || source.columns() == 0 {
        destination.write_empty_layout(
            source.rows(),
            source.columns(),
            source.channels(),
            depth,
            true,
        )?;
        return Ok(());
    }
    let scalar_kernel = match depth {
        MatDepth::F32 => f32_scalar_kernel,
        MatDepth::F64 => f64_scalar_kernel,
        _ => unreachable!(),
    };
    if destination.try_write_shared_unary_scalars(source, depth.byte_width(), scalar_kernel)? {
        return Ok(());
    }

    let output = match depth {
        MatDepth::F32 => f32_kernel(&source.compact_bytes())?,
        MatDepth::F64 => f64_kernel(&source.compact_bytes())?,
        _ => unreachable!(),
    };
    destination.write_output(
        output,
        source.rows(),
        source.columns(),
        source.channels(),
        depth,
    )?;
    Ok(())
}

fn exp_scalar_f32(input: &[u8], output: &mut [u8]) {
    transform_scalar_f32(input, output, f32::exp);
}

fn exp_scalar_f64(input: &[u8], output: &mut [u8]) {
    transform_scalar_f64(input, output, f64::exp);
}

fn log_scalar_f32(input: &[u8], output: &mut [u8]) {
    transform_scalar_f32(input, output, f32::ln);
}

fn log_scalar_f64(input: &[u8], output: &mut [u8]) {
    transform_scalar_f64(input, output, f64::ln);
}

fn sqrt_scalar_f32(input: &[u8], output: &mut [u8]) {
    transform_scalar_f32(input, output, f32::sqrt);
}

fn sqrt_scalar_f64(input: &[u8], output: &mut [u8]) {
    transform_scalar_f64(input, output, f64::sqrt);
}

fn magnitude_scalar_f32(first: &[u8], second: &[u8], output: &mut [u8]) {
    let first: [u8; 4] = first
        .try_into()
        .expect("F32 scalar traversal always supplies four bytes");
    let second: [u8; 4] = second
        .try_into()
        .expect("F32 scalar traversal always supplies four bytes");
    let x = f32::from_ne_bytes(first);
    let y = f32::from_ne_bytes(second);
    output.copy_from_slice(&(x * x + y * y).sqrt().to_ne_bytes());
}

fn magnitude_scalar_f64(first: &[u8], second: &[u8], output: &mut [u8]) {
    let first: [u8; 8] = first
        .try_into()
        .expect("F64 scalar traversal always supplies eight bytes");
    let second: [u8; 8] = second
        .try_into()
        .expect("F64 scalar traversal always supplies eight bytes");
    let x = f64::from_ne_bytes(first);
    let y = f64::from_ne_bytes(second);
    output.copy_from_slice(&(x * x + y * y).sqrt().to_ne_bytes());
}

fn transform_scalar_f32(input: &[u8], output: &mut [u8], operation: impl FnOnce(f32) -> f32) {
    let bytes: [u8; 4] = input
        .try_into()
        .expect("F32 scalar traversal always supplies four bytes");
    output.copy_from_slice(&operation(f32::from_ne_bytes(bytes)).to_ne_bytes());
}

fn transform_scalar_f64(input: &[u8], output: &mut [u8], operation: impl FnOnce(f64) -> f64) {
    let bytes: [u8; 8] = input
        .try_into()
        .expect("F64 scalar traversal always supplies eight bytes");
    output.copy_from_slice(&operation(f64::from_ne_bytes(bytes)).to_ne_bytes());
}
fn unary_with(
    source: &Mat,
    kernel: impl FnOnce(MatDepth, &[u8]) -> Result<Vec<u8>, FloatMathError>,
) -> Result<Mat, FloatMathWasmError> {
    let depth = float_depth(source)?;
    if source.rows() == 0 || source.columns() == 0 {
        return Mat::empty_with_layout(
            source.rows(),
            source.columns(),
            source.channels(),
            depth,
            true,
        )
        .map_err(FloatMathWasmError::from);
    }
    from_bytes(source, kernel(depth, &source.compact_bytes())?)
}
fn pow(source: &Mat, exponent: f64) -> Result<Mat, FloatMathWasmError> {
    if source.rows() == 0 || source.columns() == 0 {
        return Mat::empty_with_layout(
            source.rows(),
            source.columns(),
            source.channels(),
            source.depth(),
            true,
        )
        .map_err(FloatMathWasmError::from);
    }
    from_bytes(
        source,
        core_float_math::pow_depth(&source.compact_bytes(), source.depth(), exponent)?,
    )
}
fn pow_into(source: &Mat, exponent: f64, destination: &Mat) -> Result<(), FloatMathWasmError> {
    let depth = source.depth();
    core_float_math::validate_pow_depth(depth, exponent)?;
    if source.rows() == 0 || source.columns() == 0 {
        let fresh_canonical = source.rows() == 0
            && source.columns() == 0
            && source.channels() == 1
            && depth == MatDepth::U8
            && !source.is_continuous();
        if fresh_canonical {
            if destination.rows() != 0 || destination.columns() != 0 {
                destination.release_output_retaining_type();
            }
        } else {
            destination.write_empty_layout(
                source.rows(),
                source.columns(),
                source.channels(),
                depth,
                true,
            )?;
        }
        return Ok(());
    }

    if destination.try_write_shared_unary_scalars(source, depth.byte_width(), |input, output| {
        core_float_math::pow_scalar(input, output, depth, exponent)
            .expect("power exponent is validated before shared traversal");
    })? {
        return Ok(());
    }

    let output = core_float_math::pow_depth(&source.compact_bytes(), depth, exponent)?;
    destination.write_output(
        output,
        source.rows(),
        source.columns(),
        source.channels(),
        depth,
    )?;
    Ok(())
}
fn binary(
    left: &Mat,
    right: &Mat,
    f32_kernel: BinaryKernel,
    f64_kernel: BinaryKernel,
) -> Result<Mat, FloatMathWasmError> {
    let depth = float_depth(left)?;
    if !matches(left, right) {
        return Err(FloatMathWasmError::ShapeMismatch);
    }
    let a = left.compact_bytes();
    let b = right.compact_bytes();
    let output = match depth {
        MatDepth::F32 => f32_kernel(&a, &b)?,
        MatDepth::F64 => f64_kernel(&a, &b)?,
        _ => unreachable!(),
    };
    from_bytes(left, output)
}
fn binary_into(
    left: &Mat,
    right: &Mat,
    destination: &Mat,
    kernels: BinaryKernels,
) -> Result<(), FloatMathWasmError> {
    let depth = float_depth(left)?;
    if !matches(left, right) {
        return Err(FloatMathWasmError::ShapeMismatch);
    }
    if left.rows() == 0 || left.columns() == 0 {
        destination.write_empty_layout(
            left.rows(),
            left.columns(),
            left.channels(),
            depth,
            true,
        )?;
        return Ok(());
    }

    let scalar_kernel = match depth {
        MatDepth::F32 => kernels.scalar_f32,
        MatDepth::F64 => kernels.scalar_f64,
        _ => unreachable!(),
    };
    if destination.try_write_shared_binary_scalars(
        left,
        right,
        depth.byte_width(),
        scalar_kernel,
    )? {
        return Ok(());
    }

    let left_bytes = left.compact_bytes();
    let right_bytes = right.compact_bytes();
    let output = match depth {
        MatDepth::F32 => (kernels.compact_f32)(&left_bytes, &right_bytes)?,
        MatDepth::F64 => (kernels.compact_f64)(&left_bytes, &right_bytes)?,
        _ => unreachable!(),
    };
    destination.write_output(output, left.rows(), left.columns(), left.channels(), depth)?;
    Ok(())
}
fn pair_into(
    left: &Mat,
    right: &Mat,
    first: &Mat,
    second: &Mat,
    kernel: impl FnOnce(MatDepth, &[u8], &[u8]) -> Result<(Vec<u8>, Vec<u8>), FloatMathError>,
) -> Result<(), FloatMathWasmError> {
    let depth = float_depth(left)?;
    if !matches(left, right) {
        return Err(FloatMathWasmError::ShapeMismatch);
    }
    if left.rows() == 0 || left.columns() == 0 {
        first.write_empty_layout(
            left.rows(),
            left.columns(),
            left.channels(),
            depth,
            true,
        )?;
        second.write_empty_layout(
            left.rows(),
            left.columns(),
            left.channels(),
            depth,
            true,
        )?;
        return Ok(());
    }
    let (first_bytes, second_bytes) = kernel(depth, &left.compact_bytes(), &right.compact_bytes())?;
    first.write_output(
        first_bytes,
        left.rows(),
        left.columns(),
        left.channels(),
        depth,
    )?;
    second.write_output(
        second_bytes,
        left.rows(),
        left.columns(),
        left.channels(),
        depth,
    )?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    fn f32_mat(values: &[f32], rows: u32, columns: u32, channels: u16) -> Mat {
        Mat::from_owned_bytes(
            values.iter().flat_map(|v| v.to_ne_bytes()).collect(),
            rows,
            columns,
            channels,
            MatDepth::F32,
        )
        .unwrap()
    }
    fn f64_mat(values: &[f64], rows: u32, columns: u32, channels: u16) -> Mat {
        Mat::from_owned_bytes(
            values.iter().flat_map(|v| v.to_ne_bytes()).collect(),
            rows,
            columns,
            channels,
            MatDepth::F64,
        )
        .unwrap()
    }
    #[test]
    fn unary_dispatches_both_depths_and_compacts_roi() {
        let f64_source = f64_mat(&[1.0, 4.0, 9.0], 1, 3, 1);
        assert_eq!(
            unary(
                &f64_source,
                core_float_math::sqrt_f32,
                core_float_math::sqrt_f64
            )
            .unwrap()
            .to_f64_array()
            .unwrap(),
            [1.0, 2.0, 3.0]
        );
        let parent = f32_mat(&[0.0, 1.0, 4.0, 9.0, 16.0, 25.0], 2, 3, 1);
        let roi = parent.roi(0, 1, 2, 2).unwrap();
        assert!(!roi.is_continuous());
        assert_eq!(
            unary(&roi, core_float_math::sqrt_f32, core_float_math::sqrt_f64)
                .unwrap()
                .to_f32_array()
                .unwrap(),
            [1.0, 2.0, 4.0, 5.0]
        );
    }
    #[test]
    fn magnitude_preserves_interleaved_channels() {
        let x = f64_mat(&[3.0, 5.0, 8.0, 7.0], 1, 2, 2);
        let y = f64_mat(&[4.0, 12.0, 15.0, 24.0], 1, 2, 2);
        assert_eq!(
            binary(
                &x,
                &y,
                core_float_math::magnitude_f32,
                core_float_math::magnitude_f64
            )
            .unwrap()
            .to_f64_array()
            .unwrap(),
            [5.0, 13.0, 17.0, 25.0]
        );
    }
    #[test]
    fn exp_into_rebinds_an_incompatible_destination() {
        let source = f32_mat(&[0.0, 1.0], 1, 2, 1);
        let destination = f64_mat(&[99.0], 1, 1, 1);

        mat_exp_into(&source, &destination).expect("valid exponential destination");

        assert_eq!(
            (
                destination.rows(),
                destination.columns(),
                destination.channels(),
                destination.depth(),
            ),
            (1, 2, 1, MatDepth::F32)
        );
        assert_eq!(
            destination.to_f32_array().unwrap(),
            [1.0, std::f32::consts::E]
        );
    }
    #[test]
    fn exp_into_reads_partially_overlapping_rows_live() {
        let parent = f32_mat(&[0.0, 1.0, 2.0, 99.0, 0.0, 1.0, 2.0, 99.0], 2, 4, 1);
        let source = parent.roi(0, 0, 2, 3).unwrap();
        let destination = parent.roi(0, 1, 2, 3).unwrap();

        mat_exp_into(&source, &destination).expect("valid overlapping exponential destination");

        let actual = parent.to_f32_array().unwrap();
        for (actual, expected) in actual.into_iter().zip([
            0.0,
            1.0,
            2.718_281_7,
            15.154_262,
            0.0,
            1.0,
            2.718_281_7,
            15.154_262,
        ]) {
            assert!(
                (actual - expected).abs() <= 1e-5,
                "expected {expected}, got {actual}"
            );
        }
    }
    #[test]
    fn log_into_supports_exact_in_place_output() {
        let matrix = f64_mat(&[1.0, std::f64::consts::E.powi(2)], 1, 2, 1);

        mat_log_into(&matrix, &matrix).expect("valid in-place logarithm");

        let actual = matrix.to_f64_array().unwrap();
        assert!(actual[0].abs() <= f64::EPSILON);
        assert!((actual[1] - 2.0).abs() <= 1e-12);
    }
    #[test]
    fn sqrt_into_leaves_two_fresh_empty_headers_unchanged() {
        let source = crate::mat::mat_empty();
        let destination = crate::mat::mat_empty();

        mat_sqrt_into(&source, &destination).expect("fresh empty square root succeeds");

        assert_eq!(
            (
                destination.rows(),
                destination.columns(),
                destination.channels(),
                destination.depth(),
                destination.is_continuous(),
            ),
            (0, 0, 1, MatDepth::U8, false)
        );
    }
    #[test]
    fn sqrt_into_releases_a_populated_destination_but_retains_its_type() {
        let source = crate::mat::mat_empty();
        let destination = f32_mat(&[4.0, 9.0], 1, 2, 1);

        mat_sqrt_into(&source, &destination).expect("empty square root releases destination");

        assert_eq!(
            (
                destination.rows(),
                destination.columns(),
                destination.channels(),
                destination.depth(),
                destination.is_continuous(),
            ),
            (0, 0, 1, MatDepth::F32, true)
        );
        assert!(destination.compact_bytes().is_empty());
    }
    #[test]
    fn exp_into_preserves_a_typed_empty_source_layout() {
        let source = Mat::empty_with_layout(0, 3, 2, MatDepth::F32, true).unwrap();
        let destination = crate::mat::mat_empty();

        mat_exp_into(&source, &destination).expect("typed empty exponential succeeds");

        assert_eq!(
            (
                destination.rows(),
                destination.columns(),
                destination.channels(),
                destination.depth(),
                destination.is_continuous(),
            ),
            (0, 3, 2, MatDepth::F32, true)
        );
    }
    #[test]
    fn magnitude_into_reads_two_shared_inputs_atomically_and_live() {
        let parent = f32_mat(&[3.0, 4.0, 0.0, 0.0, 0.0], 1, 5, 1);
        let x = parent.roi(0, 0, 1, 3).unwrap();
        let y = parent.roi(0, 1, 1, 3).unwrap();
        let destination = parent.roi(0, 2, 1, 3).unwrap();

        mat_magnitude_into(&x, &y, &destination).expect("valid shared magnitude destination");

        let actual = parent.to_f32_array().unwrap();
        for (actual, expected) in actual
            .into_iter()
            .zip([3.0, 4.0, 5.0, 6.403_124_3, 8.124_039])
        {
            assert!(
                (actual - expected).abs() <= 1e-5,
                "expected {expected}, got {actual}"
            );
        }
    }
    #[test]
    fn magnitude_into_supports_exact_in_place_second_input() {
        let x = f64_mat(&[3.0, 5.0], 1, 2, 1);
        let y = f64_mat(&[4.0, 12.0], 1, 2, 1);

        mat_magnitude_into(&x, &y, &y).expect("valid in-place magnitude destination");

        assert_eq!(y.to_f64_array().unwrap(), [5.0, 13.0]);
    }
    #[test]
    fn pow_preserves_a_full_f64_exponent() {
        let source = f64_mat(&[2.0], 1, 1, 1);

        let output = mat_pow(&source, 2.000_000_01).expect("valid F64 power");

        let actual = output.to_f64_array().unwrap()[0];
        assert!((actual - 4.000_000_027_725_887).abs() <= 1e-15);
    }
    #[test]
    fn pow_allocates_every_integer_depth_with_native_conversion_rules() {
        let cases = [
            (MatDepth::U8, vec![20], vec![u8::MAX]),
            (
                MatDepth::I8,
                (-12_i8).to_ne_bytes().to_vec(),
                i8::MAX.to_ne_bytes().to_vec(),
            ),
            (
                MatDepth::U16,
                300_u16.to_ne_bytes().to_vec(),
                u16::MAX.to_ne_bytes().to_vec(),
            ),
            (
                MatDepth::I16,
                (-300_i16).to_ne_bytes().to_vec(),
                i16::MAX.to_ne_bytes().to_vec(),
            ),
            (
                MatDepth::I32,
                i32::MAX.to_ne_bytes().to_vec(),
                1_i32.to_ne_bytes().to_vec(),
            ),
        ];

        for (depth, input, expected) in cases {
            let source = Mat::from_owned_bytes(input, 1, 1, 1, depth).unwrap();
            let output = mat_pow(&source, 2.0).expect("valid integer power");
            assert_eq!(output.depth(), depth);
            assert_eq!(output.compact_bytes(), expected);
        }
    }
    #[test]
    fn pow_into_reads_overlapping_integer_sources_live() {
        let parent = Mat::from_owned_bytes(vec![2, 3, 4, 99], 1, 4, 1, MatDepth::U8).unwrap();
        let source = parent.roi(0, 0, 1, 3).unwrap();
        let destination = parent.roi(0, 1, 1, 3).unwrap();

        mat_pow_into(&source, 2.0, &destination).expect("valid shared integer power destination");

        assert_eq!(parent.compact_bytes(), [2, 4, 16, 255]);
    }
    #[test]
    fn pow_into_releases_a_populated_destination_for_a_fresh_empty_source() {
        let source = crate::mat::mat_empty();
        let destination = f64_mat(&[9.0], 1, 1, 1);

        mat_pow_into(&source, 2.0, &destination).expect("fresh empty power succeeds");

        assert_eq!(
            (
                destination.rows(),
                destination.columns(),
                destination.channels(),
                destination.depth(),
                destination.is_continuous(),
            ),
            (0, 0, 1, MatDepth::F64, true)
        );
    }
    #[test]
    fn pair_outputs_mutate_strided_destinations_and_round_trip() {
        let x = f32_mat(&[3.0, 0.0, -4.0, 0.0], 2, 2, 1);
        let y = f32_mat(&[4.0, 2.0, 0.0, -5.0], 2, 2, 1);
        let mag_parent = f32_mat(&[99.0; 6], 2, 3, 1);
        let angle_parent = f32_mat(&[99.0; 6], 2, 3, 1);
        let mag = mag_parent.roi(0, 0, 2, 2).unwrap();
        let angle = angle_parent.roi(0, 0, 2, 2).unwrap();
        pair_into(&x, &y, &mag, &angle, |d, a, b| match d {
            MatDepth::F32 => core_float_math::cart_to_polar_f32(a, b, false),
            _ => unreachable!(),
        })
        .unwrap();
        assert_eq!(
            mag_parent.to_f32_array().unwrap(),
            [5.0, 2.0, 99.0, 4.0, 5.0, 99.0]
        );
        let out_x = f32_mat(&[0.0; 4], 2, 2, 1);
        let out_y = f32_mat(&[0.0; 4], 2, 2, 1);
        pair_into(&mag, &angle, &out_x, &out_y, |d, a, b| match d {
            MatDepth::F32 => core_float_math::polar_to_cart_f32(a, b, false),
            _ => unreachable!(),
        })
        .unwrap();
        for (actual, expected) in out_x
            .to_f32_array()
            .unwrap()
            .into_iter()
            .zip([3.0, 0.0, -4.0, 0.0])
        {
            assert!((actual - expected).abs() < 1e-5);
        }
        for (actual, expected) in out_y
            .to_f32_array()
            .unwrap()
            .into_iter()
            .zip([4.0, 2.0, 0.0, -5.0])
        {
            assert!((actual - expected).abs() < 1e-5);
        }
    }
    #[test]
    fn cart_to_polar_rebinds_outputs_and_normalizes_negative_angles() {
        let x = f32_mat(&[0.0, 3.0], 1, 2, 1);
        let y = f32_mat(&[-1.0, 4.0], 1, 2, 1);
        let magnitude = f64_mat(&[99.0], 1, 1, 1);
        let angle = Mat::from_owned_bytes(vec![99], 1, 1, 1, MatDepth::U8).unwrap();

        pair_into(&x, &y, &magnitude, &angle, |depth, a, b| match depth {
            MatDepth::F32 => core_float_math::cart_to_polar_f32(a, b, true),
            MatDepth::F64 => core_float_math::cart_to_polar_f64(a, b, true),
            _ => unreachable!(),
        })
        .expect("valid Cartesian conversion destinations");

        assert_eq!(
            (
                magnitude.rows(),
                magnitude.columns(),
                magnitude.channels(),
                magnitude.depth(),
            ),
            (1, 2, 1, MatDepth::F32)
        );
        assert_eq!(magnitude.to_f32_array().unwrap(), [1.0, 5.0]);
        let angles = angle.to_f32_array().unwrap();
        assert!((angles[0] - 270.0).abs() < 1e-4);
        assert!((angles[1] - 53.130_104).abs() < 1e-4);
    }
    #[test]
    fn rejects_integer_depth_and_metadata_mismatch() {
        let integer = Mat::from_owned_bytes(vec![1], 1, 1, 1, MatDepth::U8).unwrap();
        assert!(matches!(
            unary(&integer, core_float_math::exp_f32, core_float_math::exp_f64),
            Err(FloatMathWasmError::FloatingPointDepthRequired(MatDepth::U8))
        ));
        let a = f32_mat(&[1.0, 2.0], 1, 2, 1);
        let b = f32_mat(&[1.0, 2.0], 2, 1, 1);
        assert!(matches!(
            binary(
                &a,
                &b,
                core_float_math::magnitude_f32,
                core_float_math::magnitude_f64
            ),
            Err(FloatMathWasmError::ShapeMismatch)
        ));
    }
}
