//! Type-generic reductions over compact, row-major matrix bytes.
//!
//! Multi-byte scalars use native-endian encoding. This matches Rust typed-array memory in the
//! WASM adapter and avoids an endian conversion in the reduction loop. Callers that read a file or
//! network format must convert its byte order before calling this module.

use std::{error::Error, fmt};

/// Scalar storage depth understood by compact-byte reducers.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum ScalarDepth {
    /// Unsigned 8-bit integer.
    U8,
    /// Signed 8-bit integer.
    I8,
    /// Unsigned 16-bit integer.
    U16,
    /// Signed 16-bit integer.
    I16,
    /// Signed 32-bit integer.
    I32,
    /// IEEE 754 single-precision value.
    F32,
    /// IEEE 754 double-precision value.
    F64,
}

/// Failure returned when compact matrix metadata cannot be reduced safely.
#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) enum ReductionError {
    /// Rows or columns were zero.
    EmptyDimensions,
    /// The channel count was zero.
    EmptyChannels,
    /// Shape arithmetic exceeded the supported compact-buffer size.
    BufferSizeOverflow,
    /// The byte buffer did not match its declared matrix shape.
    IncorrectBufferLength { expected: usize, actual: usize },
    /// A compact U8 mask did not contain one byte per source pixel.
    IncorrectMaskLength { expected: usize, actual: usize },
    /// An operation requiring one channel received another channel count.
    SingleChannelRequired { actual: u16 },
    /// A four-lane channel result cannot represent the matrix channel count.
    TooManyChannels { actual: u16 },
}

impl fmt::Display for ReductionError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::EmptyDimensions => {
                formatter.write_str("matrix dimensions must be greater than zero")
            }
            Self::EmptyChannels => formatter.write_str("matrix channels must be greater than zero"),
            Self::BufferSizeOverflow => formatter.write_str("matrix byte length overflowed"),
            Self::IncorrectBufferLength { expected, actual } => write!(
                formatter,
                "matrix buffer has {actual} bytes; expected {expected} bytes"
            ),
            Self::IncorrectMaskLength { expected, actual } => write!(
                formatter,
                "mask buffer has {actual} bytes; expected {expected} bytes"
            ),
            Self::SingleChannelRequired { actual } => write!(
                formatter,
                "operation requires one channel; matrix has {actual} channels"
            ),
            Self::TooManyChannels { actual } => write!(
                formatter,
                "four-lane result supports at most four channels; matrix has {actual} channels"
            ),
        }
    }
}

impl Error for ReductionError {}

/// Zero-based location within a single-channel matrix.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) struct MatrixLocation {
    /// Row index.
    pub(crate) row: i32,
    /// Column index.
    pub(crate) column: i32,
}

/// Minimum and maximum values with their first row-major locations.
#[derive(Debug, Clone, Copy, PartialEq)]
pub(crate) struct MinMaxLocation {
    /// Minimum ordered value.
    pub(crate) minimum: f64,
    /// First row-major location of the minimum.
    pub(crate) minimum_location: MatrixLocation,
    /// Maximum ordered value.
    pub(crate) maximum: f64,
    /// First row-major location of the maximum.
    pub(crate) maximum_location: MatrixLocation,
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

/// Counts non-zero elements in a compact single-channel matrix.
///
/// Floating-point NaN values count as non-zero because they are not equal to zero.
pub(crate) fn count_non_zero(
    data: &[u8],
    rows: u32,
    columns: u32,
    channels: u16,
    depth: ScalarDepth,
) -> Result<u64, ReductionError> {
    if channels == 0 {
        return Err(ReductionError::EmptyChannels);
    }
    require_single_channel(channels)?;
    if rows == 0 || columns == 0 {
        return if data.is_empty() {
            Ok(0)
        } else {
            Err(ReductionError::IncorrectBufferLength {
                expected: 0,
                actual: data.len(),
            })
        };
    }
    let elements = validate_compact(data, rows, columns, channels, depth)?;

    let mut count = 0_u64;
    for index in 0..elements {
        if scalar_at(data, index, depth) != 0.0 {
            count += 1;
        }
    }
    Ok(count)
}

/// Sums each interleaved channel into a four-lane floating-point result.
///
/// Unused lanes are zero. NaN values propagate within their channel according to IEEE 754
/// addition. Matrices with more than four channels are rejected.
pub(crate) fn sum(
    data: &[u8],
    rows: u32,
    columns: u32,
    channels: u16,
    depth: ScalarDepth,
) -> Result<[f64; 4], ReductionError> {
    let elements = validate_compact(data, rows, columns, channels, depth)?;
    require_four_lane_result(channels)?;

    let mut output = [0.0; 4];
    let channel_count = usize::from(channels);
    for index in 0..elements {
        output[index % channel_count] += scalar_at(data, index, depth);
    }
    Ok(output)
}

/// Averages each interleaved channel into a four-lane floating-point result.
///
/// Unused lanes are zero. NaN values propagate within their channel. Matrices with more than four
/// channels are rejected.
pub(crate) fn mean(
    data: &[u8],
    rows: u32,
    columns: u32,
    channels: u16,
    depth: ScalarDepth,
) -> Result<[f64; 4], ReductionError> {
    mean_masked(data, rows, columns, channels, depth, None)
}

/// Averages each interleaved channel over pixels selected by an optional compact U8 mask.
pub(crate) fn mean_masked(
    data: &[u8],
    rows: u32,
    columns: u32,
    channels: u16,
    depth: ScalarDepth,
    mask: Option<&[u8]>,
) -> Result<[f64; 4], ReductionError> {
    require_four_lane_result(channels)?;
    if rows == 0 || columns == 0 {
        validate_empty(data, channels)?;
        validate_mask_length(mask, 0)?;
        return Ok([0.0; 4]);
    }
    let elements = validate_compact(data, rows, columns, channels, depth)?;
    let channel_count = usize::from(channels);
    let pixels = elements / channel_count;
    validate_mask_length(mask, pixels)?;

    let mut output = [0.0; 4];
    let mut selected = 0_u64;
    for pixel in 0..pixels {
        if mask.is_some_and(|values| values[pixel] == 0) {
            continue;
        }
        selected += 1;
        let first = pixel * channel_count;
        for channel in 0..channel_count {
            output[channel] += scalar_at(data, first + channel, depth);
        }
    }
    if selected != 0 {
        let scale = 1.0 / selected as f64;
        for value in output.iter_mut().take(channel_count) {
            *value *= scale;
        }
    }
    Ok(output)
}

/// Finds ordered extrema and their first row-major locations in a single-channel matrix.
///
/// NaN values are skipped. An all-NaN matrix returns [`ReductionError::AllValuesNaN`]. Strict
/// comparisons preserve the first location when multiple elements share an extreme value.
pub(crate) fn min_max_loc(
    data: &[u8],
    rows: u32,
    columns: u32,
    channels: u16,
    depth: ScalarDepth,
) -> Result<MinMaxLocation, ReductionError> {
    min_max_loc_masked(data, rows, columns, channels, depth, None)
}

/// Finds extrema and locations over pixels selected by an optional compact U8 mask.
pub(crate) fn min_max_loc_masked(
    data: &[u8],
    rows: u32,
    columns: u32,
    channels: u16,
    depth: ScalarDepth,
    mask: Option<&[u8]>,
) -> Result<MinMaxLocation, ReductionError> {
    require_single_channel(channels)?;
    if rows == 0 || columns == 0 {
        validate_empty(data, channels)?;
        validate_mask_length(mask, 0)?;
        return Ok(zero_min_max_location(0));
    }
    let elements = validate_compact(data, rows, columns, channels, depth)?;
    validate_mask_length(mask, elements)?;

    let mut extrema: Option<(f64, usize, f64, usize)> = None;
    for index in 0..elements {
        if mask.is_some_and(|values| values[index] == 0) {
            continue;
        }
        let value = scalar_at(data, index, depth);
        if value.is_nan() {
            continue;
        }

        match &mut extrema {
            None => extrema = Some((value, index, value, index)),
            Some((minimum, minimum_index, maximum, maximum_index)) => {
                if value < *minimum {
                    *minimum = value;
                    *minimum_index = index;
                }
                if value > *maximum {
                    *maximum = value;
                    *maximum_index = index;
                }
            }
        }
    }

    let Some((minimum, minimum_index, maximum, maximum_index)) = extrema else {
        return Ok(zero_min_max_location(-1));
    };
    Ok(MinMaxLocation {
        minimum,
        minimum_location: location_from_index(minimum_index, columns)?,
        maximum,
        maximum_location: location_from_index(maximum_index, columns)?,
    })
}

const fn zero_min_max_location(coordinate: i32) -> MinMaxLocation {
    MinMaxLocation {
        minimum: 0.0,
        minimum_location: MatrixLocation {
            row: coordinate,
            column: coordinate,
        },
        maximum: 0.0,
        maximum_location: MatrixLocation {
            row: coordinate,
            column: coordinate,
        },
    }
}

fn validate_empty(data: &[u8], channels: u16) -> Result<(), ReductionError> {
    if channels == 0 {
        return Err(ReductionError::EmptyChannels);
    }
    if data.is_empty() {
        Ok(())
    } else {
        Err(ReductionError::IncorrectBufferLength {
            expected: 0,
            actual: data.len(),
        })
    }
}

fn validate_mask_length(mask: Option<&[u8]>, pixels: usize) -> Result<(), ReductionError> {
    if let Some(mask) = mask {
        if mask.len() != pixels {
            return Err(ReductionError::IncorrectMaskLength {
                expected: pixels,
                actual: mask.len(),
            });
        }
    }
    Ok(())
}

/// Sums each channel along the main diagonal of a compact matrix.
///
/// Rectangular matrices use the shorter dimension. Floating-point NaN propagates through the
/// corresponding result lane according to IEEE 754 addition.
pub(crate) fn trace(
    data: &[u8],
    rows: u32,
    columns: u32,
    channels: u16,
    depth: ScalarDepth,
) -> Result<[f64; 4], ReductionError> {
    require_four_lane_result(channels)?;
    if rows == 0 || columns == 0 {
        validate_empty(data, channels)?;
        return Ok([0.0; 4]);
    }
    validate_compact(data, rows, columns, channels, depth)?;

    let diagonal =
        usize::try_from(rows.min(columns)).map_err(|_| ReductionError::BufferSizeOverflow)?;
    let columns = usize::try_from(columns).map_err(|_| ReductionError::BufferSizeOverflow)?;
    let channels = usize::from(channels);
    let mut output = [0.0; 4];
    for position in 0..diagonal {
        let first = (position * columns + position) * channels;
        for channel in 0..channels {
            output[channel] += scalar_at(data, first + channel, depth);
        }
    }
    Ok(output)
}

fn validate_compact(
    data: &[u8],
    rows: u32,
    columns: u32,
    channels: u16,
    depth: ScalarDepth,
) -> Result<usize, ReductionError> {
    if rows == 0 || columns == 0 {
        return Err(ReductionError::EmptyDimensions);
    }
    if channels == 0 {
        return Err(ReductionError::EmptyChannels);
    }

    let elements = u64::from(rows)
        .checked_mul(u64::from(columns))
        .and_then(|value| value.checked_mul(u64::from(channels)))
        .ok_or(ReductionError::BufferSizeOverflow)?;
    let expected = elements
        .checked_mul(depth.byte_width() as u64)
        .and_then(|value| usize::try_from(value).ok())
        .ok_or(ReductionError::BufferSizeOverflow)?;
    if data.len() != expected {
        return Err(ReductionError::IncorrectBufferLength {
            expected,
            actual: data.len(),
        });
    }

    usize::try_from(elements).map_err(|_| ReductionError::BufferSizeOverflow)
}

fn require_single_channel(channels: u16) -> Result<(), ReductionError> {
    if channels == 1 {
        Ok(())
    } else {
        Err(ReductionError::SingleChannelRequired { actual: channels })
    }
}

fn require_four_lane_result(channels: u16) -> Result<(), ReductionError> {
    if channels <= 4 {
        Ok(())
    } else {
        Err(ReductionError::TooManyChannels { actual: channels })
    }
}

fn location_from_index(index: usize, columns: u32) -> Result<MatrixLocation, ReductionError> {
    let columns = usize::try_from(columns).map_err(|_| ReductionError::BufferSizeOverflow)?;
    let row = i32::try_from(index / columns).map_err(|_| ReductionError::BufferSizeOverflow)?;
    let column = i32::try_from(index % columns).map_err(|_| ReductionError::BufferSizeOverflow)?;
    Ok(MatrixLocation { row, column })
}

fn scalar_at(data: &[u8], index: usize, depth: ScalarDepth) -> f64 {
    let start = index * depth.byte_width();
    match depth {
        ScalarDepth::U8 => f64::from(data[start]),
        ScalarDepth::I8 => f64::from(i8::from_ne_bytes([data[start]])),
        ScalarDepth::U16 => f64::from(u16::from_ne_bytes([data[start], data[start + 1]])),
        ScalarDepth::I16 => f64::from(i16::from_ne_bytes([data[start], data[start + 1]])),
        ScalarDepth::I32 => f64::from(i32::from_ne_bytes([
            data[start],
            data[start + 1],
            data[start + 2],
            data[start + 3],
        ])),
        ScalarDepth::F32 => f64::from(f32::from_ne_bytes([
            data[start],
            data[start + 1],
            data[start + 2],
            data[start + 3],
        ])),
        ScalarDepth::F64 => f64::from_ne_bytes([
            data[start],
            data[start + 1],
            data[start + 2],
            data[start + 3],
            data[start + 4],
            data[start + 5],
            data[start + 6],
            data[start + 7],
        ]),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn assert_exact_lanes(actual: [f64; 4], expected: [f64; 4]) {
        assert_eq!(actual.map(f64::to_bits), expected.map(f64::to_bits));
    }

    #[test]
    fn count_non_zero_decodes_each_integer_depth() {
        let cases = [
            (ScalarDepth::U8, vec![0, 1, 255], 2),
            (ScalarDepth::I8, vec![0, 255, 127], 2),
            (
                ScalarDepth::U16,
                [0_u16, 256, u16::MAX]
                    .into_iter()
                    .flat_map(u16::to_ne_bytes)
                    .collect(),
                2,
            ),
            (
                ScalarDepth::I16,
                [0_i16, -2, i16::MAX]
                    .into_iter()
                    .flat_map(i16::to_ne_bytes)
                    .collect(),
                2,
            ),
            (
                ScalarDepth::I32,
                [0_i32, i32::MIN, 42]
                    .into_iter()
                    .flat_map(i32::to_ne_bytes)
                    .collect(),
                2,
            ),
        ];

        for (depth, bytes, expected) in cases {
            assert_eq!(
                count_non_zero(&bytes, 1, 3, 1, depth).expect("valid compact matrix"),
                expected
            );
        }
    }

    #[test]
    fn reducers_decode_every_depth_from_native_endian_bytes() {
        let cases = [
            (ScalarDepth::U8, vec![7_u8], 7.0),
            (ScalarDepth::I8, (-7_i8).to_ne_bytes().to_vec(), -7.0),
            (ScalarDepth::U16, 513_u16.to_ne_bytes().to_vec(), 513.0),
            (ScalarDepth::I16, (-513_i16).to_ne_bytes().to_vec(), -513.0),
            (
                ScalarDepth::I32,
                (-70_001_i32).to_ne_bytes().to_vec(),
                -70_001.0,
            ),
            (ScalarDepth::F32, 1.25_f32.to_ne_bytes().to_vec(), 1.25),
            (ScalarDepth::F64, (-2.5_f64).to_ne_bytes().to_vec(), -2.5),
        ];

        for (depth, bytes, expected) in cases {
            assert_exact_lanes(
                sum(&bytes, 1, 1, 1, depth).expect("valid compact scalar"),
                [expected, 0.0, 0.0, 0.0],
            );
        }
    }

    #[test]
    fn sum_and_mean_reduce_interleaved_channels_into_four_lanes() {
        let bytes: Vec<u8> = [1_u16, 10, 100, 3, 30, 200]
            .into_iter()
            .flat_map(u16::to_ne_bytes)
            .collect();

        assert_exact_lanes(
            sum(&bytes, 1, 2, 3, ScalarDepth::U16).expect("valid compact matrix"),
            [4.0, 40.0, 300.0, 0.0],
        );
        assert_exact_lanes(
            mean(&bytes, 1, 2, 3, ScalarDepth::U16).expect("valid compact matrix"),
            [2.0, 20.0, 150.0, 0.0],
        );
    }

    #[test]
    fn min_max_location_uses_the_first_row_major_index_for_ties() {
        let bytes: Vec<u8> = [5_i16, -2, 9, -2, 9, 0]
            .into_iter()
            .flat_map(i16::to_ne_bytes)
            .collect();

        assert_eq!(
            min_max_loc(&bytes, 2, 3, 1, ScalarDepth::I16).expect("valid compact matrix"),
            MinMaxLocation {
                minimum: -2.0,
                minimum_location: MatrixLocation { row: 0, column: 1 },
                maximum: 9.0,
                maximum_location: MatrixLocation { row: 0, column: 2 },
            }
        );
    }

    #[test]
    fn trace_sums_every_channel_along_a_rectangular_diagonal() {
        let bytes: Vec<u8> = [
            1.0_f64, 10.0, 2.0, 20.0, 3.0, 30.0, 4.0, 40.0, 5.0, 50.0, 6.0, 60.0,
        ]
        .into_iter()
        .flat_map(f64::to_ne_bytes)
        .collect();

        assert_exact_lanes(
            trace(&bytes, 3, 2, 2, ScalarDepth::F64).expect("valid compact matrix"),
            [5.0, 50.0, 0.0, 0.0],
        );

        let widened = [
            16_777_216.0_f32,
            0.0,
            0.0,
            0.0,
            0.0,
            0.0,
            0.0,
            0.0,
            1.0,
            0.0,
            0.0,
            0.0,
            0.0,
            0.0,
            0.0,
            0.0,
            -16_777_216.0,
            0.0,
        ]
        .into_iter()
        .flat_map(f32::to_ne_bytes)
        .collect::<Vec<_>>();
        assert_exact_lanes(
            trace(&widened, 3, 3, 2, ScalarDepth::F32).expect("valid F32 matrix"),
            [1.0, 0.0, 0.0, 0.0],
        );
    }

    #[test]
    fn floating_point_nan_rule_is_consistent_across_reducers() {
        let bytes: Vec<u8> = [f32::NAN, 0.0, 2.0, -1.0]
            .into_iter()
            .flat_map(f32::to_ne_bytes)
            .collect();

        assert_eq!(
            count_non_zero(&bytes, 2, 2, 1, ScalarDepth::F32).expect("valid matrix"),
            3
        );
        assert!(sum(&bytes, 2, 2, 1, ScalarDepth::F32).expect("valid matrix")[0].is_nan());
        assert!(mean(&bytes, 2, 2, 1, ScalarDepth::F32).expect("valid matrix")[0].is_nan());
        assert!(trace(&bytes, 2, 2, 1, ScalarDepth::F32).expect("valid matrix")[0].is_nan());
        assert_eq!(
            min_max_loc(&bytes, 2, 2, 1, ScalarDepth::F32).expect("ordered values remain"),
            MinMaxLocation {
                minimum: -1.0,
                minimum_location: MatrixLocation { row: 1, column: 1 },
                maximum: 2.0,
                maximum_location: MatrixLocation { row: 1, column: 0 },
            }
        );

        let all_nan: Vec<u8> = [f64::NAN, f64::NAN]
            .into_iter()
            .flat_map(f64::to_ne_bytes)
            .collect();
        assert_eq!(
            min_max_loc(&all_nan, 1, 2, 1, ScalarDepth::F64),
            Ok(zero_min_max_location(-1))
        );
    }

    #[test]
    fn masked_mean_and_extrema_select_pixels_and_return_empty_sentinels() {
        let mean_bytes = [1_u16, 10, 100, 3, 30, 200]
            .into_iter()
            .flat_map(u16::to_ne_bytes)
            .collect::<Vec<_>>();
        assert_exact_lanes(
            mean_masked(&mean_bytes, 1, 2, 3, ScalarDepth::U16, Some(&[1, 0]))
                .expect("valid selective mask"),
            [1.0, 10.0, 100.0, 0.0],
        );
        assert_exact_lanes(
            mean_masked(&mean_bytes, 1, 2, 3, ScalarDepth::U16, Some(&[0, 0]))
                .expect("empty selection"),
            [0.0; 4],
        );
        assert_exact_lanes(
            mean_masked(&[], 0, 0, 1, ScalarDepth::U8, None).expect("empty matrix"),
            [0.0; 4],
        );
        let reciprocal_scaled =
            mean(&[5, 1, 9, 254, 9, 3], 2, 3, 1, ScalarDepth::I8).expect("valid matrix");
        assert_eq!(
            reciprocal_scaled[0].to_bits(),
            (25.0 * (1.0 / 6.0_f64)).to_bits()
        );

        let values = [5_i16, -2, 9, -2, 9, 4]
            .into_iter()
            .flat_map(i16::to_ne_bytes)
            .collect::<Vec<_>>();
        assert_eq!(
            min_max_loc_masked(
                &values,
                2,
                3,
                1,
                ScalarDepth::I16,
                Some(&[0, 1, 0, 1, 0, 1]),
            )
            .expect("valid selective mask"),
            MinMaxLocation {
                minimum: -2.0,
                minimum_location: MatrixLocation { row: 0, column: 1 },
                maximum: 4.0,
                maximum_location: MatrixLocation { row: 1, column: 2 },
            }
        );
        assert_eq!(
            min_max_loc_masked(&values, 2, 3, 1, ScalarDepth::I16, Some(&[0; 6]),),
            Ok(zero_min_max_location(-1))
        );
        assert_eq!(
            min_max_loc_masked(&[], 0, 0, 1, ScalarDepth::U8, None),
            Ok(zero_min_max_location(0))
        );
    }

    #[test]
    fn nan_propagation_is_limited_to_the_channel_that_contains_it() {
        let bytes: Vec<u8> = [f64::NAN, 2.0, 4.0, 6.0]
            .into_iter()
            .flat_map(f64::to_ne_bytes)
            .collect();

        let totals = sum(&bytes, 1, 2, 2, ScalarDepth::F64).expect("valid matrix");
        assert!(totals[0].is_nan());
        assert_eq!(totals[1].to_bits(), 8.0_f64.to_bits());

        let averages = mean(&bytes, 1, 2, 2, ScalarDepth::F64).expect("valid matrix");
        assert!(averages[0].is_nan());
        assert_eq!(averages[1].to_bits(), 4.0_f64.to_bits());
    }

    #[test]
    fn malformed_shapes_and_unsupported_channel_contracts_are_rejected() {
        assert_eq!(
            count_non_zero(&[1], 1, 1, 1, ScalarDepth::U16),
            Err(ReductionError::IncorrectBufferLength {
                expected: 2,
                actual: 1,
            })
        );
        assert_eq!(
            sum(&[0, 0], 1, 1, 1, ScalarDepth::U8),
            Err(ReductionError::IncorrectBufferLength {
                expected: 1,
                actual: 2,
            })
        );
        assert_eq!(
            count_non_zero(&[0, 1], 1, 1, 2, ScalarDepth::U8),
            Err(ReductionError::SingleChannelRequired { actual: 2 })
        );
        assert_eq!(
            sum(&[0; 5], 1, 1, 5, ScalarDepth::I8),
            Err(ReductionError::TooManyChannels { actual: 5 })
        );
        assert_eq!(trace(&[], 0, 1, 1, ScalarDepth::U8), Ok([0.0; 4]));
        assert_eq!(
            trace(&[], 1, 1, 0, ScalarDepth::U8),
            Err(ReductionError::EmptyChannels)
        );
        assert_eq!(
            trace(&[], u32::MAX, u32::MAX, u16::MAX, ScalarDepth::F64),
            Err(ReductionError::TooManyChannels { actual: u16::MAX })
        );
        assert_eq!(
            trace(&[], 0, 1, 5, ScalarDepth::U8),
            Err(ReductionError::TooManyChannels { actual: 5 })
        );
    }
}
