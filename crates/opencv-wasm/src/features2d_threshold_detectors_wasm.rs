//! Browser WebAssembly handles for AGAST and FAST detector configuration.

use wasm_bindgen::prelude::*;

use crate::features2d_threshold_detectors::{AgastConfig, FastConfig};

const AGAST_DEFAULT_NAME: &str = "Feature2D.AgastFeatureDetector";
const FAST_DEFAULT_NAME: &str = "Feature2D.FastFeatureDetector";

/// Owned AGAST detector configuration handle for the browser package.
///
/// This slice stores configuration only. It does not detect keypoints. JavaScript owns each
/// returned handle and releases it through wasm-bindgen's generated `free()` method.
#[wasm_bindgen(js_name = AgastFeatureDetector)]
pub struct AgastFeatureDetector {
    configuration: AgastConfig,
}

#[wasm_bindgen(js_class = AgastFeatureDetector)]
impl AgastFeatureDetector {
    #[wasm_bindgen(js_name = create)]
    pub fn create(
        threshold: Option<i32>,
        nonmax_suppression: Option<bool>,
        detector_type: Option<i32>,
    ) -> Result<AgastFeatureDetector, JsError> {
        let defaults = AgastConfig::default();
        let configuration = AgastConfig::new(
            threshold.unwrap_or(defaults.threshold()),
            nonmax_suppression.unwrap_or(defaults.nonmax_suppression()),
            detector_type.unwrap_or(defaults.detector_type()),
        )
        .map_err(JsError::from)?;
        Ok(Self { configuration })
    }

    #[wasm_bindgen(js_name = getDefaultName)]
    #[allow(clippy::unused_self)]
    pub fn get_default_name(&self) -> String {
        AGAST_DEFAULT_NAME.to_owned()
    }

    #[wasm_bindgen(js_name = getNonmaxSuppression)]
    pub fn get_nonmax_suppression(&self) -> bool {
        self.configuration.nonmax_suppression()
    }

    #[wasm_bindgen(js_name = getThreshold)]
    pub fn get_threshold(&self) -> i32 {
        self.configuration.threshold()
    }

    #[wasm_bindgen(js_name = getType)]
    pub fn get_detector_type(&self) -> i32 {
        self.configuration.detector_type()
    }

    #[wasm_bindgen(js_name = setThreshold)]
    pub fn set_threshold(&mut self, value: i32) {
        self.configuration.set_threshold(value);
    }

    #[wasm_bindgen(js_name = setNonmaxSuppression)]
    pub fn set_nonmax_suppression(&mut self, value: bool) {
        self.configuration.set_nonmax_suppression(value);
    }

    /// # Errors
    /// Returns an error without changing the handle when the type is outside 0 through 3.
    #[wasm_bindgen(js_name = setType)]
    pub fn set_detector_type(&mut self, value: i32) -> Result<(), JsError> {
        self.configuration
            .set_detector_type(value)
            .map_err(JsError::from)
    }
}

/// Owned FAST detector configuration handle for the browser package.
///
/// This slice stores configuration only. It does not detect keypoints. JavaScript owns each
/// returned handle and releases it through wasm-bindgen's generated `free()` method.
#[wasm_bindgen(js_name = FastFeatureDetector)]
pub struct FastFeatureDetector {
    configuration: FastConfig,
}

#[wasm_bindgen(js_class = FastFeatureDetector)]
impl FastFeatureDetector {
    #[wasm_bindgen(js_name = create)]
    pub fn create(
        threshold: Option<i32>,
        nonmax_suppression: Option<bool>,
        detector_type: Option<i32>,
    ) -> Result<FastFeatureDetector, JsError> {
        let defaults = FastConfig::default();
        let configuration = FastConfig::new(
            threshold.unwrap_or(defaults.threshold()),
            nonmax_suppression.unwrap_or(defaults.nonmax_suppression()),
            detector_type.unwrap_or(defaults.detector_type()),
        )
        .map_err(JsError::from)?;
        Ok(Self { configuration })
    }

    #[wasm_bindgen(js_name = getDefaultName)]
    #[allow(clippy::unused_self)]
    pub fn get_default_name(&self) -> String {
        FAST_DEFAULT_NAME.to_owned()
    }

    #[wasm_bindgen(js_name = getNonmaxSuppression)]
    pub fn get_nonmax_suppression(&self) -> bool {
        self.configuration.nonmax_suppression()
    }

    #[wasm_bindgen(js_name = getThreshold)]
    pub fn get_threshold(&self) -> i32 {
        self.configuration.threshold()
    }

    #[wasm_bindgen(js_name = getType)]
    pub fn get_detector_type(&self) -> i32 {
        self.configuration.detector_type()
    }

    #[wasm_bindgen(js_name = setThreshold)]
    pub fn set_threshold(&mut self, value: i32) {
        self.configuration.set_threshold(value);
    }

    #[wasm_bindgen(js_name = setNonmaxSuppression)]
    pub fn set_nonmax_suppression(&mut self, value: bool) {
        self.configuration.set_nonmax_suppression(value);
    }

    /// # Errors
    /// Returns an error without changing the handle when the type is outside 0 through 2.
    #[wasm_bindgen(js_name = setType)]
    pub fn set_detector_type(&mut self, value: i32) -> Result<(), JsError> {
        self.configuration
            .set_detector_type(value)
            .map_err(JsError::from)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn exported_agast_factory_applies_documented_defaults() {
        let detector = AgastFeatureDetector::create(None, None, None)
            .expect("documented AGAST defaults are valid");

        assert_eq!(
            detector.get_default_name(),
            "Feature2D.AgastFeatureDetector"
        );
        assert_eq!(detector.get_threshold(), 10);
        assert!(detector.get_nonmax_suppression());
        assert_eq!(detector.get_detector_type(), 3);
    }

    #[test]
    fn exported_agast_factory_and_methods_preserve_state() {
        let mut detector = AgastFeatureDetector::create(Some(24), Some(false), Some(1))
            .expect("valid AGAST configuration");

        assert_eq!(detector.get_threshold(), 24);
        assert!(!detector.get_nonmax_suppression());
        assert_eq!(detector.get_detector_type(), 1);

        detector.set_threshold(90);
        detector.set_nonmax_suppression(true);
        detector.set_detector_type(2).expect("valid type");

        assert_eq!(detector.get_threshold(), 90);
        assert!(detector.get_nonmax_suppression());
        assert_eq!(detector.get_detector_type(), 2);
    }

    #[test]
    fn exported_fast_factory_applies_documented_defaults() {
        let detector = FastFeatureDetector::create(None, None, None)
            .expect("documented FAST defaults are valid");

        assert_eq!(detector.get_default_name(), "Feature2D.FastFeatureDetector");
        assert_eq!(detector.get_threshold(), 10);
        assert!(detector.get_nonmax_suppression());
        assert_eq!(detector.get_detector_type(), 2);
    }

    #[test]
    fn exported_fast_factory_and_methods_preserve_state() {
        let mut detector = FastFeatureDetector::create(Some(18), Some(false), Some(0))
            .expect("valid FAST configuration");

        assert_eq!(detector.get_threshold(), 18);
        assert!(!detector.get_nonmax_suppression());
        assert_eq!(detector.get_detector_type(), 0);

        detector.set_threshold(110);
        detector.set_nonmax_suppression(true);
        detector.set_detector_type(1).expect("valid type");

        assert_eq!(detector.get_threshold(), 110);
        assert!(detector.get_nonmax_suppression());
        assert_eq!(detector.get_detector_type(), 1);
    }
}
