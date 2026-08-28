use std::{error::Error, fmt};

use crate::mat::{Mat, MatDepth, MatError};

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) enum EqualizeHistError {
    EmptySource,
    Matrix(MatError),
    RequiresSingleChannel,
    UnsupportedDepth(MatDepth),
}

impl fmt::Display for EqualizeHistError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::EmptySource => formatter.write_str("equalizeHist source must not be empty"),
            Self::Matrix(error) => error.fmt(formatter),
            Self::RequiresSingleChannel => {
                formatter.write_str("equalizeHist requires a single-channel source")
            }
            Self::UnsupportedDepth(depth) => {
                write!(
                    formatter,
                    "equalizeHist source depth {depth:?} is not implemented"
                )
            }
        }
    }
}

impl Error for EqualizeHistError {
    fn source(&self) -> Option<&(dyn Error + 'static)> {
        match self {
            Self::Matrix(error) => Some(error),
            _ => None,
        }
    }
}

impl From<MatError> for EqualizeHistError {
    fn from(error: MatError) -> Self {
        Self::Matrix(error)
    }
}

pub(crate) fn equalize_hist_into(source: &Mat, destination: &Mat) -> Result<(), EqualizeHistError> {
    if source.rows() == 0 || source.columns() == 0 {
        return Err(EqualizeHistError::EmptySource);
    }
    if source.depth() != MatDepth::U8 {
        return Err(EqualizeHistError::UnsupportedDepth(source.depth()));
    }
    if source.channels() != 1 {
        return Err(EqualizeHistError::RequiresSingleChannel);
    }
    let input = source.compact_bytes();
    let mut histogram = [0_u32; 256];
    for &value in &input {
        histogram[usize::from(value)] += 1;
    }
    let first = histogram.iter().position(|&count| count != 0).unwrap_or(0);
    let first_count = histogram[first];
    if usize::try_from(first_count).ok() == Some(input.len()) {
        destination.write_output(input, source.rows(), source.columns(), 1, MatDepth::U8)?;
        return Ok(());
    }
    let denominator = input.len() - usize::try_from(first_count).unwrap_or(0);
    let scale = 255.0 / denominator as f64;
    let mut cumulative = 0_u32;
    let mut lookup = [0_u8; 256];
    for (value, &count) in histogram.iter().enumerate() {
        cumulative += count;
        if value <= first {
            lookup[value] = 0;
            continue;
        }
        lookup[value] = round_u8(f64::from(cumulative - first_count) * scale);
    }
    let output = input
        .into_iter()
        .map(|value| lookup[usize::from(value)])
        .collect();
    destination.write_output(output, source.rows(), source.columns(), 1, MatDepth::U8)?;
    Ok(())
}

fn round_u8(value: f64) -> u8 {
    #[allow(clippy::cast_possible_truncation, clippy::cast_sign_loss)]
    {
        value.round_ties_even().clamp(0.0, 255.0) as u8
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::mat::{mat_empty, mat_from_u8};

    #[test]
    fn cumulative_distribution_spans_the_u8_range() {
        let source = mat_from_u8(&[0, 0, 1, 1, 2, 3, 3, 3], 1, 8, 1).expect("source");
        let destination = mat_empty();
        equalize_hist_into(&source, &destination).expect("equalize");
        assert_eq!(
            destination.compact_bytes(),
            [0, 0, 85, 85, 128, 255, 255, 255]
        );
    }
}
