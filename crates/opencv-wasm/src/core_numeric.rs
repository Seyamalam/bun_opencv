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
    InvalidOutputDepth(i32),
    Matrix(MatError),
}
impl fmt::Display for NumericError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::InputMetadata => f.write_str("input matrix metadata must match"),
            Self::InvalidOutputDepth(depth) => write!(f, "unsupported output depth {depth}"),
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
pub fn mat_multiply_into(
    a: &Mat,
    b: &Mat,
    dst: &Mat,
    scale: f64,
    dtype: i32,
) -> Result<(), JsError> {
    binary_into(a, b, dst, scale, dtype, Binary::Multiply).map_err(Into::into)
}
#[wasm_bindgen(js_name = matDivide)]
pub fn mat_divide(a: &Mat, b: &Mat, scale: f64) -> Result<Mat, JsError> {
    binary(a, b, scale, Binary::Divide).map_err(Into::into)
}
#[wasm_bindgen(js_name = matDivideInto)]
pub fn mat_divide_into(a: &Mat, b: &Mat, dst: &Mat, scale: f64, dtype: i32) -> Result<(), JsError> {
    binary_into(a, b, dst, scale, dtype, Binary::Divide).map_err(Into::into)
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
    dtype: i32,
) -> Result<(), JsError> {
    let depth = output_depth(a.depth(), dtype).map_err(JsError::from)?;
    let out = weighted_with_depth(a, alpha, b, beta, gamma, depth).map_err(JsError::from)?;
    write_result(dst, &out).map_err(Into::into)
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
    let out = scale_abs(src, alpha, beta).map_err(JsError::from)?;
    write_result(dst, &out).map_err(Into::into)
}

fn matches(a: &Mat, b: &Mat) -> bool {
    a.rows() == b.rows()
        && a.columns() == b.columns()
        && a.channels() == b.channels()
        && a.depth() == b.depth()
}
fn output_depth(input: MatDepth, dtype: i32) -> Result<MatDepth, NumericError> {
    if dtype < 0 {
        return Ok(input);
    }
    match dtype & 7 {
        0 => Ok(MatDepth::U8),
        1 => Ok(MatDepth::I8),
        2 => Ok(MatDepth::U16),
        3 => Ok(MatDepth::I16),
        4 => Ok(MatDepth::I32),
        5 => Ok(MatDepth::F32),
        6 => Ok(MatDepth::F64),
        _ => Err(NumericError::InvalidOutputDepth(dtype)),
    }
}
fn binary(a: &Mat, b: &Mat, scale: f64, op: Binary) -> Result<Mat, NumericError> {
    binary_with_depth(a, b, scale, a.depth(), op)
}
fn binary_with_depth(
    a: &Mat,
    b: &Mat,
    scale: f64,
    depth: MatDepth,
    op: Binary,
) -> Result<Mat, NumericError> {
    if !matches(a, b) {
        return Err(NumericError::InputMetadata);
    }
    let values = decode(&a.compact_bytes(), a.depth())
        .into_iter()
        .zip(decode(&b.compact_bytes(), b.depth()))
        .map(|(x, y)| binary_value(x, y, scale, a.depth(), op));
    from_values(a, depth, values)
}
fn binary_into(
    a: &Mat,
    b: &Mat,
    dst: &Mat,
    scale: f64,
    dtype: i32,
    op: Binary,
) -> Result<(), NumericError> {
    if !matches(a, b) {
        return Err(NumericError::InputMetadata);
    }
    let depth = output_depth(a.depth(), dtype)?;
    if depth == a.depth()
        && dst.try_write_shared_binary_scalars(
            a,
            b,
            depth.byte_width(),
            |left, right, output| {
                let value = binary_value(
                    decode_scalar(left, depth),
                    decode_scalar(right, depth),
                    scale,
                    depth,
                    op,
                );
                encode_scalar(value, depth, output);
            },
        )?
    {
        return Ok(());
    }
    let out = binary_with_depth(a, b, scale, depth, op)?;
    write_result(dst, &out)
}

fn binary_value(x: f64, y: f64, scale: f64, depth: MatDepth, op: Binary) -> f64 {
    match op {
        Binary::Multiply => x * y * scale,
        Binary::Divide if y == 0.0 && !matches!(depth, MatDepth::F32 | MatDepth::F64) => 0.0,
        Binary::Divide => x * scale / y,
    }
}
fn weighted(a: &Mat, alpha: f64, b: &Mat, beta: f64, gamma: f64) -> Result<Mat, NumericError> {
    weighted_with_depth(a, alpha, b, beta, gamma, a.depth())
}
fn weighted_with_depth(
    a: &Mat,
    alpha: f64,
    b: &Mat,
    beta: f64,
    gamma: f64,
    depth: MatDepth,
) -> Result<Mat, NumericError> {
    if !matches(a, b) {
        return Err(NumericError::InputMetadata);
    }
    let values = decode(&a.compact_bytes(), a.depth())
        .into_iter()
        .zip(decode(&b.compact_bytes(), b.depth()))
        .map(|(x, y)| x * alpha + y * beta + gamma);
    from_values(a, depth, values)
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
    if src.rows() == 0 || src.columns() == 0 {
        return Mat::empty_with_layout(src.rows(), src.columns(), src.channels(), depth, true)
            .map_err(Into::into);
    }
    Mat::from_owned_bytes(
        encode(values, depth),
        src.rows(),
        src.columns(),
        src.channels(),
        depth,
    )
    .map_err(Into::into)
}

fn write_result(destination: &Mat, output: &Mat) -> Result<(), NumericError> {
    if output.rows() == 0 || output.columns() == 0 {
        destination.write_empty_layout(
            output.rows(),
            output.columns(),
            output.channels(),
            output.depth(),
            output.is_continuous(),
        )?;
        return Ok(());
    }
    destination.write_output(
        output.compact_bytes(),
        output.rows(),
        output.columns(),
        output.channels(),
        output.depth(),
    )?;
    Ok(())
}

fn decode(bytes: &[u8], depth: MatDepth) -> Vec<f64> {
    bytes
        .chunks_exact(depth.byte_width())
        .map(|bytes| decode_scalar(bytes, depth))
        .collect()
}

fn decode_scalar(bytes: &[u8], depth: MatDepth) -> f64 {
    match depth {
        MatDepth::U8 => f64::from(bytes[0]),
        MatDepth::I8 => f64::from(i8::from_ne_bytes([bytes[0]])),
        MatDepth::U16 => f64::from(u16::from_ne_bytes(bytes.try_into().expect("width"))),
        MatDepth::I16 => f64::from(i16::from_ne_bytes(bytes.try_into().expect("width"))),
        MatDepth::I32 => f64::from(i32::from_ne_bytes(bytes.try_into().expect("width"))),
        MatDepth::F32 => f64::from(f32::from_ne_bytes(bytes.try_into().expect("width"))),
        MatDepth::F64 => f64::from_ne_bytes(bytes.try_into().expect("width")),
    }
}

fn encode_scalar(value: f64, depth: MatDepth, output: &mut [u8]) {
    let encoded = encode([value], depth);
    output.copy_from_slice(&encoded);
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
        binary_into(&a, &b, &d, 1., -1, Binary::Multiply).unwrap();
        assert_eq!(dp.compact_bytes(), vec![2, 4, 7, 6, 8, 7]);
    }
    #[test]
    fn incompatible_destination_is_replaced() {
        let a = mat(&[1., 2.], MatDepth::U8, 1, 2);
        let b = mat(&[2., 2.], MatDepth::U8, 1, 2);
        let d = mat(&[9.], MatDepth::U8, 1, 1);
        binary_into(&a, &b, &d, 1., -1, Binary::Multiply).unwrap();
        assert_eq!((d.rows(), d.columns(), d.depth()), (1, 2, MatDepth::U8));
        assert_eq!(d.compact_bytes(), vec![2, 4]);
    }
    #[test]
    fn destination_dtype_changes_output_depth() {
        let a = mat(&[2., -4.], MatDepth::F32, 1, 2);
        let b = mat(&[4., 2.], MatDepth::F32, 1, 2);
        let d = Mat::empty_output();
        binary_into(&a, &b, &d, 0.5, 6, Binary::Multiply).unwrap();
        assert_eq!(d.depth(), MatDepth::F64);
        assert_eq!(decode(&d.compact_bytes(), MatDepth::F64), vec![4., -4.]);
    }
    #[test]
    fn dtype_uses_depth_bits_and_any_negative_value_preserves_input() {
        assert_eq!(output_depth(MatDepth::F32, -2).unwrap(), MatDepth::F32);
        assert_eq!(output_depth(MatDepth::F32, 14).unwrap(), MatDepth::F64);
        assert!(output_depth(MatDepth::F32, 255).is_err());
    }
    #[test]
    fn overlapping_destination_reads_inputs_live() {
        let parent = mat(&[1., 2., 3., 4., 5.], MatDepth::F32, 1, 5);
        let source = parent.roi(0, 0, 1, 3).unwrap();
        let destination = parent.roi(0, 1, 1, 3).unwrap();
        let multiplier = mat(&[3., 3., 3.], MatDepth::F32, 1, 3);
        binary_into(&source, &multiplier, &destination, 1., -1, Binary::Multiply).unwrap();
        assert_eq!(
            decode(&parent.compact_bytes(), MatDepth::F32),
            vec![1., 3., 9., 27., 5.]
        );
    }
}
