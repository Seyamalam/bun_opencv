use wasm_bindgen::prelude::*;

use crate::{imgproc_histogram, mat::Mat};

#[wasm_bindgen(js_name = matEqualizeHistInto)]
pub fn mat_equalize_hist_into(source: &Mat, destination: &Mat) -> Result<(), JsError> {
    imgproc_histogram::equalize_hist_into(source, destination).map_err(JsError::from)
}
