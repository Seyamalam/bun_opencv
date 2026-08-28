use wasm_bindgen::prelude::*;

use crate::{imgproc_filter, mat::Mat};

#[allow(clippy::too_many_arguments)]
#[wasm_bindgen(js_name = matGaussianBlurInto)]
pub fn mat_gaussian_blur_into(
    source: &Mat,
    destination: &Mat,
    width: i32,
    height: i32,
    #[wasm_bindgen(js_name = sigmaX)] sigma_x: f64,
    #[wasm_bindgen(js_name = sigmaY)] sigma_y: f64,
    #[wasm_bindgen(js_name = borderType)] border_type: i32,
) -> Result<(), JsError> {
    imgproc_filter::gaussian_blur_into(
        source,
        destination,
        width,
        height,
        sigma_x,
        sigma_y,
        border_type,
    )
    .map_err(JsError::from)
}

#[allow(clippy::too_many_arguments)]
#[wasm_bindgen(js_name = matMorphologyExInto)]
pub fn mat_morphology_ex_into(
    source: &Mat,
    destination: &Mat,
    operation: i32,
    kernel: &Mat,
    #[wasm_bindgen(js_name = anchorX)] anchor_x: i32,
    #[wasm_bindgen(js_name = anchorY)] anchor_y: i32,
    iterations: i32,
    #[wasm_bindgen(js_name = borderType)] border_type: i32,
    #[wasm_bindgen(js_name = borderValue)] border_value: &[f64],
    #[wasm_bindgen(js_name = defaultBorderValue)] default_border_value: bool,
) -> Result<(), JsError> {
    imgproc_filter::morphology_ex_into(
        source,
        destination,
        operation,
        kernel,
        anchor_x,
        anchor_y,
        iterations,
        border_type,
        border_value,
        default_border_value,
    )
    .map_err(JsError::from)
}

#[allow(clippy::too_many_arguments)]
#[wasm_bindgen(js_name = matSobelInto)]
pub fn mat_sobel_into(
    source: &Mat,
    destination: &Mat,
    #[wasm_bindgen(js_name = destinationDepth)] destination_depth: i32,
    dx: i32,
    dy: i32,
    #[wasm_bindgen(js_name = kernelSize)] kernel_size: i32,
    scale: f64,
    delta: f64,
    #[wasm_bindgen(js_name = borderType)] border_type: i32,
) -> Result<(), JsError> {
    imgproc_filter::sobel_into(
        source,
        destination,
        destination_depth,
        dx,
        dy,
        kernel_size,
        scale,
        delta,
        border_type,
    )
    .map_err(JsError::from)
}
