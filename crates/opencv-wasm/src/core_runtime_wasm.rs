//! Browser WebAssembly adapters for core runtime utilities.

use wasm_bindgen::prelude::*;

use crate::core_runtime;

/// Gets the package-owned logging level for this WebAssembly instance.
#[wasm_bindgen(js_name = getLogLevel)]
#[must_use]
pub fn get_log_level() -> i32 {
    core_runtime::get_log_level()
}

/// Sets the package-owned logging level and returns its previous value.
///
/// Valid values are 0 (silent), 1 (fatal), 2 (error), 3 (warning), 4 (info), 5 (debug), and 6
/// (verbose). This setting controls package-owned logging only. It does not call into `OpenCV`.
///
/// # Errors
///
/// Returns an error when `level` is outside the documented range from 0 through 6.
#[wasm_bindgen(js_name = setLogLevel)]
pub fn set_log_level(level: i32) -> Result<i32, JsError> {
    core_runtime::set_log_level(level).map_err(JsError::from)
}

/// Returns the smallest integer at least as large as `vector_size` with only 2, 3, and 5 as
/// prime factors.
///
/// Negative inputs and values at or above the browser runtime's upper sentinel return -1. Zero and
/// one return 1.
#[wasm_bindgen(js_name = getOptimalDFTSize)]
#[must_use]
pub fn get_optimal_dft_size(vector_size: i32) -> i32 {
    core_runtime::get_optimal_dft_size(vector_size)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn wasm_log_adapter_returns_the_previous_level() {
        let original = get_log_level();
        set_log_level(core_runtime::LOG_LEVEL_ERROR).expect("error is a valid level");

        assert_eq!(
            set_log_level(core_runtime::LOG_LEVEL_VERBOSE).expect("verbose is a valid level"),
            core_runtime::LOG_LEVEL_ERROR
        );
        assert_eq!(get_log_level(), core_runtime::LOG_LEVEL_VERBOSE);

        set_log_level(original).expect("the saved level is valid");
    }

    #[test]
    fn wasm_dft_adapter_preserves_scalar_boundaries() {
        assert_eq!(get_optimal_dft_size(-10), -1);
        assert_eq!(get_optimal_dft_size(301), 320);
        assert_eq!(get_optimal_dft_size(i32::MAX), -1);
    }
}
