//! Package-owned core runtime state and scalar planning utilities.

use std::{cell::Cell, error::Error, fmt, sync::OnceLock};

/// OpenCV-compatible numeric value for disabled logging.
pub(crate) const LOG_LEVEL_SILENT: i32 = 0;
/// OpenCV-compatible numeric value for fatal logging.
pub(crate) const LOG_LEVEL_FATAL: i32 = 1;
/// OpenCV-compatible numeric value for error logging.
pub(crate) const LOG_LEVEL_ERROR: i32 = 2;
/// OpenCV-compatible numeric value for warning logging.
pub(crate) const LOG_LEVEL_WARNING: i32 = 3;
/// OpenCV-compatible numeric value for informational logging.
pub(crate) const LOG_LEVEL_INFO: i32 = 4;
/// OpenCV-compatible numeric value for debug logging.
pub(crate) const LOG_LEVEL_DEBUG: i32 = 5;
/// OpenCV-compatible numeric value for verbose logging.
pub(crate) const LOG_LEVEL_VERBOSE: i32 = 6;
const VALID_LOG_LEVELS: [i32; 7] = [
    LOG_LEVEL_SILENT,
    LOG_LEVEL_FATAL,
    LOG_LEVEL_ERROR,
    LOG_LEVEL_WARNING,
    LOG_LEVEL_INFO,
    LOG_LEVEL_DEBUG,
    LOG_LEVEL_VERBOSE,
];

thread_local! {
    /// Package-owned state for one browser WebAssembly instance.
    static LOG_LEVEL: Cell<i32> = const { Cell::new(LOG_LEVEL_WARNING) };
}

static OPTIMAL_DFT_SIZES: OnceLock<Box<[i32]>> = OnceLock::new();
const LARGEST_REPRESENTABLE_SMOOTH_SIZE: i32 = 2_125_764_000;

/// Failure produced by a core runtime utility.
#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) enum CoreRuntimeError {
    /// A logging level is outside the seven values documented by `OpenCV`.
    InvalidLogLevel(i32),
}

impl fmt::Display for CoreRuntimeError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::InvalidLogLevel(level) => write!(
                formatter,
                "log level must be an integer from {LOG_LEVEL_SILENT} (silent) through {LOG_LEVEL_VERBOSE} (verbose); received {level}"
            ),
        }
    }
}

impl Error for CoreRuntimeError {}

/// Gets the package-owned global logging level for this WebAssembly instance.
#[must_use]
pub(crate) fn get_log_level() -> i32 {
    LOG_LEVEL.with(Cell::get)
}

/// Sets the package-owned global logging level and returns its previous value.
pub(crate) fn set_log_level(level: i32) -> Result<i32, CoreRuntimeError> {
    if !VALID_LOG_LEVELS.contains(&level) {
        return Err(CoreRuntimeError::InvalidLogLevel(level));
    }

    Ok(LOG_LEVEL.with(|current| current.replace(level)))
}

/// Returns the least 5-smooth signed integer greater than or equal to `vector_size`.
#[must_use]
pub(crate) fn get_optimal_dft_size(vector_size: i32) -> i32 {
    if vector_size < 0 || vector_size == LARGEST_REPRESENTABLE_SMOOTH_SIZE {
        return -1;
    }
    if vector_size <= 1 {
        return 1;
    }

    let sizes = optimal_dft_sizes();
    match sizes.binary_search(&vector_size) {
        Ok(index) => sizes[index],
        Err(index) => sizes.get(index).copied().unwrap_or(-1),
    }
}

fn optimal_dft_sizes() -> &'static [i32] {
    OPTIMAL_DFT_SIZES.get_or_init(|| {
        let mut sizes = Vec::new();
        let maximum = i64::from(i32::MAX);
        let mut power_of_two = 1_i64;

        while power_of_two <= maximum {
            let mut power_of_two_and_three = power_of_two;
            while power_of_two_and_three <= maximum {
                let mut candidate = power_of_two_and_three;
                while candidate <= maximum {
                    sizes.push(i32::try_from(candidate).expect("bounded candidate fits i32"));
                    candidate *= 5;
                }
                power_of_two_and_three *= 3;
            }
            power_of_two *= 2;
        }

        sizes.sort_unstable();
        sizes.dedup();
        sizes.into_boxed_slice()
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_documented_log_level_round_trips_and_returns_the_previous_level() {
        let original = get_log_level();
        let levels = [
            LOG_LEVEL_SILENT,
            LOG_LEVEL_FATAL,
            LOG_LEVEL_ERROR,
            LOG_LEVEL_WARNING,
            LOG_LEVEL_INFO,
            LOG_LEVEL_DEBUG,
            LOG_LEVEL_VERBOSE,
        ];

        let mut expected_previous = original;
        for level in levels {
            assert_eq!(set_log_level(level), Ok(expected_previous));
            assert_eq!(get_log_level(), level);
            expected_previous = level;
        }

        set_log_level(original).expect("the saved level is valid");
    }

    #[test]
    fn resetting_the_log_level_replays_the_same_state_transitions() {
        let original = get_log_level();
        let sequence = [LOG_LEVEL_ERROR, LOG_LEVEL_DEBUG, LOG_LEVEL_SILENT];

        set_log_level(LOG_LEVEL_INFO).expect("info is valid");
        let first: Vec<i32> = sequence
            .into_iter()
            .map(|level| set_log_level(level).expect("documented level is valid"))
            .collect();
        let first_final = get_log_level();

        set_log_level(LOG_LEVEL_INFO).expect("info is valid");
        let second: Vec<i32> = sequence
            .into_iter()
            .map(|level| set_log_level(level).expect("documented level is valid"))
            .collect();

        assert_eq!(first, second);
        assert_eq!(first_final, get_log_level());
        set_log_level(original).expect("the saved level is valid");
    }

    #[test]
    fn invalid_log_levels_are_rejected_without_changing_state() {
        let original = get_log_level();
        set_log_level(LOG_LEVEL_INFO).expect("info is valid");

        for invalid in [i32::MIN, -1, LOG_LEVEL_VERBOSE + 1, i32::MAX] {
            assert_eq!(
                set_log_level(invalid),
                Err(CoreRuntimeError::InvalidLogLevel(invalid))
            );
            assert_eq!(get_log_level(), LOG_LEVEL_INFO);
        }

        set_log_level(original).expect("the saved level is valid");
    }

    #[test]
    fn invalid_log_level_error_lists_the_supported_numeric_range() {
        assert_eq!(
            CoreRuntimeError::InvalidLogLevel(99).to_string(),
            "log level must be an integer from 0 (silent) through 6 (verbose); received 99"
        );
    }

    #[test]
    fn browser_dft_examples_and_non_positive_sizes_have_stable_results() {
        let cases = [
            (i32::MIN, -1),
            (-1, -1),
            (0, 1),
            (1, 1),
            (2, 2),
            (7, 8),
            (300, 300),
            (301, 320),
            (1_000, 1_000),
            (1_001, 1_024),
        ];

        for (input, expected) in cases {
            assert_eq!(get_optimal_dft_size(input), expected, "input {input}");
        }
    }

    #[test]
    fn optimal_dft_size_is_minimal_and_five_smooth_for_a_dense_input_range() {
        let mut previous = get_optimal_dft_size(1);
        let mut expected = 1;
        for input in 1..=200_000 {
            while expected < input {
                expected += 1;
                while !is_five_smooth(expected) {
                    expected += 1;
                }
            }
            let result = get_optimal_dft_size(input);
            assert_eq!(result, expected, "input {input}");
            assert!(result >= previous, "the result must be monotonic");
            previous = result;
        }
    }

    #[test]
    fn every_supported_five_smooth_boundary_selects_itself_and_its_successor() {
        let sizes = all_representable_five_smooth_sizes();
        for (index, &size) in sizes.iter().enumerate() {
            let expected = if size == LARGEST_REPRESENTABLE_SMOOTH_SIZE {
                -1
            } else {
                size
            };
            assert_eq!(get_optimal_dft_size(size), expected);
            if let Some(&next) = sizes.get(index + 1)
                && size < i32::MAX
            {
                assert_eq!(get_optimal_dft_size(size + 1), next);
            }
        }
    }

    #[test]
    fn values_beyond_the_largest_representable_five_smooth_size_return_negative_one() {
        assert_eq!(get_optimal_dft_size(LARGEST_REPRESENTABLE_SMOOTH_SIZE), -1);
        assert_eq!(
            get_optimal_dft_size(LARGEST_REPRESENTABLE_SMOOTH_SIZE - 1),
            LARGEST_REPRESENTABLE_SMOOTH_SIZE
        );
        assert_eq!(
            get_optimal_dft_size(LARGEST_REPRESENTABLE_SMOOTH_SIZE + 1),
            -1
        );
        assert_eq!(get_optimal_dft_size(i32::MAX), -1);
    }

    fn is_five_smooth(value: i32) -> bool {
        if value < 1 {
            return false;
        }
        let mut remainder = value;
        for factor in [2, 3, 5] {
            while remainder % factor == 0 {
                remainder /= factor;
            }
        }
        remainder == 1
    }

    fn all_representable_five_smooth_sizes() -> Vec<i32> {
        let mut sizes = Vec::new();
        let mut power_of_two = 1_i64;
        while power_of_two <= i64::from(i32::MAX) {
            let mut power_of_two_and_three = power_of_two;
            while power_of_two_and_three <= i64::from(i32::MAX) {
                let mut candidate = power_of_two_and_three;
                while candidate <= i64::from(i32::MAX) {
                    sizes.push(i32::try_from(candidate).expect("candidate fits i32"));
                    candidate *= 5;
                }
                power_of_two_and_three *= 3;
            }
            power_of_two *= 2;
        }
        sizes.sort_unstable();
        sizes.dedup();
        sizes
    }
}
