use wasm_bindgen::prelude::*;

use crate::{imgproc_canny, mat::Mat};

#[wasm_bindgen(js_name = matCannyInto)]
pub fn mat_canny_into(
    source: &Mat,
    destination: &Mat,
    #[wasm_bindgen(js_name = threshold1)] threshold_1: f64,
    #[wasm_bindgen(js_name = threshold2)] threshold_2: f64,
    #[wasm_bindgen(js_name = apertureSize)] aperture_size: i32,
    #[wasm_bindgen(js_name = l2Gradient)] l2_gradient: bool,
) -> Result<(), JsError> {
    imgproc_canny::canny_into(
        source,
        destination,
        threshold_1,
        threshold_2,
        aperture_size,
        l2_gradient,
    )
    .map_err(JsError::from)
}
