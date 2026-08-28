use std::{error::Error, fmt};

use crate::mat::{Mat, MatDepth, MatError};

pub(crate) const THRESH_BINARY: i32 = 0;
pub(crate) const THRESH_BINARY_INVERSE: i32 = 1;
pub(crate) const THRESH_TRUNCATE: i32 = 2;
pub(crate) const THRESH_TO_ZERO: i32 = 3;
pub(crate) const THRESH_TO_ZERO_INVERSE: i32 = 4;
pub(crate) const THRESH_MODE_MASK: i32 = 7;
pub(crate) const THRESH_OTSU: i32 = 8;
pub(crate) const THRESH_TRIANGLE: i32 = 16;

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) enum ThresholdError {
    EmptySource,
    InvalidMode(i32),
    Matrix(MatError),
    OtsuRequiresSingleChannel,
    UnsupportedAutomaticMode(i32),
    UnsupportedDepth(MatDepth),
}

impl fmt::Display for ThresholdError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::EmptySource => formatter.write_str("threshold source must not be empty"),
            Self::InvalidMode(mode) => write!(formatter, "unsupported threshold mode {mode}"),
            Self::Matrix(error) => error.fmt(formatter),
            Self::OtsuRequiresSingleChannel => {
                formatter.write_str("Otsu thresholding requires a single-channel U8 matrix")
            }
            Self::UnsupportedAutomaticMode(mode) => {
                write!(formatter, "unsupported automatic threshold flags {mode}")
            }
            Self::UnsupportedDepth(depth) => {
                write!(formatter, "threshold depth {depth:?} is not implemented")
            }
        }
    }
}

impl Error for ThresholdError {
    fn source(&self) -> Option<&(dyn Error + 'static)> {
        match self {
            Self::Matrix(error) => Some(error),
            _ => None,
        }
    }
}

impl From<MatError> for ThresholdError {
    fn from(error: MatError) -> Self {
        Self::Matrix(error)
    }
}

pub(crate) fn threshold_into(
    source: &Mat,
    destination: &Mat,
    threshold: f64,
    maximum: f64,
    threshold_type: i32,
) -> Result<f64, ThresholdError> {
    if source.rows() == 0 || source.columns() == 0 {
        return Err(ThresholdError::EmptySource);
    }
    if source.depth() != MatDepth::U8 {
        return Err(ThresholdError::UnsupportedDepth(source.depth()));
    }
    let mode = threshold_type & THRESH_MODE_MASK;
    if !matches!(
        mode,
        THRESH_BINARY
            | THRESH_BINARY_INVERSE
            | THRESH_TRUNCATE
            | THRESH_TO_ZERO
            | THRESH_TO_ZERO_INVERSE
    ) {
        return Err(ThresholdError::InvalidMode(mode));
    }
    let automatic = threshold_type & (THRESH_OTSU | THRESH_TRIANGLE);
    if automatic == THRESH_TRIANGLE || automatic == (THRESH_OTSU | THRESH_TRIANGLE) {
        return Err(ThresholdError::UnsupportedAutomaticMode(automatic));
    }
    if automatic == THRESH_OTSU && source.channels() != 1 {
        return Err(ThresholdError::OtsuRequiresSingleChannel);
    }

    let input = source.compact_bytes();
    let used_threshold = if automatic == THRESH_OTSU {
        f64::from(otsu_threshold(&input))
    } else {
        threshold
    };
    let maximum = round_saturating_u8(maximum);
    let truncated = floor_saturating_u8(used_threshold);
    let output = input
        .into_iter()
        .map(|value| apply_threshold(value, used_threshold, truncated, maximum, mode))
        .collect();
    destination.write_output(
        output,
        source.rows(),
        source.columns(),
        source.channels(),
        source.depth(),
    )?;
    Ok(used_threshold)
}

fn apply_threshold(value: u8, threshold: f64, truncated: u8, maximum: u8, mode: i32) -> u8 {
    match mode {
        THRESH_BINARY => {
            if f64::from(value) > threshold {
                maximum
            } else {
                0
            }
        }
        THRESH_BINARY_INVERSE => {
            if f64::from(value) > threshold {
                0
            } else {
                maximum
            }
        }
        THRESH_TRUNCATE => value.min(truncated),
        THRESH_TO_ZERO => {
            if f64::from(value) > threshold {
                value
            } else {
                0
            }
        }
        THRESH_TO_ZERO_INVERSE => {
            if f64::from(value) > threshold {
                0
            } else {
                value
            }
        }
        _ => unreachable!("threshold mode was validated"),
    }
}

fn round_saturating_u8(value: f64) -> u8 {
    if value.is_nan() {
        return 0;
    }
    #[allow(clippy::cast_possible_truncation, clippy::cast_sign_loss)]
    {
        value.round_ties_even().clamp(0.0, 255.0) as u8
    }
}

fn floor_saturating_u8(value: f64) -> u8 {
    if value.is_nan() {
        return 0;
    }
    #[allow(clippy::cast_possible_truncation, clippy::cast_sign_loss)]
    {
        value.floor().clamp(0.0, 255.0) as u8
    }
}

fn otsu_threshold(input: &[u8]) -> u8 {
    let mut histogram = [0_u64; 256];
    for &value in input {
        histogram[usize::from(value)] += 1;
    }
    let total = input.len() as f64;
    let total_sum = histogram
        .iter()
        .enumerate()
        .map(|(value, &count)| value as f64 * count as f64)
        .sum::<f64>();
    let mut background_count = 0_u64;
    let mut background_sum = 0.0;
    let mut best_variance = -1.0;
    let mut best_threshold = 0_u8;
    for (threshold, &count) in histogram.iter().enumerate() {
        background_count += count;
        if background_count == 0 {
            continue;
        }
        let foreground_count = total - background_count as f64;
        if foreground_count == 0.0 {
            break;
        }
        background_sum += threshold as f64 * count as f64;
        let background_mean = background_sum / background_count as f64;
        let foreground_mean = (total_sum - background_sum) / foreground_count;
        let difference = background_mean - foreground_mean;
        let variance = background_count as f64 * foreground_count * difference * difference;
        if variance > best_variance {
            best_variance = variance;
            best_threshold = threshold as u8;
        }
    }
    best_threshold
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::mat::{mat_empty, mat_from_u8};

    #[test]
    fn binary_threshold_uses_strict_greater_than() {
        let source = mat_from_u8(&[0, 99, 100, 101, 255], 1, 5, 1).expect("source");
        let destination = mat_empty();
        let used = threshold_into(&source, &destination, 100.0, 200.0, THRESH_BINARY)
            .expect("threshold");
        assert_eq!(used, 100.0);
        assert_eq!(destination.compact_bytes(), [0, 0, 0, 200, 200]);
    }

    #[test]
    fn fixed_modes_cover_truncate_and_both_to_zero_directions() {
        let source = mat_from_u8(&[99, 100, 101], 1, 3, 1).expect("source");
        for (mode, expected) in [
            (THRESH_TRUNCATE, [99, 100, 100]),
            (THRESH_TO_ZERO, [0, 0, 101]),
            (THRESH_TO_ZERO_INVERSE, [99, 100, 0]),
        ] {
            let destination = mat_empty();
            threshold_into(&source, &destination, 100.0, 255.0, mode).expect("threshold");
            assert_eq!(destination.compact_bytes(), expected);
        }
    }

    #[test]
    fn otsu_selects_the_first_best_bimodal_split() {
        let source = mat_from_u8(&[10, 10, 10, 200, 200, 200], 1, 6, 1).expect("source");
        let destination = mat_empty();
        let used = threshold_into(
            &source,
            &destination,
            0.0,
            255.0,
            THRESH_BINARY | THRESH_OTSU,
        )
        .expect("threshold");
        assert_eq!(used, 10.0);
        assert_eq!(destination.compact_bytes(), [0, 0, 0, 255, 255, 255]);
    }
}
