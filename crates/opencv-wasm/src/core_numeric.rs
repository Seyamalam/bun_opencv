//! Depth-aware numeric operations.
//!
//! Integer results are rounded to nearest with ties-to-even and saturated. NaN maps to zero;
//! infinities saturate. Floating results retain IEEE-754 behavior. Integer division by zero is
//! zero. Inputs are snapshotted before destinations are written, making overlapping ROIs safe.

use crate::mat::{Mat, MatDepth, MatError};
use std::{error::Error, fmt};
use wasm_bindgen::prelude::*;

#[derive(Debug)]
enum NumericError {
    InputMetadata,
    DestinationMetadata,
    Matrix(MatError),
}
impl fmt::Display for NumericError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::InputMetadata => f.write_str("input matrix metadata must match"),
            Self::DestinationMetadata => {
                f.write_str("destination matrix metadata does not match the result")
            }
            Self::Matrix(e) => e.fmt(f),
        }
    }
}
impl Error for NumericError {}
impl From<MatError> for NumericError {
    fn from(e: MatError) -> Self {
        Self::Matrix(e)
    }
}

#[derive(Clone, Copy)]
enum Binary {
    Multiply,
    Divide,
}

#[wasm_bindgen(js_name = matMultiply)]
pub fn mat_multiply(a: &Mat, b: &Mat, scale: f64) -> Result<Mat, JsError> {
    binary(a, b, scale, Binary::Multiply).map_err(Into::into)
}
#[wasm_bindgen(js_name = matMultiplyInto)]
pub fn mat_multiply_into(a: &Mat, b: &Mat, dst: &Mat, scale: f64) -> Result<(), JsError> {
    binary_into(a, b, dst, scale, Binary::Multiply).map_err(Into::into)
}
#[wasm_bindgen(js_name = matDivide)]
pub fn mat_divide(a: &Mat, b: &Mat, scale: f64) -> Result<Mat, JsError> {
    binary(a, b, scale, Binary::Divide).map_err(Into::into)
}
#[wasm_bindgen(js_name = matDivideInto)]
pub fn mat_divide_into(a: &Mat, b: &Mat, dst: &Mat, scale: f64) -> Result<(), JsError> {
    binary_into(a, b, dst, scale, Binary::Divide).map_err(Into::into)
}
#[wasm_bindgen(js_name = matAddWeighted)]
pub fn mat_add_weighted(
    a: &Mat,
    alpha: f64,
    b: &Mat,
    beta: f64,
    gamma: f64,
) -> Result<Mat, JsError> {
    weighted(a, alpha, b, beta, gamma).map_err(Into::into)
}
#[wasm_bindgen(js_name = matAddWeightedInto)]
pub fn mat_add_weighted_into(
    a: &Mat,
    alpha: f64,
    b: &Mat,
    beta: f64,
    gamma: f64,
    dst: &Mat,
) -> Result<(), JsError> {
    ensure_dst(a, dst, a.depth()).map_err(JsError::from)?;
    let out = weighted(a, alpha, b, beta, gamma).map_err(JsError::from)?;
    dst.write_compact_bytes(&out.compact_bytes())
        .map_err(Into::into)
}
#[wasm_bindgen(js_name = matConvertScaleAbs)]
pub fn mat_convert_scale_abs(src: &Mat, alpha: f64, beta: f64) -> Result<Mat, JsError> {
    scale_abs(src, alpha, beta).map_err(Into::into)
}
#[wasm_bindgen(js_name = matConvertScaleAbsInto)]
pub fn mat_convert_scale_abs_into(
    src: &Mat,
    dst: &Mat,
    alpha: f64,
    beta: f64,
) -> Result<(), JsError> {
    ensure_dst(src, dst, MatDepth::U8).map_err(JsError::from)?;
    let out = scale_abs(src, alpha, beta).map_err(JsError::from)?;
    dst.write_compact_bytes(&out.compact_bytes())
        .map_err(Into::into)
}

fn matches(a: &Mat, b: &Mat) -> bool {
    a.rows() == b.rows()
        && a.columns() == b.columns()
        && a.channels() == b.channels()
        && a.depth() == b.depth()
}
fn ensure_dst(src: &Mat, dst: &Mat, depth: MatDepth) -> Result<(), NumericError> {
    if src.rows() == dst.rows()
        && src.columns() == dst.columns()
        && src.channels() == dst.channels()
        && dst.depth() == depth
    {
        Ok(())
    } else {
        Err(NumericError::DestinationMetadata)
    }
}
fn binary(a: &Mat, b: &Mat, scale: f64, op: Binary) -> Result<Mat, NumericError> {
    if !matches(a, b) {
        return Err(NumericError::InputMetadata);
    }
    let values = decode(&a.compact_bytes(), a.depth())
        .into_iter()
        .zip(decode(&b.compact_bytes(), b.depth()))
        .map(|(x, y)| match op {
            Binary::Multiply => x * y * scale,
            Binary::Divide if y == 0.0 && !matches!(a.depth(), MatDepth::F32 | MatDepth::F64) => {
                0.0
            }
            Binary::Divide => x * scale / y,
        });
    from_values(a, a.depth(), values)
}
fn binary_into(a: &Mat, b: &Mat, dst: &Mat, scale: f64, op: Binary) -> Result<(), NumericError> {
    if !matches(a, b) {
        return Err(NumericError::InputMetadata);
    }
    ensure_dst(a, dst, a.depth())?;
    let out = binary(a, b, scale, op)?;
    dst.write_compact_bytes(&out.compact_bytes())?;
    Ok(())
}
fn weighted(a: &Mat, alpha: f64, b: &Mat, beta: f64, gamma: f64) -> Result<Mat, NumericError> {
    if !matches(a, b) {
        return Err(NumericError::InputMetadata);
    }
    let values = decode(&a.compact_bytes(), a.depth())
        .into_iter()
        .zip(decode(&b.compact_bytes(), b.depth()))
        .map(|(x, y)| x * alpha + y * beta + gamma);
    from_values(a, a.depth(), values)
}
fn scale_abs(src: &Mat, alpha: f64, beta: f64) -> Result<Mat, NumericError> {
    let values = decode(&src.compact_bytes(), src.depth())
        .into_iter()
        .map(|x| (x * alpha + beta).abs());
    from_values(src, MatDepth::U8, values)
}
fn from_values(
    src: &Mat,
    depth: MatDepth,
    values: impl IntoIterator<Item = f64>,
) -> Result<Mat, NumericError> {
    Mat::from_owned_bytes(
        encode(values, depth),
        src.rows(),
        src.columns(),
        src.channels(),
        depth,
    )
    .map_err(Into::into)
}

fn decode(bytes: &[u8], depth: MatDepth) -> Vec<f64> {
    bytes
        .chunks_exact(depth.byte_width())
        .map(|c| match depth {
            MatDepth::U8 => f64::from(c[0]),
            MatDepth::I8 => f64::from(i8::from_ne_bytes([c[0]])),
            MatDepth::U16 => f64::from(u16::from_ne_bytes(c.try_into().expect("width"))),
            MatDepth::I16 => f64::from(i16::from_ne_bytes(c.try_into().expect("width"))),
            MatDepth::I32 => f64::from(i32::from_ne_bytes(c.try_into().expect("width"))),
            MatDepth::F32 => f64::from(f32::from_ne_bytes(c.try_into().expect("width"))),
            MatDepth::F64 => f64::from_ne_bytes(c.try_into().expect("width")),
        })
        .collect()
}
#[allow(clippy::cast_possible_truncation, clippy::cast_sign_loss)]
fn encode(values: impl IntoIterator<Item = f64>, depth: MatDepth) -> Vec<u8> {
    let mut out = Vec::new();
    for v in values {
        match depth {
            MatDepth::U8 => out.push(sat(v, 0.0, f64::from(u8::MAX)) as u8),
            MatDepth::I8 => out.extend_from_slice(
                &(sat(v, f64::from(i8::MIN), f64::from(i8::MAX)) as i8).to_ne_bytes(),
            ),
            MatDepth::U16 => {
                out.extend_from_slice(&(sat(v, 0.0, f64::from(u16::MAX)) as u16).to_ne_bytes());
            }
            MatDepth::I16 => out.extend_from_slice(
                &(sat(v, f64::from(i16::MIN), f64::from(i16::MAX)) as i16).to_ne_bytes(),
            ),
            MatDepth::I32 => out.extend_from_slice(
                &(sat(v, f64::from(i32::MIN), f64::from(i32::MAX)) as i32).to_ne_bytes(),
            ),
            MatDepth::F32 => out.extend_from_slice(&(v as f32).to_ne_bytes()),
            MatDepth::F64 => out.extend_from_slice(&v.to_ne_bytes()),
        }
    }
    out
}
fn sat(v: f64, min: f64, max: f64) -> f64 {
    if v.is_nan() {
        0.0
    } else {
        v.round_ties_even().clamp(min, max)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn mat(values: &[f64], depth: MatDepth, rows: u32, cols: u32) -> Mat {
        Mat::from_owned_bytes(encode(values.iter().copied(), depth), rows, cols, 1, depth).unwrap()
    }
    #[test]
    fn multiply_saturates_unsigned_bytes_after_scaling() {
        let a = mat(&[200.0, 4.0], MatDepth::U8, 1, 2);
        let b = mat(&[2.0, 3.0], MatDepth::U8, 1, 2);
        assert_eq!(
            binary(&a, &b, 1.0, Binary::Multiply)
                .unwrap()
                .compact_bytes(),
            vec![255, 12]
        );
    }
    #[test]
    fn integer_division_uses_ties_even_and_zero_rule() {
        let a = mat(&[1.0, 3.0, -3.0, 8.0], MatDepth::I16, 1, 4);
        let b = mat(&[2.0, 2.0, 2.0, 0.0], MatDepth::I16, 1, 4);
        let o = binary(&a, &b, 1.0, Binary::Divide).unwrap();
        assert_eq!(
            decode(&o.compact_bytes(), MatDepth::I16),
            vec![0.0, 2.0, -2.0, 0.0]
        );
    }
    #[test]
    fn weighted_supports_signed_and_float() {
        let left = mat(&[-30.0, 30.0], MatDepth::I16, 1, 2);
        let right = mat(&[10.0, 10.0], MatDepth::I16, 1, 2);
        let output = weighted(&left, 0.5, &right, 2.0, 1.0).unwrap();
        assert_eq!(
            decode(&output.compact_bytes(), MatDepth::I16),
            vec![6.0, 36.0]
        );
        let float_left = mat(&[2.0], MatDepth::F32, 1, 1);
        let float_right = mat(&[4.0], MatDepth::F32, 1, 1);
        assert_eq!(
            decode(
                &weighted(&float_left, 0.25, &float_right, 0.5, 0.5)
                    .unwrap()
                    .compact_bytes(),
                MatDepth::F32
            ),
            vec![3.0]
        );
    }
    #[test]
    fn scale_abs_accepts_all_depths_and_returns_u8() {
        for (d, input, expected) in [
            (MatDepth::U8, 10.0, 25),
            (MatDepth::I8, -10.0, 15),
            (MatDepth::U16, 10.0, 25),
            (MatDepth::I16, -10.0, 15),
            (MatDepth::I32, -10.0, 15),
            (MatDepth::F32, -10.0, 15),
            (MatDepth::F64, -10.0, 15),
        ] {
            let o = scale_abs(&mat(&[input], d, 1, 1), 2.0, 5.0).unwrap();
            assert_eq!(o.depth(), MatDepth::U8);
            assert_eq!(o.compact_bytes(), vec![expected]);
        }
    }
    #[test]
    fn strided_rois_read_and_write_without_touching_padding() {
        let p = mat(&[1., 2., 99., 3., 4., 99.], MatDepth::U8, 2, 3);
        let a = p.roi(0, 0, 2, 2).unwrap();
        let b = mat(&[2.; 4], MatDepth::U8, 2, 2);
        let dp = mat(&[7.; 6], MatDepth::U8, 2, 3);
        let d = dp.roi(0, 0, 2, 2).unwrap();
        binary_into(&a, &b, &d, 1., Binary::Multiply).unwrap();
        assert_eq!(dp.compact_bytes(), vec![2, 4, 7, 6, 8, 7]);
    }
    #[test]
    fn invalid_destination_is_not_mutated() {
        let a = mat(&[1., 2.], MatDepth::U8, 1, 2);
        let b = mat(&[2., 2.], MatDepth::U8, 1, 2);
        let d = mat(&[9.], MatDepth::U8, 1, 1);
        assert!(binary_into(&a, &b, &d, 1., Binary::Multiply).is_err());
        assert_eq!(d.compact_bytes(), vec![9]);
    }
}
