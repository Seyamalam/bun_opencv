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

macro_rules! unary_export {
    ($name:ident, $js:literal, $f32:ident, $f64:ident, $doc:literal) => {
        #[doc = $doc]
        ///
        /// # Errors
        /// Returns an error unless the source has F32 or F64 depth.
        #[wasm_bindgen(js_name = $js)]
        pub fn $name(source: &Mat) -> Result<Mat, JsError> {
            unary(source, core_float_math::$f32, core_float_math::$f64).map_err(JsError::from)
        }
    };
}
unary_export!(
    mat_exp,
    "matExp",
    exp_f32,
    exp_f64,
    "Computes the natural exponential element-wise."
);
unary_export!(
    mat_log,
    "matLog",
    log_f32,
    log_f64,
    "Computes the natural logarithm element-wise."
);
unary_export!(
    mat_sqrt,
    "matSqrt",
    sqrt_f32,
    sqrt_f64,
    "Computes the square root element-wise."
);

/// Raises every element to a scalar exponent.
/// # Errors
/// Returns an error unless the source has F32 or F64 depth.
#[wasm_bindgen(js_name = matPow)]
pub fn mat_pow(source: &Mat, exponent: f32) -> Result<Mat, JsError> {
    unary_with(source, |depth, bytes| match depth {
        MatDepth::F32 => core_float_math::pow_f32(bytes, exponent),
        MatDepth::F64 => core_float_math::pow_f64(bytes, f64::from(exponent)),
        _ => unreachable!(),
    })
    .map_err(JsError::from)
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
fn unary_with(
    source: &Mat,
    kernel: impl FnOnce(MatDepth, &[u8]) -> Result<Vec<u8>, FloatMathError>,
) -> Result<Mat, FloatMathWasmError> {
    let depth = float_depth(source)?;
    from_bytes(source, kernel(depth, &source.compact_bytes())?)
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
fn pair_into(
    left: &Mat,
    right: &Mat,
    first: &Mat,
    second: &Mat,
    kernel: impl FnOnce(MatDepth, &[u8], &[u8]) -> Result<(Vec<u8>, Vec<u8>), FloatMathError>,
) -> Result<(), FloatMathWasmError> {
    let depth = float_depth(left)?;
    if !matches(left, right) || !matches(left, first) || !matches(left, second) {
        return Err(FloatMathWasmError::ShapeMismatch);
    }
    let (first_bytes, second_bytes) = kernel(depth, &left.compact_bytes(), &right.compact_bytes())?;
    first.write_compact_bytes(&first_bytes)?;
    second.write_compact_bytes(&second_bytes)?;
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
