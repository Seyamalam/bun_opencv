use wasm_bindgen::prelude::*;

use crate::{imgproc_resize, mat::Mat};

/// Resizes a matrix into a mutable destination.
///
/// The first compatibility slice supports nearest-neighbor interpolation for every scalar depth
/// and interleaved channel count represented by `Mat`.
///
/// # Errors
///
/// Returns an error for empty sources, invalid output geometry, invalid scales, size overflow, or
/// an interpolation mode outside the current slice.
#[allow(clippy::too_many_arguments)]
#[wasm_bindgen(js_name = matResizeInto)]
pub fn mat_resize_into(
    source: &Mat,
    destination: &Mat,
    #[wasm_bindgen(js_name = targetWidth)] target_width: i32,
    #[wasm_bindgen(js_name = targetHeight)] target_height: i32,
    #[wasm_bindgen(js_name = scaleX)] scale_x: f64,
    #[wasm_bindgen(js_name = scaleY)] scale_y: f64,
    interpolation: i32,
) -> Result<(), JsError> {
    imgproc_resize::resize_into(
        source,
        destination,
        target_width,
        target_height,
        scale_x,
        scale_y,
        interpolation,
    )
    .map_err(JsError::from)
}
