use wasm_bindgen::prelude::*;

use crate::{imgproc_threshold, mat::Mat};

/// Applies fixed or Otsu-selected thresholding to a U8 matrix.
///
/// # Errors
///
/// Returns an error for empty or non-U8 sources, unsupported modes, invalid automatic-mode
/// combinations, or multichannel Otsu input.
#[wasm_bindgen(js_name = matThresholdInto)]
pub fn mat_threshold_into(
    source: &Mat,
    destination: &Mat,
    threshold: f64,
    maximum: f64,
    #[wasm_bindgen(js_name = thresholdType)] threshold_type: i32,
) -> Result<f64, JsError> {
    imgproc_threshold::threshold_into(source, destination, threshold, maximum, threshold_type)
        .map_err(JsError::from)
}
