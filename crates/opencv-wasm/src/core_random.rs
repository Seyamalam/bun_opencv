//! Deterministic matrix initialization and random filling.

use std::{error::Error, fmt};

use crate::mat::{Mat, MatDepth, MatError};

const SPLITMIX64_INCREMENT: u64 = 0x9E37_79B9_7F4A_7C15;

#[derive(Debug, Clone)]
pub(crate) struct RandomGenerator {
    state: u64,
    spare_normal: Option<f64>,
}

impl RandomGenerator {
    pub(crate) const fn new(seed: u64) -> Self {
        Self {
            state: seed,
            spare_normal: None,
        }
    }

    pub(crate) fn next_u64(&mut self) -> u64 {
        self.state = self.state.wrapping_add(SPLITMIX64_INCREMENT);
        let mut value = self.state;
        value = (value ^ (value >> 30)).wrapping_mul(0xBF58_476D_1CE4_E5B9);
        value = (value ^ (value >> 27)).wrapping_mul(0x94D0_49BB_1331_11EB);
        value ^ (value >> 31)
    }

    #[allow(clippy::cast_precision_loss)]
    fn next_unit_f64(&mut self) -> f64 {
        const SCALE: f64 = 1.0 / 9_007_199_254_740_992.0;
        (self.next_u64() >> 11) as f64 * SCALE
    }

    #[allow(clippy::cast_precision_loss)]
    fn next_open_unit_f64(&mut self) -> f64 {
        const SCALE: f64 = 1.0 / 9_007_199_254_740_992.0;
        ((self.next_u64() >> 11) as f64 + 0.5) * SCALE
    }

    fn next_standard_normal(&mut self) -> f64 {
        if let Some(spare) = self.spare_normal.take() {
            return spare;
        }
        let radius = (-2.0 * self.next_open_unit_f64().ln()).sqrt();
        let angle = std::f64::consts::TAU * self.next_unit_f64();
        let (sine, cosine) = angle.sin_cos();
        self.spare_normal = Some(radius * sine);
        radius * cosine
    }
}

#[derive(Debug, Clone, PartialEq)]
pub(crate) enum RandomError {
    ScalarChannels {
        expected: usize,
        actual: usize,
    },
    InvalidUniformRange {
        channel: usize,
        lower: f64,
        upper: f64,
    },
    InvalidNormalParameters {
        channel: usize,
        mean: f64,
        standard_deviation: f64,
    },
    Matrix(MatError),
}

impl fmt::Display for RandomError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::ScalarChannels { expected, actual } => write!(
                formatter,
                "scalar has {actual} values; expected one or at least {expected}"
            ),
            Self::InvalidUniformRange {
                channel,
                lower,
                upper,
            } => write!(
                formatter,
                "uniform channel {channel} requires finite lower < upper; received [{lower}, {upper})"
            ),
            Self::InvalidNormalParameters {
                channel,
                mean,
                standard_deviation,
            } => write!(
                formatter,
                "normal channel {channel} requires a finite mean and non-negative finite standard deviation; received mean {mean} and standard deviation {standard_deviation}"
            ),
            Self::Matrix(error) => error.fmt(formatter),
        }
    }
}

impl Error for RandomError {
    fn source(&self) -> Option<&(dyn Error + 'static)> {
        match self {
            Self::Matrix(error) => Some(error),
            Self::ScalarChannels { .. }
            | Self::InvalidUniformRange { .. }
            | Self::InvalidNormalParameters { .. } => None,
        }
    }
}

pub(crate) fn fill_normal(
    destination: &Mat,
    means: &[f64],
    standard_deviations: &[f64],
    generator: &mut RandomGenerator,
) -> Result<(), RandomError> {
    let channels = usize::from(destination.channels());
    validate_scalar_channels(means, channels)?;
    validate_scalar_channels(standard_deviations, channels)?;
    for channel in 0..channels {
        let mean = scalar_lane(means, channel);
        let standard_deviation = scalar_lane(standard_deviations, channel);
        if !mean.is_finite() || !standard_deviation.is_finite() || standard_deviation < 0.0 {
            return Err(RandomError::InvalidNormalParameters {
                channel,
                mean,
                standard_deviation,
            });
        }
    }

    let scalar_width = destination.depth().byte_width();
    let scalar_count = logical_byte_length(destination) / scalar_width;
    let mut output = vec![0; scalar_count * scalar_width];
    for (index, bytes) in output.chunks_exact_mut(scalar_width).enumerate() {
        let channel = index % channels;
        let value = scalar_lane(means, channel)
            + scalar_lane(standard_deviations, channel) * generator.next_standard_normal();
        encode_scalar(value, destination.depth(), bytes);
    }
    destination.write_compact_bytes(&output)?;
    Ok(())
}

pub(crate) fn fill_uniform(
    destination: &Mat,
    lower: &[f64],
    upper: &[f64],
    generator: &mut RandomGenerator,
) -> Result<(), RandomError> {
    let channels = usize::from(destination.channels());
    validate_scalar_channels(lower, channels)?;
    validate_scalar_channels(upper, channels)?;
    for channel in 0..channels {
        let low = scalar_lane(lower, channel);
        let high = scalar_lane(upper, channel);
        if !low.is_finite() || !high.is_finite() || low >= high {
            return Err(RandomError::InvalidUniformRange {
                channel,
                lower: low,
                upper: high,
            });
        }
    }

    let scalar_width = destination.depth().byte_width();
    let scalar_count = logical_byte_length(destination) / scalar_width;
    let mut output = vec![0; scalar_count * scalar_width];
    for (index, bytes) in output.chunks_exact_mut(scalar_width).enumerate() {
        let channel = index % channels;
        let low = scalar_lane(lower, channel);
        let high = scalar_lane(upper, channel);
        let unit = generator.next_unit_f64();
        let value = low * (1.0 - unit) + high * unit;
        let converted = if matches!(destination.depth(), MatDepth::F32 | MatDepth::F64) {
            value
        } else {
            value.floor()
        };
        encode_scalar(converted, destination.depth(), bytes);
    }
    destination.write_compact_bytes(&output)?;
    Ok(())
}

impl From<MatError> for RandomError {
    fn from(error: MatError) -> Self {
        Self::Matrix(error)
    }
}

pub(crate) fn set_identity(destination: &Mat, values: &[f64]) -> Result<(), RandomError> {
    let channels = usize::from(destination.channels());
    validate_scalar_channels(values, channels)?;

    let mut output = vec![0; logical_byte_length(destination)];
    let diagonal = destination.rows().min(destination.columns()) as usize;
    let row_scalars = destination.columns() as usize * channels;
    let scalar_width = destination.depth().byte_width();
    for index in 0..diagonal {
        for channel in 0..channels {
            let value = values[if values.len() == 1 { 0 } else { channel }];
            let scalar = (index * row_scalars + index * channels) + channel;
            encode_scalar(
                value,
                destination.depth(),
                &mut output[scalar * scalar_width..(scalar + 1) * scalar_width],
            );
        }
    }
    destination.write_compact_bytes(&output)?;
    Ok(())
}

fn validate_scalar_channels(values: &[f64], channels: usize) -> Result<(), RandomError> {
    if values.len() == 1 || values.len() >= channels {
        Ok(())
    } else {
        Err(RandomError::ScalarChannels {
            expected: channels,
            actual: values.len(),
        })
    }
}

fn scalar_lane(values: &[f64], channel: usize) -> f64 {
    values[if values.len() == 1 { 0 } else { channel }]
}

fn logical_byte_length(matrix: &Mat) -> usize {
    usize::try_from(matrix.byte_length()).expect("matrix byte length always fits usize")
}

#[allow(
    clippy::cast_possible_truncation,
    clippy::cast_sign_loss,
    clippy::cast_lossless
)]
fn encode_scalar(value: f64, depth: MatDepth, output: &mut [u8]) {
    match depth {
        MatDepth::U8 => {
            output[0] = saturating_integer(value, u8::MIN as i128, u8::MAX as i128) as u8;
        }
        MatDepth::I8 => output.copy_from_slice(
            &(saturating_integer(value, i8::MIN as i128, i8::MAX as i128) as i8).to_ne_bytes(),
        ),
        MatDepth::U16 => output.copy_from_slice(
            &(saturating_integer(value, u16::MIN as i128, u16::MAX as i128) as u16).to_ne_bytes(),
        ),
        MatDepth::I16 => output.copy_from_slice(
            &(saturating_integer(value, i16::MIN as i128, i16::MAX as i128) as i16).to_ne_bytes(),
        ),
        MatDepth::I32 => output.copy_from_slice(
            &(saturating_integer(value, i32::MIN as i128, i32::MAX as i128) as i32).to_ne_bytes(),
        ),
        MatDepth::F32 => output.copy_from_slice(&(value as f32).to_ne_bytes()),
        MatDepth::F64 => output.copy_from_slice(&value.to_ne_bytes()),
    }
}

#[allow(clippy::cast_possible_truncation, clippy::cast_precision_loss)]
fn saturating_integer(value: f64, minimum: i128, maximum: i128) -> i128 {
    if value.is_nan() {
        return 0;
    }
    let rounded = value.round_ties_even();
    if rounded <= minimum as f64 {
        minimum
    } else if rounded >= maximum as f64 {
        maximum
    } else {
        rounded as i128
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::mat::{Mat, MatDepth};

    fn decode_one(bytes: &[u8], depth: MatDepth) -> f64 {
        match depth {
            MatDepth::U8 => f64::from(bytes[0]),
            MatDepth::I8 => f64::from(i8::from_ne_bytes([bytes[0]])),
            MatDepth::U16 => f64::from(u16::from_ne_bytes(bytes.try_into().expect("u16 width"))),
            MatDepth::I16 => f64::from(i16::from_ne_bytes(bytes.try_into().expect("i16 width"))),
            MatDepth::I32 => f64::from(i32::from_ne_bytes(bytes.try_into().expect("i32 width"))),
            MatDepth::F32 => f64::from(f32::from_ne_bytes(bytes.try_into().expect("f32 width"))),
            MatDepth::F64 => f64::from_ne_bytes(bytes.try_into().expect("f64 width")),
        }
    }

    #[test]
    fn identity_zeroes_off_diagonal_values_and_writes_each_channel() {
        let destination =
            Mat::from_owned_bytes(vec![99; 18], 2, 3, 3, MatDepth::U8).expect("valid destination");

        set_identity(&destination, &[1.0, 2.0, 3.0]).expect("valid identity");

        assert_eq!(
            destination.compact_bytes(),
            vec![1, 2, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 3, 0, 0, 0]
        );
    }

    #[test]
    fn identity_converts_values_for_every_scalar_depth() {
        let cases = [
            (MatDepth::U8, vec![2_u8]),
            (MatDepth::I8, (-2_i8).to_ne_bytes().to_vec()),
            (MatDepth::U16, 2_u16.to_ne_bytes().to_vec()),
            (MatDepth::I16, (-2_i16).to_ne_bytes().to_vec()),
            (MatDepth::I32, (-2_i32).to_ne_bytes().to_vec()),
            (MatDepth::F32, (-2.5_f32).to_ne_bytes().to_vec()),
            (MatDepth::F64, (-2.5_f64).to_ne_bytes().to_vec()),
        ];

        for (depth, expected) in cases {
            let destination = Mat::from_owned_bytes(vec![0; depth.byte_width()], 1, 1, 1, depth)
                .expect("valid destination");
            let value = if matches!(depth, MatDepth::U8 | MatDepth::U16) {
                2.5
            } else {
                -2.5
            };

            set_identity(&destination, &[value]).expect("supported depth");

            assert_eq!(destination.compact_bytes(), expected, "depth {depth:?}");
        }
    }

    #[test]
    fn generator_matches_the_published_splitmix64_sequence() {
        let mut generator = RandomGenerator::new(0);

        assert_eq!(generator.next_u64(), 0xE220_A839_7B1D_CDAF);
        assert_eq!(generator.next_u64(), 0x6E78_9E6A_A1B9_65F4);
    }

    #[test]
    fn uniform_fill_is_reproducible_and_uses_channel_ranges() {
        let first =
            Mat::from_owned_bytes(vec![0; 16], 2, 4, 2, MatDepth::U8).expect("valid destination");
        let second =
            Mat::from_owned_bytes(vec![0; 16], 2, 4, 2, MatDepth::U8).expect("valid destination");
        let mut first_generator = RandomGenerator::new(42);
        let mut second_generator = RandomGenerator::new(42);

        fill_uniform(&first, &[2.0, 200.0], &[7.0, 205.0], &mut first_generator)
            .expect("valid ranges");
        fill_uniform(&second, &[2.0, 200.0], &[7.0, 205.0], &mut second_generator)
            .expect("valid ranges");

        let first_bytes = first.compact_bytes();
        assert_eq!(first_bytes, second.compact_bytes());
        for pixel in first_bytes.chunks_exact(2) {
            assert!((2..7).contains(&pixel[0]));
            assert!((200..205).contains(&pixel[1]));
        }
    }

    #[test]
    fn normal_fill_supports_per_channel_constant_distributions() {
        let destination =
            Mat::from_owned_bytes(vec![99; 12], 2, 3, 2, MatDepth::U8).expect("valid destination");
        let mut generator = RandomGenerator::new(7);

        fill_normal(&destination, &[2.0, 200.0], &[0.0, 0.0], &mut generator)
            .expect("valid parameters");

        assert_eq!(
            destination.compact_bytes(),
            vec![2, 200, 2, 200, 2, 200, 2, 200, 2, 200, 2, 200]
        );
    }

    #[test]
    fn random_fills_support_every_scalar_depth() {
        for depth in [
            MatDepth::U8,
            MatDepth::I8,
            MatDepth::U16,
            MatDepth::I16,
            MatDepth::I32,
            MatDepth::F32,
            MatDepth::F64,
        ] {
            let destination = Mat::from_owned_bytes(vec![0; depth.byte_width()], 1, 1, 1, depth)
                .expect("valid destination");
            let (lower, upper) = if matches!(depth, MatDepth::U8 | MatDepth::U16) {
                (7.0, 8.0)
            } else {
                (-8.0, -7.0)
            };
            fill_uniform(
                &destination,
                &[lower],
                &[upper],
                &mut RandomGenerator::new(8),
            )
            .expect("supported uniform depth");
            let uniform = decode_one(&destination.compact_bytes(), depth);
            assert!(uniform >= lower && uniform < upper, "depth {depth:?}");

            fill_normal(&destination, &[3.0], &[0.0], &mut RandomGenerator::new(9))
                .expect("supported normal depth");
            assert_eq!(
                decode_one(&destination.compact_bytes(), depth).to_bits(),
                3.0_f64.to_bits()
            );
        }
    }

    #[test]
    fn all_initializers_write_through_strided_regions_without_touching_padding() {
        let identity_parent =
            Mat::from_owned_bytes(vec![9; 12], 3, 4, 1, MatDepth::U8).expect("valid parent");
        let identity_roi = identity_parent.roi(0, 1, 2, 2).expect("valid ROI");
        set_identity(&identity_roi, &[4.0]).expect("valid identity");
        assert_eq!(
            identity_parent.compact_bytes(),
            vec![9, 4, 0, 9, 9, 0, 4, 9, 9, 9, 9, 9]
        );

        let uniform_parent =
            Mat::from_owned_bytes(vec![9; 12], 3, 4, 1, MatDepth::U8).expect("valid parent");
        let uniform_roi = uniform_parent.roi(0, 1, 2, 2).expect("valid ROI");
        fill_uniform(&uniform_roi, &[7.0], &[8.0], &mut RandomGenerator::new(1))
            .expect("valid uniform fill");
        assert_eq!(
            uniform_parent.compact_bytes(),
            vec![9, 7, 7, 9, 9, 7, 7, 9, 9, 9, 9, 9]
        );

        let normal_parent =
            Mat::from_owned_bytes(vec![9; 12], 3, 4, 1, MatDepth::U8).expect("valid parent");
        let normal_roi = normal_parent.roi(0, 1, 2, 2).expect("valid ROI");
        fill_normal(&normal_roi, &[6.0], &[0.0], &mut RandomGenerator::new(1))
            .expect("valid normal fill");
        assert_eq!(
            normal_parent.compact_bytes(),
            vec![9, 6, 6, 9, 9, 6, 6, 9, 9, 9, 9, 9]
        );
    }

    #[test]
    fn rejected_parameters_leave_destination_and_generator_unchanged() {
        let destination =
            Mat::from_owned_bytes(vec![9; 4], 1, 4, 1, MatDepth::U8).expect("valid destination");
        let mut rejected_generator = RandomGenerator::new(55);
        let mut untouched_generator = RandomGenerator::new(55);

        assert!(matches!(
            fill_uniform(&destination, &[3.0], &[3.0], &mut rejected_generator),
            Err(RandomError::InvalidUniformRange { .. })
        ));
        assert!(matches!(
            fill_normal(&destination, &[0.0], &[-1.0], &mut rejected_generator),
            Err(RandomError::InvalidNormalParameters { .. })
        ));

        assert_eq!(destination.compact_bytes(), vec![9; 4]);
        assert_eq!(
            rejected_generator.next_u64(),
            untouched_generator.next_u64()
        );
    }
}
