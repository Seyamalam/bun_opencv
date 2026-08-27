//! Browser WebAssembly handle for MSER configuration.

use wasm_bindgen::prelude::*;

use crate::features2d_mser::{MserConfig, MserParameters};

const DEFAULT_NAME: &str = "Feature2D.MSER";

/// Owned MSER configuration handle for the browser package.
///
/// Region detection is not part of this configuration-only slice.
#[wasm_bindgen(js_name = MSERConfig)]
pub struct Mser {
    configuration: MserConfig,
}

#[wasm_bindgen(js_class = MSERConfig)]
impl Mser {
    #[wasm_bindgen(js_name = create)]
    pub fn create(
        delta: Option<i32>,
        min_area: Option<i32>,
        max_area: Option<i32>,
        pass2_only: Option<bool>,
    ) -> Mser {
        let defaults = MserParameters::default();
        Self {
            configuration: MserConfig::new(MserParameters {
                delta: delta.unwrap_or(defaults.delta),
                min_area: min_area.unwrap_or(defaults.min_area),
                max_area: max_area.unwrap_or(defaults.max_area),
                pass2_only: pass2_only.unwrap_or(defaults.pass2_only),
            }),
        }
    }

    #[wasm_bindgen(js_name = getDefaultName)]
    #[allow(clippy::unused_self)]
    pub fn get_default_name(&self) -> String {
        DEFAULT_NAME.to_owned()
    }

    #[wasm_bindgen(js_name = getDelta)]
    pub fn get_delta(&self) -> i32 {
        self.configuration.delta()
    }

    #[wasm_bindgen(js_name = getMaxArea)]
    pub fn get_max_area(&self) -> i32 {
        self.configuration.max_area()
    }

    #[wasm_bindgen(js_name = getMinArea)]
    pub fn get_min_area(&self) -> i32 {
        self.configuration.min_area()
    }

    #[wasm_bindgen(js_name = getPass2Only)]
    pub fn get_pass2_only(&self) -> bool {
        self.configuration.pass2_only()
    }

    #[wasm_bindgen(js_name = setDelta)]
    pub fn set_delta(&mut self, value: i32) {
        self.configuration.set_delta(value);
    }

    #[wasm_bindgen(js_name = setMaxArea)]
    pub fn set_max_area(&mut self, value: i32) {
        self.configuration.set_max_area(value);
    }

    #[wasm_bindgen(js_name = setMinArea)]
    pub fn set_min_area(&mut self, value: i32) {
        self.configuration.set_min_area(value);
    }

    #[wasm_bindgen(js_name = setPass2Only)]
    pub fn set_pass2_only(&mut self, value: bool) {
        self.configuration.set_pass2_only(value);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn exported_handle_exposes_defaults() {
        let detector = Mser::create(None, None, None, None);

        assert_eq!(detector.get_default_name(), "Feature2D.MSER");
        assert_eq!(detector.get_delta(), 5);
        assert_eq!(detector.get_min_area(), 60);
        assert_eq!(detector.get_max_area(), 14_400);
        assert!(!detector.get_pass2_only());
    }

    #[test]
    fn exported_handle_mutates_all_configuration_fields() {
        let mut detector = Mser::create(Some(7), Some(61), Some(14_401), Some(true));

        assert_eq!(detector.get_delta(), 7);
        assert_eq!(detector.get_min_area(), 61);
        assert_eq!(detector.get_max_area(), 14_401);
        assert!(detector.get_pass2_only());

        detector.set_delta(i32::MIN);
        detector.set_min_area(-1);
        detector.set_max_area(i32::MAX);
        detector.set_pass2_only(false);

        assert_eq!(detector.get_delta(), i32::MIN);
        assert_eq!(detector.get_min_area(), -1);
        assert_eq!(detector.get_max_area(), i32::MAX);
        assert!(!detector.get_pass2_only());
    }
}
