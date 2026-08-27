//! Browser WebAssembly handle for ORB configuration.

use wasm_bindgen::prelude::*;

use crate::features2d_orb::{OrbConfig, OrbParameters};

const DEFAULT_NAME: &str = "Feature2D.ORB";

#[wasm_bindgen(js_name = ORB)]
pub struct Orb {
    configuration: OrbConfig,
}

#[wasm_bindgen(js_class = ORB)]
impl Orb {
    #[wasm_bindgen(js_name = create)]
    #[allow(clippy::too_many_arguments)]
    pub fn create(
        max_features: Option<i32>,
        scale_factor: Option<f32>,
        levels: Option<i32>,
        edge_threshold: Option<i32>,
        first_level: Option<i32>,
        wta_k: Option<i32>,
        score_type: Option<i32>,
        patch_size: Option<i32>,
        fast_threshold: Option<i32>,
    ) -> Result<Orb, JsError> {
        let defaults = OrbParameters::default();
        let configuration = OrbConfig::new(OrbParameters {
            max_features: max_features.unwrap_or(defaults.max_features),
            scale_factor: scale_factor.map_or(defaults.scale_factor, f64::from),
            levels: levels.unwrap_or(defaults.levels),
            edge_threshold: edge_threshold.unwrap_or(defaults.edge_threshold),
            first_level: first_level.unwrap_or(defaults.first_level),
            wta_k: wta_k.unwrap_or(defaults.wta_k),
            score_type: score_type.unwrap_or(defaults.score_type),
            patch_size: patch_size.unwrap_or(defaults.patch_size),
            fast_threshold: fast_threshold.unwrap_or(defaults.fast_threshold),
        })
        .map_err(JsError::from)?;
        Ok(Self { configuration })
    }

    #[wasm_bindgen(js_name = getDefaultName)]
    #[allow(clippy::unused_self)]
    pub fn get_default_name(&self) -> String {
        DEFAULT_NAME.to_owned()
    }

    #[wasm_bindgen(js_name = getFastThreshold)]
    pub fn get_fast_threshold(&self) -> i32 {
        self.configuration.fast_threshold()
    }

    #[wasm_bindgen(js_name = setEdgeThreshold)]
    pub fn set_edge_threshold(&mut self, value: i32) {
        self.configuration.set_edge_threshold(value);
    }

    #[wasm_bindgen(js_name = setFastThreshold)]
    pub fn set_fast_threshold(&mut self, value: i32) {
        self.configuration.set_fast_threshold(value);
    }

    #[wasm_bindgen(js_name = setFirstLevel)]
    pub fn set_first_level(&mut self, value: i32) -> Result<(), JsError> {
        self.configuration
            .set_first_level(value)
            .map_err(JsError::from)
    }

    #[wasm_bindgen(js_name = setMaxFeatures)]
    pub fn set_max_features(&mut self, value: i32) {
        self.configuration.set_max_features(value);
    }

    #[wasm_bindgen(js_name = setNLevels)]
    pub fn set_levels(&mut self, value: i32) {
        self.configuration.set_levels(value);
    }

    #[wasm_bindgen(js_name = setPatchSize)]
    pub fn set_patch_size(&mut self, value: i32) {
        self.configuration.set_patch_size(value);
    }

    #[wasm_bindgen(js_name = setScaleFactor)]
    pub fn set_scale_factor(&mut self, value: f64) {
        self.configuration.set_scale_factor(value);
    }

    #[wasm_bindgen(js_name = setScoreType)]
    pub fn set_score_type(&mut self, value: i32) {
        self.configuration.set_score_type(value);
    }

    #[wasm_bindgen(js_name = setWTA_K)]
    pub fn set_wta_k(&mut self, value: i32) {
        self.configuration.set_wta_k(value);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn exported_handle_uses_pinned_defaults_and_mutates_fast_threshold() {
        let mut orb = Orb::create(None, None, None, None, None, None, None, None, None)
            .expect("pinned defaults are valid");

        assert_eq!(orb.get_default_name(), "Feature2D.ORB");
        assert_eq!(orb.get_fast_threshold(), 20);
        orb.set_fast_threshold(37);
        assert_eq!(orb.get_fast_threshold(), 37);
    }
}
