//! Element-wise floating-point math over compact native-endian byte buffers.
//!
//! These functions follow Rust's IEEE 754 math behavior. NaN values propagate through ordinary
//! operations. `log` returns negative infinity for zero and NaN for negative inputs. `sqrt`
//! returns NaN for negative inputs. Infinite inputs follow the matching standard-library method.

use std::{error::Error, fmt};

/// Validation failure for a compact floating-point operation.
#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) enum FloatMathError {
    /// A buffer ended partway through a scalar.
    IncorrectByteLength {
        /// Required byte width for one scalar.
        scalar_width: usize,
        /// Actual buffer length in bytes.
        actual: usize,
    },
    /// Two inputs held different numbers of scalars.
    LengthMismatch {
        /// Scalar count in the first input.
        left: usize,
        /// Scalar count in the second input.
        right: usize,
    },
}

impl fmt::Display for FloatMathError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::IncorrectByteLength {
                scalar_width,
                actual,
            } => write!(
                formatter,
                "floating-point buffer has {actual} bytes; length must be divisible by {scalar_width}"
            ),
            Self::LengthMismatch { left, right } => write!(
                formatter,
                "floating-point inputs have different lengths: {left} and {right} elements"
            ),
        }
    }
}

impl Error for FloatMathError {}

/// Applies the natural exponential to every compact F32 value.
pub(crate) fn exp_f32(input: &[u8]) -> Result<Vec<u8>, FloatMathError> {
    map_f32(input, f32::exp)
}

/// Applies the natural exponential to every compact F64 value.
pub(crate) fn exp_f64(input: &[u8]) -> Result<Vec<u8>, FloatMathError> {
    map_f64(input, f64::exp)
}

/// Applies the natural logarithm to every compact F32 value.
pub(crate) fn log_f32(input: &[u8]) -> Result<Vec<u8>, FloatMathError> {
    map_f32(input, f32::ln)
}

/// Applies the natural logarithm to every compact F64 value.
pub(crate) fn log_f64(input: &[u8]) -> Result<Vec<u8>, FloatMathError> {
    map_f64(input, f64::ln)
}

/// Applies the square root to every compact F32 value.
pub(crate) fn sqrt_f32(input: &[u8]) -> Result<Vec<u8>, FloatMathError> {
    map_f32(input, f32::sqrt)
}

/// Applies the square root to every compact F64 value.
pub(crate) fn sqrt_f64(input: &[u8]) -> Result<Vec<u8>, FloatMathError> {
    map_f64(input, f64::sqrt)
}

/// Raises every compact F32 value to one scalar exponent.
pub(crate) fn pow_f32(input: &[u8], exponent: f32) -> Result<Vec<u8>, FloatMathError> {
    map_f32(input, |value| value.powf(exponent))
}

/// Raises every compact F64 value to one scalar exponent.
pub(crate) fn pow_f64(input: &[u8], exponent: f64) -> Result<Vec<u8>, FloatMathError> {
    map_f64(input, |value| value.powf(exponent))
}

/// Computes `sqrt(x*x + y*y)` for matching compact F32 inputs.
pub(crate) fn magnitude_f32(x: &[u8], y: &[u8]) -> Result<Vec<u8>, FloatMathError> {
    zip_f32(x, y, |x, y| (x * x + y * y).sqrt())
}

/// Computes `sqrt(x*x + y*y)` for matching compact F64 inputs.
pub(crate) fn magnitude_f64(x: &[u8], y: &[u8]) -> Result<Vec<u8>, FloatMathError> {
    zip_f64(x, y, |x, y| (x * x + y * y).sqrt())
}

/// Converts matching Cartesian F32 coordinates to magnitude and angle.
///
/// Angles use radians unless `angle_in_degrees` is true. `atan2` supplies the signed angle range.
pub(crate) fn cart_to_polar_f32(
    x: &[u8],
    y: &[u8],
    angle_in_degrees: bool,
) -> Result<(Vec<u8>, Vec<u8>), FloatMathError> {
    transform_pairs_f32(x, y, |x_value, y_value| {
        let angle = y_value.atan2(x_value);
        (
            x_value.hypot(y_value),
            convert_angle_f32(angle, angle_in_degrees),
        )
    })
}

/// Converts matching Cartesian F64 coordinates to magnitude and angle.
///
/// Angles use radians unless `angle_in_degrees` is true. `atan2` supplies the signed angle range.
pub(crate) fn cart_to_polar_f64(
    x: &[u8],
    y: &[u8],
    angle_in_degrees: bool,
) -> Result<(Vec<u8>, Vec<u8>), FloatMathError> {
    transform_pairs_f64(x, y, |x_value, y_value| {
        let angle = y_value.atan2(x_value);
        (
            x_value.hypot(y_value),
            convert_angle_f64(angle, angle_in_degrees),
        )
    })
}

/// Converts matching F32 magnitude and angle inputs to Cartesian coordinates.
///
/// Angles use radians unless `angle_in_degrees` is true. Negative magnitudes retain their sign.
pub(crate) fn polar_to_cart_f32(
    magnitude: &[u8],
    angle: &[u8],
    angle_in_degrees: bool,
) -> Result<(Vec<u8>, Vec<u8>), FloatMathError> {
    transform_pairs_f32(magnitude, angle, |magnitude_value, angle_value| {
        let radians = convert_to_radians_f32(angle_value, angle_in_degrees);
        let (sine, cosine) = radians.sin_cos();
        (magnitude_value * cosine, magnitude_value * sine)
    })
}

/// Converts matching F64 magnitude and angle inputs to Cartesian coordinates.
///
/// Angles use radians unless `angle_in_degrees` is true. Negative magnitudes retain their sign.
pub(crate) fn polar_to_cart_f64(
    magnitude: &[u8],
    angle: &[u8],
    angle_in_degrees: bool,
) -> Result<(Vec<u8>, Vec<u8>), FloatMathError> {
    transform_pairs_f64(magnitude, angle, |magnitude_value, angle_value| {
        let radians = convert_to_radians_f64(angle_value, angle_in_degrees);
        let (sine, cosine) = radians.sin_cos();
        (magnitude_value * cosine, magnitude_value * sine)
    })
}

fn convert_angle_f32(angle: f32, degrees: bool) -> f32 {
    if degrees { angle.to_degrees() } else { angle }
}

fn convert_angle_f64(angle: f64, degrees: bool) -> f64 {
    if degrees { angle.to_degrees() } else { angle }
}

fn convert_to_radians_f32(angle: f32, degrees: bool) -> f32 {
    if degrees { angle.to_radians() } else { angle }
}

fn convert_to_radians_f64(angle: f64, degrees: bool) -> f64 {
    if degrees { angle.to_radians() } else { angle }
}

fn map_f32(input: &[u8], operation: impl Fn(f32) -> f32) -> Result<Vec<u8>, FloatMathError> {
    Ok(encode_f32(decode_f32(input)?.into_iter().map(operation)))
}

fn map_f64(input: &[u8], operation: impl Fn(f64) -> f64) -> Result<Vec<u8>, FloatMathError> {
    Ok(encode_f64(decode_f64(input)?.into_iter().map(operation)))
}

fn zip_f32(
    left: &[u8],
    right: &[u8],
    operation: impl Fn(f32, f32) -> f32,
) -> Result<Vec<u8>, FloatMathError> {
    let left = decode_f32(left)?;
    let right = decode_f32(right)?;
    require_matching_lengths(left.len(), right.len())?;
    Ok(encode_f32(
        left.into_iter().zip(right).map(|(a, b)| operation(a, b)),
    ))
}

fn zip_f64(
    left: &[u8],
    right: &[u8],
    operation: impl Fn(f64, f64) -> f64,
) -> Result<Vec<u8>, FloatMathError> {
    let left = decode_f64(left)?;
    let right = decode_f64(right)?;
    require_matching_lengths(left.len(), right.len())?;
    Ok(encode_f64(
        left.into_iter().zip(right).map(|(a, b)| operation(a, b)),
    ))
}

fn transform_pairs_f32(
    left: &[u8],
    right: &[u8],
    operation: impl Fn(f32, f32) -> (f32, f32),
) -> Result<(Vec<u8>, Vec<u8>), FloatMathError> {
    let left = decode_f32(left)?;
    let right = decode_f32(right)?;
    require_matching_lengths(left.len(), right.len())?;
    let pairs: Vec<_> = left
        .into_iter()
        .zip(right)
        .map(|(a, b)| operation(a, b))
        .collect();
    Ok((
        encode_f32(pairs.iter().map(|pair| pair.0)),
        encode_f32(pairs.iter().map(|pair| pair.1)),
    ))
}

fn transform_pairs_f64(
    left: &[u8],
    right: &[u8],
    operation: impl Fn(f64, f64) -> (f64, f64),
) -> Result<(Vec<u8>, Vec<u8>), FloatMathError> {
    let left = decode_f64(left)?;
    let right = decode_f64(right)?;
    require_matching_lengths(left.len(), right.len())?;
    let pairs: Vec<_> = left
        .into_iter()
        .zip(right)
        .map(|(a, b)| operation(a, b))
        .collect();
    Ok((
        encode_f64(pairs.iter().map(|pair| pair.0)),
        encode_f64(pairs.iter().map(|pair| pair.1)),
    ))
}

fn decode_f32(input: &[u8]) -> Result<Vec<f32>, FloatMathError> {
    validate_width(input, size_of::<f32>())?;
    Ok(input
        .chunks_exact(4)
        .map(|chunk| {
            let mut bytes = [0; 4];
            bytes.copy_from_slice(chunk);
            f32::from_ne_bytes(bytes)
        })
        .collect())
}

fn decode_f64(input: &[u8]) -> Result<Vec<f64>, FloatMathError> {
    validate_width(input, size_of::<f64>())?;
    Ok(input
        .chunks_exact(8)
        .map(|chunk| {
            let mut bytes = [0; 8];
            bytes.copy_from_slice(chunk);
            f64::from_ne_bytes(bytes)
        })
        .collect())
}

fn encode_f32(values: impl IntoIterator<Item = f32>) -> Vec<u8> {
    values.into_iter().flat_map(f32::to_ne_bytes).collect()
}

fn encode_f64(values: impl IntoIterator<Item = f64>) -> Vec<u8> {
    values.into_iter().flat_map(f64::to_ne_bytes).collect()
}

fn validate_width(input: &[u8], scalar_width: usize) -> Result<(), FloatMathError> {
    if input.len() % scalar_width != 0 {
        return Err(FloatMathError::IncorrectByteLength {
            scalar_width,
            actual: input.len(),
        });
    }
    Ok(())
}

fn require_matching_lengths(left: usize, right: usize) -> Result<(), FloatMathError> {
    if left != right {
        return Err(FloatMathError::LengthMismatch { left, right });
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{
        f32::consts::SQRT_2 as SQRT_2_F32,
        f64::consts::{FRAC_PI_2, FRAC_PI_3, SQRT_2 as SQRT_2_F64},
    };

    fn f32_bytes(values: &[f32]) -> Vec<u8> {
        encode_f32(values.iter().copied())
    }
    fn f64_bytes(values: &[f64]) -> Vec<u8> {
        encode_f64(values.iter().copied())
    }

    fn close_f32(actual: &[f32], expected: &[f32], tolerance: f32) {
        assert_eq!(actual.len(), expected.len());
        for (actual, expected) in actual.iter().zip(expected) {
            assert!(
                (actual - expected).abs() <= tolerance,
                "expected {expected}, got {actual}"
            );
        }
    }

    fn close_f64(actual: &[f64], expected: &[f64], tolerance: f64) {
        assert_eq!(actual.len(), expected.len());
        for (actual, expected) in actual.iter().zip(expected) {
            assert!(
                (actual - expected).abs() <= tolerance,
                "expected {expected}, got {actual}"
            );
        }
    }

    #[test]
    fn unary_f32_operations_match_worked_values() {
        close_f32(
            &decode_f32(&exp_f32(&f32_bytes(&[0.0, 1.0])).unwrap()).unwrap(),
            &[1.0, 2.718_281_7],
            1e-6,
        );
        close_f32(
            &decode_f32(&log_f32(&f32_bytes(&[1.0, 7.389_056])).unwrap()).unwrap(),
            &[0.0, 2.0],
            1e-6,
        );
        close_f32(
            &decode_f32(&sqrt_f32(&f32_bytes(&[0.0, 2.0, 9.0])).unwrap()).unwrap(),
            &[0.0, SQRT_2_F32, 3.0],
            1e-6,
        );
        close_f32(
            &decode_f32(&pow_f32(&f32_bytes(&[4.0, 9.0, 16.0]), 0.5).unwrap()).unwrap(),
            &[2.0, 3.0, 4.0],
            1e-6,
        );
    }

    #[test]
    fn unary_f64_operations_match_worked_values() {
        close_f64(
            &decode_f64(&exp_f64(&f64_bytes(&[0.0, 2.0])).unwrap()).unwrap(),
            &[1.0, 7.389_056_098_930_65],
            1e-12,
        );
        close_f64(
            &decode_f64(&log_f64(&f64_bytes(&[1.0, 20.085_536_923_187_668])).unwrap()).unwrap(),
            &[0.0, 3.0],
            1e-12,
        );
        close_f64(
            &decode_f64(&sqrt_f64(&f64_bytes(&[2.0, 25.0])).unwrap()).unwrap(),
            &[SQRT_2_F64, 5.0],
            1e-12,
        );
        close_f64(
            &decode_f64(&pow_f64(&f64_bytes(&[8.0, 27.0]), 1.0 / 3.0).unwrap()).unwrap(),
            &[2.0, 3.0],
            1e-12,
        );
    }

    #[test]
    fn magnitude_supports_both_depths() {
        assert_eq!(
            decode_f32(&magnitude_f32(&f32_bytes(&[3.0, 5.0]), &f32_bytes(&[4.0, 12.0])).unwrap())
                .unwrap(),
            [5.0, 13.0]
        );
        assert_eq!(
            decode_f64(&magnitude_f64(&f64_bytes(&[8.0, 7.0]), &f64_bytes(&[15.0, 24.0])).unwrap())
                .unwrap(),
            [17.0, 25.0]
        );
    }

    #[test]
    fn magnitude_preserves_direct_square_overflow_underflow_and_nan_ordering() {
        let large = f32::MAX / 2.0;
        let output = decode_f32(
            &magnitude_f32(
                &f32_bytes(&[large, f32::MIN_POSITIVE, f32::NAN]),
                &f32_bytes(&[large, f32::MIN_POSITIVE, f32::INFINITY]),
            )
            .unwrap(),
        )
        .unwrap();

        assert!(output[0].is_infinite() && output[0].is_sign_positive());
        assert_eq!(output[1], 0.0);
        assert!(output[2].is_nan());
    }

    #[test]
    fn cart_to_polar_supports_degrees_and_radians() {
        let (magnitude, angle) = cart_to_polar_f32(
            &f32_bytes(&[1.0, 0.0, -1.0]),
            &f32_bytes(&[0.0, 1.0, 0.0]),
            true,
        )
        .unwrap();
        assert_eq!(decode_f32(&magnitude).unwrap(), [1.0, 1.0, 1.0]);
        close_f32(&decode_f32(&angle).unwrap(), &[0.0, 90.0, 180.0], 1e-5);
        let (magnitude, angle) =
            cart_to_polar_f64(&f64_bytes(&[0.0]), &f64_bytes(&[2.0]), false).unwrap();
        assert_eq!(decode_f64(&magnitude).unwrap(), [2.0]);
        close_f64(&decode_f64(&angle).unwrap(), &[FRAC_PI_2], 1e-14);
    }

    #[test]
    fn polar_to_cart_supports_degrees_and_radians() {
        let (x, y) =
            polar_to_cart_f32(&f32_bytes(&[2.0, 3.0]), &f32_bytes(&[60.0, 180.0]), true).unwrap();
        close_f32(&decode_f32(&x).unwrap(), &[1.0, -3.0], 1e-5);
        close_f32(&decode_f32(&y).unwrap(), &[1.732_050_8, 0.0], 1e-5);
        let (x, y) =
            polar_to_cart_f64(&f64_bytes(&[2.0]), &f64_bytes(&[FRAC_PI_3]), false).unwrap();
        close_f64(&decode_f64(&x).unwrap(), &[1.0], 1e-14);
        close_f64(&decode_f64(&y).unwrap(), &[1.732_050_807_568_877_2], 1e-14);
    }

    #[test]
    fn ieee_domain_and_infinity_behavior_is_preserved() {
        let log = decode_f32(&log_f32(&f32_bytes(&[-1.0, 0.0])).unwrap()).unwrap();
        assert!(log[0].is_nan());
        assert!(log[1].is_infinite() && log[1].is_sign_negative());
        let sqrt = decode_f64(&sqrt_f64(&f64_bytes(&[-1.0, f64::INFINITY])).unwrap()).unwrap();
        assert!(sqrt[0].is_nan());
        assert!(sqrt[1].is_infinite() && sqrt[1].is_sign_positive());
        let exp =
            decode_f64(&exp_f64(&f64_bytes(&[f64::NEG_INFINITY, f64::INFINITY])).unwrap()).unwrap();
        assert_eq!(exp, [0.0, f64::INFINITY]);
        assert!(decode_f32(&pow_f32(&f32_bytes(&[-4.0]), 0.5).unwrap()).unwrap()[0].is_nan());
    }

    #[test]
    fn malformed_and_mismatched_buffers_are_rejected() {
        assert_eq!(
            exp_f32(&[0, 0, 0]).unwrap_err(),
            FloatMathError::IncorrectByteLength {
                scalar_width: 4,
                actual: 3
            }
        );
        assert_eq!(
            magnitude_f64(&f64_bytes(&[1.0, 2.0]), &f64_bytes(&[1.0])).unwrap_err(),
            FloatMathError::LengthMismatch { left: 2, right: 1 }
        );
        assert_eq!(
            polar_to_cart_f32(&f32_bytes(&[1.0]), &[0, 0, 0], false).unwrap_err(),
            FloatMathError::IncorrectByteLength {
                scalar_width: 4,
                actual: 3
            }
        );
    }

    #[test]
    fn empty_compact_inputs_produce_empty_outputs() {
        assert!(exp_f32(&[]).unwrap().is_empty());
        assert_eq!(cart_to_polar_f64(&[], &[], true).unwrap(), (vec![], vec![]));
    }
}
