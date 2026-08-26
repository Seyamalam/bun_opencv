//! Per-element linear and projective transform kernels.

use std::{error::Error, fmt};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum ScalarDepth {
    U8,
    I8,
    U16,
    I16,
    I32,
    F32,
    F64,
}

impl ScalarDepth {
    const fn byte_width(self) -> usize {
        match self {
            Self::U8 | Self::I8 => 1,
            Self::U16 | Self::I16 => 2,
            Self::I32 | Self::F32 => 4,
            Self::F64 => 8,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) enum TransformError {
    InvalidCoefficientShape,
    InvalidSourceChannels(u16),
    InvalidPerspectiveChannels(u16),
    UnsupportedPerspectiveDepth(ScalarDepth),
    IncorrectSourceLength,
    SizeOverflow,
}

impl fmt::Display for TransformError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::InvalidCoefficientShape => {
                formatter.write_str("coefficient matrix shape does not match source channels")
            }
            Self::InvalidSourceChannels(channels) => write!(
                formatter,
                "linear transform source must have 1 to 4 channels; found {channels}"
            ),
            Self::InvalidPerspectiveChannels(channels) => write!(
                formatter,
                "perspective source must have 2 or 3 channels; found {channels}"
            ),
            Self::UnsupportedPerspectiveDepth(depth) => write!(
                formatter,
                "perspective source must have F32 or F64 depth; found {depth:?}"
            ),
            Self::IncorrectSourceLength => {
                formatter.write_str("source bytes do not contain complete interleaved pixels")
            }
            Self::SizeOverflow => formatter.write_str("transform output size exceeds the limit"),
        }
    }
}

pub(crate) fn perspective_transform_bytes(
    source: &[u8],
    depth: ScalarDepth,
    source_channels: u16,
    coefficients: &[f64],
    coefficient_rows: u16,
    coefficient_columns: u16,
) -> Result<Vec<u8>, TransformError> {
    if !matches!(depth, ScalarDepth::F32 | ScalarDepth::F64) {
        return Err(TransformError::UnsupportedPerspectiveDepth(depth));
    }
    if !matches!(source_channels, 2 | 3) {
        return Err(TransformError::InvalidPerspectiveChannels(source_channels));
    }
    let homogeneous_channels = source_channels
        .checked_add(1)
        .ok_or(TransformError::SizeOverflow)?;
    if coefficient_rows != homogeneous_channels
        || coefficient_columns != homogeneous_channels
        || coefficients.len()
            != usize::from(homogeneous_channels)
                .checked_mul(usize::from(homogeneous_channels))
                .ok_or(TransformError::SizeOverflow)?
    {
        return Err(TransformError::InvalidCoefficientShape);
    }

    let source_channels = usize::from(source_channels);
    let scalar_width = depth.byte_width();
    let pixel_width = source_channels
        .checked_mul(scalar_width)
        .ok_or(TransformError::SizeOverflow)?;
    if source.len() % pixel_width != 0 {
        return Err(TransformError::IncorrectSourceLength);
    }
    let coefficient_columns = usize::from(coefficient_columns);
    let mut output = Vec::new();
    output
        .try_reserve_exact(source.len())
        .map_err(|_| TransformError::SizeOverflow)?;
    for pixel in source.chunks_exact(pixel_width) {
        let mut components = [0.0; 3];
        for (component, value) in components[..source_channels].iter_mut().enumerate() {
            *value = decode_scalar(&pixel[component * scalar_width..], depth);
        }
        let denominator_row = &coefficients[source_channels * coefficient_columns..];
        let mut denominator = denominator_row[source_channels];
        for (component, &coefficient) in denominator_row[..source_channels].iter().enumerate() {
            denominator += coefficient * components[component];
        }
        if denominator.is_nan() || denominator.abs() <= f64::from(f32::EPSILON) {
            for _ in 0..source_channels {
                encode_scalar(0.0, depth, &mut output);
            }
            continue;
        }
        let inverse_denominator = denominator.recip();
        for row in
            coefficients[..source_channels * coefficient_columns].chunks_exact(coefficient_columns)
        {
            let mut numerator = row[source_channels];
            for (component, &coefficient) in row[..source_channels].iter().enumerate() {
                numerator += coefficient * components[component];
            }
            encode_scalar(numerator * inverse_denominator, depth, &mut output);
        }
    }
    Ok(output)
}

impl Error for TransformError {}

pub(crate) fn transform_bytes(
    source: &[u8],
    depth: ScalarDepth,
    source_channels: u16,
    coefficients: &[f64],
    coefficient_rows: u16,
    coefficient_columns: u16,
) -> Result<Vec<u8>, TransformError> {
    if !(1..=4).contains(&source_channels) {
        return Err(TransformError::InvalidSourceChannels(source_channels));
    }
    let source_channels = usize::from(source_channels);
    let coefficient_rows = usize::from(coefficient_rows);
    let coefficient_columns = usize::from(coefficient_columns);
    let expected_coefficients = coefficient_rows
        .checked_mul(coefficient_columns)
        .ok_or(TransformError::SizeOverflow)?;
    if coefficient_rows == 0
        || !matches!(coefficient_columns, value if value == source_channels || value == source_channels + 1)
        || coefficients.len() != expected_coefficients
    {
        return Err(TransformError::InvalidCoefficientShape);
    }
    let pixel_width = source_channels
        .checked_mul(depth.byte_width())
        .ok_or(TransformError::SizeOverflow)?;
    if source.len() % pixel_width != 0 {
        return Err(TransformError::IncorrectSourceLength);
    }

    let pixel_count = source.len() / pixel_width;
    let output_length = pixel_count
        .checked_mul(coefficient_rows)
        .and_then(|length| length.checked_mul(depth.byte_width()))
        .ok_or(TransformError::SizeOverflow)?;
    let mut output = Vec::new();
    output
        .try_reserve_exact(output_length)
        .map_err(|_| TransformError::SizeOverflow)?;
    let has_bias = coefficient_columns == source_channels + 1;
    for pixel in source.chunks_exact(pixel_width) {
        let mut components = [0.0; 4];
        for (component, value) in components[..source_channels].iter_mut().enumerate() {
            *value = decode_scalar(&pixel[component * depth.byte_width()..], depth);
        }
        for row in coefficients.chunks_exact(coefficient_columns) {
            let mut value = if has_bias { row[source_channels] } else { 0.0 };
            for (component, &coefficient) in row.iter().take(source_channels).enumerate() {
                value += coefficient * components[component];
            }
            encode_scalar(value, depth, &mut output);
        }
    }
    Ok(output)
}

fn decode_scalar(bytes: &[u8], depth: ScalarDepth) -> f64 {
    match depth {
        ScalarDepth::U8 => f64::from(bytes[0]),
        ScalarDepth::I8 => f64::from(i8::from_ne_bytes([bytes[0]])),
        ScalarDepth::U16 => f64::from(u16::from_ne_bytes(
            bytes[..2].try_into().expect("validated scalar width"),
        )),
        ScalarDepth::I16 => f64::from(i16::from_ne_bytes(
            bytes[..2].try_into().expect("validated scalar width"),
        )),
        ScalarDepth::I32 => f64::from(i32::from_ne_bytes(
            bytes[..4].try_into().expect("validated scalar width"),
        )),
        ScalarDepth::F32 => f64::from(f32::from_ne_bytes(
            bytes[..4].try_into().expect("validated scalar width"),
        )),
        ScalarDepth::F64 => {
            f64::from_ne_bytes(bytes[..8].try_into().expect("validated scalar width"))
        }
    }
}

#[allow(clippy::cast_possible_truncation, clippy::cast_sign_loss)]
fn encode_scalar(value: f64, depth: ScalarDepth, output: &mut Vec<u8>) {
    match depth {
        ScalarDepth::U8 => output.push(saturate(value, 0.0, f64::from(u8::MAX)) as u8),
        ScalarDepth::I8 => output.extend_from_slice(
            &(saturate(value, f64::from(i8::MIN), f64::from(i8::MAX)) as i8).to_ne_bytes(),
        ),
        ScalarDepth::U16 => output
            .extend_from_slice(&(saturate(value, 0.0, f64::from(u16::MAX)) as u16).to_ne_bytes()),
        ScalarDepth::I16 => output.extend_from_slice(
            &(saturate(value, f64::from(i16::MIN), f64::from(i16::MAX)) as i16).to_ne_bytes(),
        ),
        ScalarDepth::I32 => output.extend_from_slice(
            &(saturate(value, f64::from(i32::MIN), f64::from(i32::MAX)) as i32).to_ne_bytes(),
        ),
        ScalarDepth::F32 => output.extend_from_slice(&(value as f32).to_ne_bytes()),
        ScalarDepth::F64 => output.extend_from_slice(&value.to_ne_bytes()),
    }
}

fn saturate(value: f64, minimum: f64, maximum: f64) -> f64 {
    if value.is_nan() {
        return 0.0;
    }
    value.round_ties_even().clamp(minimum, maximum)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn affine_transform_converts_rgb_to_two_channels_with_bias() {
        let source = [10, 20, 30, 100, 110, 120];
        let coefficients = [0.5, 0.25, 0.0, 1.0, -1.0, 0.0, 1.0, 5.0];

        let output = transform_bytes(&source, ScalarDepth::U8, 3, &coefficients, 2, 4)
            .expect("valid affine transform");

        assert_eq!(output, [11, 25, 78, 25]);
    }

    #[test]
    fn linear_transform_supports_every_matrix_depth() {
        let coefficients = [2.0, -1.0];
        let cases = [
            (ScalarDepth::U8, vec![3, 1], vec![5]),
            (
                ScalarDepth::I8,
                (-3_i8)
                    .to_ne_bytes()
                    .into_iter()
                    .chain(1_i8.to_ne_bytes())
                    .collect(),
                (-7_i8).to_ne_bytes().to_vec(),
            ),
            (
                ScalarDepth::U16,
                scalar_bytes(&[30_u16, 5]),
                scalar_bytes(&[55_u16]),
            ),
            (
                ScalarDepth::I16,
                scalar_bytes(&[-30_i16, 5]),
                scalar_bytes(&[-65_i16]),
            ),
            (
                ScalarDepth::I32,
                scalar_bytes(&[30_000_i32, 5]),
                scalar_bytes(&[59_995_i32]),
            ),
            (
                ScalarDepth::F32,
                scalar_bytes(&[1.25_f32, 0.5]),
                scalar_bytes(&[2.0_f32]),
            ),
            (
                ScalarDepth::F64,
                scalar_bytes(&[1.25_f64, 0.5]),
                scalar_bytes(&[2.0_f64]),
            ),
        ];

        for (depth, source, expected) in cases {
            assert_eq!(
                transform_bytes(&source, depth, 2, &coefficients, 1, 2)
                    .expect("valid linear transform"),
                expected,
                "failed for {depth:?}",
            );
        }
    }

    #[test]
    fn perspective_transform_divides_each_two_dimensional_point_by_w() {
        let source = scalar_bytes(&[2.0_f64, 4.0, 10.0, -2.0]);
        let coefficients = [2.0, 0.0, 4.0, 0.0, 3.0, -1.0, 0.5, 0.0, 1.0];

        let output = perspective_transform_bytes(&source, ScalarDepth::F64, 2, &coefficients, 3, 3)
            .expect("valid perspective transform");

        assert_eq!(
            output,
            scalar_bytes(&[4.0_f64, 5.5, 4.0, -1.166_666_666_666_666_5]),
        );
    }

    #[test]
    fn transform_rejects_more_than_four_source_channels() {
        assert_eq!(
            transform_bytes(
                &[1, 2, 3, 4, 5],
                ScalarDepth::U8,
                5,
                &[1.0, 1.0, 1.0, 1.0, 1.0],
                1,
                5,
            ),
            Err(TransformError::InvalidSourceChannels(5)),
        );
    }

    #[test]
    fn perspective_transform_maps_unusable_denominators_to_zero_vectors() {
        let source = scalar_bytes(&[0.0_f32, 5.0, f32::EPSILON / 2.0, 5.0, f32::NAN, 5.0]);
        let coefficients = [1.0, 0.0, 0.0, 0.0, 1.0, 0.0, 1.0, 0.0, 0.0];

        let output = perspective_transform_bytes(&source, ScalarDepth::F32, 2, &coefficients, 3, 3)
            .expect("valid perspective transform");

        assert_eq!(output, scalar_bytes(&[0.0_f32; 6]));
    }

    fn scalar_bytes<T>(values: &[T]) -> Vec<u8>
    where
        T: Copy + TestScalar,
    {
        values.iter().flat_map(|value| value.bytes()).collect()
    }

    trait TestScalar {
        type Bytes: IntoIterator<Item = u8>;
        fn bytes(self) -> Self::Bytes;
    }

    macro_rules! test_scalar {
        ($kind:ty) => {
            impl TestScalar for $kind {
                type Bytes = [u8; size_of::<Self>()];
                fn bytes(self) -> Self::Bytes {
                    self.to_ne_bytes()
                }
            }
        };
    }

    test_scalar!(u16);
    test_scalar!(i16);
    test_scalar!(i32);
    test_scalar!(f32);
    test_scalar!(f64);
}
