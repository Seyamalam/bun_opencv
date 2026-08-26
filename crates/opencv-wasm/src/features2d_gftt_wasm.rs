//! Browser WebAssembly handle for GFTT detector configuration.

use wasm_bindgen::prelude::*;

use crate::features2d_gftt::{GfttConfig, GfttParameters};

const DEFAULT_NAME: &str = "Feature2D.GFTTDetector";

/// Owned GFTT detector configuration handle for the browser package.
///
/// This slice stores configuration only. It does not detect keypoints. JavaScript owns each
/// returned handle and releases it through wasm-bindgen's generated `free()` method.
#[wasm_bindgen(js_name = GFTTDetector)]
pub struct GfttDetector {
    configuration: GfttConfig,
}

#[wasm_bindgen(js_class = GFTTDetector)]
impl GfttDetector {
    /// Creates an owned configuration handle using documented defaults for omitted arguments.
    #[wasm_bindgen(js_name = create)]
    pub fn create(
        max_features: Option<i32>,
        quality_level: Option<f64>,
        min_distance: Option<f64>,
        block_size: Option<i32>,
        harris_detector: Option<bool>,
        k: Option<f64>,
    ) -> GfttDetector {
        let defaults = GfttParameters::default();
        let configuration = GfttConfig::new(GfttParameters {
            max_features: max_features.unwrap_or(defaults.max_features),
            quality_level: quality_level.unwrap_or(defaults.quality_level),
            min_distance: min_distance.unwrap_or(defaults.min_distance),
            block_size: block_size.unwrap_or(defaults.block_size),
            harris_detector: harris_detector.unwrap_or(defaults.harris_detector),
            k: k.unwrap_or(defaults.k),
        });
        Self { configuration }
    }

    #[wasm_bindgen(js_name = getBlockSize)]
    pub fn get_block_size(&self) -> i32 {
        self.configuration.block_size()
    }

    #[wasm_bindgen(js_name = getDefaultName)]
    #[allow(clippy::unused_self)]
    pub fn get_default_name(&self) -> String {
        DEFAULT_NAME.to_owned()
    }

    #[wasm_bindgen(js_name = getHarrisDetector)]
    pub fn get_harris_detector(&self) -> bool {
        self.configuration.harris_detector()
    }

    #[wasm_bindgen(js_name = getK)]
    pub fn get_k(&self) -> f64 {
        self.configuration.k()
    }

    #[wasm_bindgen(js_name = getMaxFeatures)]
    pub fn get_max_features(&self) -> i32 {
        self.configuration.max_features()
    }

    #[wasm_bindgen(js_name = getMinDistance)]
    pub fn get_min_distance(&self) -> f64 {
        self.configuration.min_distance()
    }

    #[wasm_bindgen(js_name = getQualityLevel)]
    pub fn get_quality_level(&self) -> f64 {
        self.configuration.quality_level()
    }

    #[wasm_bindgen(js_name = setBlockSize)]
    pub fn set_block_size(&mut self, value: i32) {
        self.configuration.set_block_size(value);
    }

    #[wasm_bindgen(js_name = setHarrisDetector)]
    pub fn set_harris_detector(&mut self, value: bool) {
        self.configuration.set_harris_detector(value);
    }

    #[wasm_bindgen(js_name = setK)]
    pub fn set_k(&mut self, value: f64) {
        self.configuration.set_k(value);
    }

    #[wasm_bindgen(js_name = setMaxFeatures)]
    pub fn set_max_features(&mut self, value: i32) {
        self.configuration.set_max_features(value);
    }

    #[wasm_bindgen(js_name = setMinDistance)]
    pub fn set_min_distance(&mut self, value: f64) {
        self.configuration.set_min_distance(value);
    }

    #[wasm_bindgen(js_name = setQualityLevel)]
    pub fn set_quality_level(&mut self, value: f64) {
        self.configuration.set_quality_level(value);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn exported_factory_applies_documented_defaults() {
        let detector = GfttDetector::create(None, None, None, None, None, None);

        assert_eq!(detector.get_default_name(), "Feature2D.GFTTDetector");
        assert_eq!(detector.get_max_features(), 1_000);
        assert_eq!(detector.get_quality_level().to_bits(), 0.01_f64.to_bits());
        assert_eq!(detector.get_min_distance().to_bits(), 1.0_f64.to_bits());
        assert_eq!(detector.get_block_size(), 3);
        assert!(!detector.get_harris_detector());
        assert_eq!(detector.get_k().to_bits(), 0.04_f64.to_bits());
    }

    #[test]
    fn exported_factory_and_methods_preserve_state() {
        let mut detector = GfttDetector::create(
            Some(350),
            Some(0.07),
            Some(4.5),
            Some(9),
            Some(true),
            Some(0.12),
        );

        assert_eq!(detector.get_max_features(), 350);
        assert_eq!(detector.get_quality_level().to_bits(), 0.07_f64.to_bits());
        assert_eq!(detector.get_min_distance().to_bits(), 4.5_f64.to_bits());
        assert_eq!(detector.get_block_size(), 9);
        assert!(detector.get_harris_detector());
        assert_eq!(detector.get_k().to_bits(), 0.12_f64.to_bits());

        detector.set_max_features(-1);
        detector.set_quality_level(f64::NAN);
        detector.set_min_distance(f64::NEG_INFINITY);
        detector.set_block_size(0);
        detector.set_harris_detector(false);
        detector.set_k(f64::INFINITY);

        assert_eq!(detector.get_max_features(), -1);
        assert!(detector.get_quality_level().is_nan());
        assert_eq!(
            detector.get_min_distance().to_bits(),
            f64::NEG_INFINITY.to_bits()
        );
        assert_eq!(detector.get_block_size(), 0);
        assert!(!detector.get_harris_detector());
        assert_eq!(detector.get_k().to_bits(), f64::INFINITY.to_bits());
    }
}
