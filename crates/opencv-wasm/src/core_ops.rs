//! Unsigned 8-bit core kernels shared by the native tests and WASM adapters.

use std::{error::Error, fmt};

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn arithmetic_kernels_match_unsigned_eight_bit_edges_exhaustively() {
        for left in u8::MIN..=u8::MAX {
            for right in u8::MIN..=u8::MAX {
                assert_eq!(
                    add_u8(&[left], &[right]).expect("equal lengths"),
                    [left.saturating_add(right)]
                );
                assert_eq!(
                    subtract_u8(&[left], &[right]).expect("equal lengths"),
                    [left.saturating_sub(right)]
                );
                assert_eq!(
                    absdiff_u8(&[left], &[right]).expect("equal lengths"),
                    [left.abs_diff(right)]
                );
                assert_eq!(
                    min_u8(&[left], &[right]).expect("equal lengths"),
                    [left.min(right)]
                );
                assert_eq!(
                    max_u8(&[left], &[right]).expect("equal lengths"),
                    [left.max(right)]
                );
            }
        }
    }

    #[test]
    fn bitwise_kernels_match_primitive_unsigned_operations_exhaustively() {
        for left in u8::MIN..=u8::MAX {
            assert_eq!(bitwise_not_u8(&[left]), [!left]);

            for right in u8::MIN..=u8::MAX {
                assert_eq!(
                    bitwise_and_u8(&[left], &[right]).expect("equal lengths"),
                    [left & right]
                );
                assert_eq!(
                    bitwise_or_u8(&[left], &[right]).expect("equal lengths"),
                    [left | right]
                );
                assert_eq!(
                    bitwise_xor_u8(&[left], &[right]).expect("equal lengths"),
                    [left ^ right]
                );
            }
        }
    }

    #[test]
    fn equality_comparison_returns_an_opencv_style_binary_mask() {
        let result = compare_eq_u8(&[0, 7, 255, 9], &[0, 8, 255, 10]).expect("equal lengths");
        assert_eq!(result, [255, 0, 255, 0]);
    }

    #[test]
    fn range_comparison_is_inclusive_at_both_bounds() {
        let result = in_range_u8(
            &[0, 1, 2, 127, 128, 254, 255],
            &[1, 1, 1, 127, 129, 0, 255],
            &[254, 254, 1, 127, 255, 254, 255],
        )
        .expect("equal lengths");
        assert_eq!(result, [0, 255, 0, 255, 0, 255, 255]);
    }

    #[test]
    fn count_non_zero_counts_elements_not_set_bits() {
        assert_eq!(count_non_zero_u8(&[0, 1, 2, 128, 255, 0]), 4);
        assert_eq!(count_non_zero_u8(&[]), 0);
    }

    #[test]
    fn empty_inputs_return_empty_outputs() {
        assert!(add_u8(&[], &[]).expect("equal lengths").is_empty());
        assert!(subtract_u8(&[], &[]).expect("equal lengths").is_empty());
        assert!(absdiff_u8(&[], &[]).expect("equal lengths").is_empty());
        assert!(bitwise_and_u8(&[], &[]).expect("equal lengths").is_empty());
        assert!(bitwise_or_u8(&[], &[]).expect("equal lengths").is_empty());
        assert!(bitwise_xor_u8(&[], &[]).expect("equal lengths").is_empty());
        assert!(bitwise_not_u8(&[]).is_empty());
        assert!(min_u8(&[], &[]).expect("equal lengths").is_empty());
        assert!(max_u8(&[], &[]).expect("equal lengths").is_empty());
        assert!(compare_eq_u8(&[], &[]).expect("equal lengths").is_empty());
        assert!(
            in_range_u8(&[], &[], &[])
                .expect("equal lengths")
                .is_empty()
        );
    }

    #[test]
    fn every_binary_kernel_rejects_a_different_right_length() {
        let expected = CoreOpError::LengthMismatch {
            operand: "right",
            expected: 2,
            actual: 1,
        };
        let left = [1, 2];
        let right = [1];

        assert_eq!(add_u8(&left, &right), Err(expected.clone()));
        assert_eq!(subtract_u8(&left, &right), Err(expected.clone()));
        assert_eq!(absdiff_u8(&left, &right), Err(expected.clone()));
        assert_eq!(bitwise_and_u8(&left, &right), Err(expected.clone()));
        assert_eq!(bitwise_or_u8(&left, &right), Err(expected.clone()));
        assert_eq!(bitwise_xor_u8(&left, &right), Err(expected.clone()));
        assert_eq!(min_u8(&left, &right), Err(expected.clone()));
        assert_eq!(max_u8(&left, &right), Err(expected.clone()));
        assert_eq!(compare_eq_u8(&left, &right), Err(expected));
    }

    #[test]
    fn range_kernel_identifies_the_mismatched_bound() {
        assert_eq!(
            in_range_u8(&[1, 2], &[0], &[3, 3]),
            Err(CoreOpError::LengthMismatch {
                operand: "lower bound",
                expected: 2,
                actual: 1,
            })
        );
        assert_eq!(
            in_range_u8(&[1, 2], &[0, 0], &[3]),
            Err(CoreOpError::LengthMismatch {
                operand: "upper bound",
                expected: 2,
                actual: 1,
            })
        );
    }

    #[test]
    fn length_error_has_actionable_text() {
        let error = add_u8(&[1, 2], &[1]).expect_err("different lengths must fail");
        assert_eq!(
            error.to_string(),
            "right buffer has 1 element; expected 2 elements"
        );
    }
}

/// Failure produced when corresponding kernel operands have different lengths.
#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) enum CoreOpError {
    /// A corresponding operand does not contain one value for every source value.
    LengthMismatch {
        /// Human-readable operand name for adapters and diagnostics.
        operand: &'static str,
        /// Required number of elements.
        expected: usize,
        /// Supplied number of elements.
        actual: usize,
    },
}

impl fmt::Display for CoreOpError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::LengthMismatch {
                operand,
                expected,
                actual,
            } => write!(
                formatter,
                "{operand} buffer has {actual} {}; expected {expected} {}",
                pluralize(*actual, "element", "elements"),
                pluralize(*expected, "element", "elements")
            ),
        }
    }
}

impl Error for CoreOpError {}

/// Adds corresponding unsigned bytes with saturation at 255.
pub(crate) fn add_u8(left: &[u8], right: &[u8]) -> Result<Vec<u8>, CoreOpError> {
    map_binary_u8(left, right, u8::saturating_add)
}

/// Subtracts corresponding unsigned bytes with saturation at zero.
pub(crate) fn subtract_u8(left: &[u8], right: &[u8]) -> Result<Vec<u8>, CoreOpError> {
    map_binary_u8(left, right, u8::saturating_sub)
}

/// Computes the absolute difference between corresponding unsigned bytes.
pub(crate) fn absdiff_u8(left: &[u8], right: &[u8]) -> Result<Vec<u8>, CoreOpError> {
    map_binary_u8(left, right, u8::abs_diff)
}

/// Computes a bitwise AND between corresponding bytes.
pub(crate) fn bitwise_and_u8(left: &[u8], right: &[u8]) -> Result<Vec<u8>, CoreOpError> {
    map_binary_u8(left, right, |left, right| left & right)
}

/// Computes a bitwise OR between corresponding bytes.
pub(crate) fn bitwise_or_u8(left: &[u8], right: &[u8]) -> Result<Vec<u8>, CoreOpError> {
    map_binary_u8(left, right, |left, right| left | right)
}

/// Computes a bitwise XOR between corresponding bytes.
pub(crate) fn bitwise_xor_u8(left: &[u8], right: &[u8]) -> Result<Vec<u8>, CoreOpError> {
    map_binary_u8(left, right, |left, right| left ^ right)
}

/// Inverts every bit in every byte.
#[must_use]
pub(crate) fn bitwise_not_u8(source: &[u8]) -> Vec<u8> {
    source.iter().copied().map(|value| !value).collect()
}

/// Selects the smaller corresponding unsigned byte.
pub(crate) fn min_u8(left: &[u8], right: &[u8]) -> Result<Vec<u8>, CoreOpError> {
    map_binary_u8(left, right, u8::min)
}

/// Selects the larger corresponding unsigned byte.
pub(crate) fn max_u8(left: &[u8], right: &[u8]) -> Result<Vec<u8>, CoreOpError> {
    map_binary_u8(left, right, u8::max)
}

/// Compares corresponding bytes for equality, yielding 255 when equal and zero otherwise.
pub(crate) fn compare_eq_u8(left: &[u8], right: &[u8]) -> Result<Vec<u8>, CoreOpError> {
    map_binary_u8(left, right, |left, right| u8::from(left == right) * u8::MAX)
}

/// Tests every byte against corresponding inclusive lower and upper bounds.
///
/// All three slices must have the same length. A later WASM adapter can expand scalar bounds
/// before calling this kernel without complicating the element-wise implementation.
pub(crate) fn in_range_u8(
    source: &[u8],
    lower_bound: &[u8],
    upper_bound: &[u8],
) -> Result<Vec<u8>, CoreOpError> {
    validate_length(source.len(), lower_bound.len(), "lower bound")?;
    validate_length(source.len(), upper_bound.len(), "upper bound")?;

    Ok(source
        .iter()
        .copied()
        .zip(lower_bound.iter().copied())
        .zip(upper_bound.iter().copied())
        .map(|((value, lower), upper)| u8::from(value >= lower && value <= upper) * u8::MAX)
        .collect())
}

/// Counts bytes whose value is not zero.
#[must_use]
pub(crate) fn count_non_zero_u8(source: &[u8]) -> usize {
    source.iter().filter(|value| **value != 0).count()
}

fn map_binary_u8(
    left: &[u8],
    right: &[u8],
    operation: impl Fn(u8, u8) -> u8,
) -> Result<Vec<u8>, CoreOpError> {
    validate_length(left.len(), right.len(), "right")?;
    Ok(left
        .iter()
        .copied()
        .zip(right.iter().copied())
        .map(|(left, right)| operation(left, right))
        .collect())
}

fn validate_length(
    expected: usize,
    actual: usize,
    operand: &'static str,
) -> Result<(), CoreOpError> {
    if actual != expected {
        return Err(CoreOpError::LengthMismatch {
            operand,
            expected,
            actual,
        });
    }
    Ok(())
}

fn pluralize<'word>(amount: usize, singular: &'word str, plural: &'word str) -> &'word str {
    if amount == 1 { singular } else { plural }
}
