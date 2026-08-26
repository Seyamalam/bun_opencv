//! Browser WebAssembly handle for KAZE configuration.

use wasm_bindgen::prelude::*;

use crate::features2d_kaze::{KazeConfig, KazeParameters};

const DEFAULT_NAME: &str = "Feature2D.KAZE";

/// Owned KAZE configuration handle for the browser package.
///
/// This slice stores configuration only. It does not implement feature detection or descriptor
/// extraction. JavaScript owns each returned handle and releases it through wasm-bindgen's
/// generated `free()` method.
#[wasm_bindgen(js_name = KAZE)]
pub struct Kaze {
    configuration: KazeConfig,
}

#[wasm_bindgen(js_class = KAZE)]
impl Kaze {
    /// Creates an owned configuration handle using `OpenCV` 4.13's documented defaults for omitted
    /// arguments.
    ///
    /// Diffusivity uses the documented numeric values 0 through 3.
    ///
    /// # Errors
    ///
    /// Returns an error before allocating the handle when any numeric parameter is invalid.
    #[wasm_bindgen(js_name = create)]
    pub fn create(
        extended: Option<bool>,
        upright: Option<bool>,
        threshold: Option<f64>,
        octaves: Option<i32>,
        octave_layers: Option<i32>,
        diffusivity: Option<i32>,
    ) -> Result<Kaze, JsError> {
        let defaults = KazeParameters::default();
        let configuration = KazeConfig::new(KazeParameters {
            extended: extended.unwrap_or(defaults.extended),
            upright: upright.unwrap_or(defaults.upright),
            threshold: threshold.unwrap_or(defaults.threshold),
            octaves: octaves.unwrap_or(defaults.octaves),
            octave_layers: octave_layers.unwrap_or(defaults.octave_layers),
            diffusivity: diffusivity.unwrap_or(defaults.diffusivity),
        })
        .map_err(JsError::from)?;
        Ok(Self { configuration })
    }

    #[wasm_bindgen(js_name = getDefaultName)]
    #[allow(clippy::unused_self)]
    pub fn get_default_name(&self) -> String {
        DEFAULT_NAME.to_owned()
    }

    #[wasm_bindgen(js_name = getDiffusivity)]
    pub fn get_diffusivity(&self) -> i32 {
        self.configuration.diffusivity()
    }

    #[wasm_bindgen(js_name = getExtended)]
    pub fn get_extended(&self) -> bool {
        self.configuration.extended()
    }

    #[wasm_bindgen(js_name = getNOctaveLayers)]
    pub fn get_octave_layers(&self) -> i32 {
        self.configuration.octave_layers()
    }

    #[wasm_bindgen(js_name = getNOctaves)]
    pub fn get_octaves(&self) -> i32 {
        self.configuration.octaves()
    }

    #[wasm_bindgen(js_name = getThreshold)]
    pub fn get_threshold(&self) -> f64 {
        self.configuration.threshold()
    }

    #[wasm_bindgen(js_name = getUpright)]
    pub fn get_upright(&self) -> bool {
        self.configuration.upright()
    }

    #[wasm_bindgen(js_name = setDiffusivity)]
    pub fn set_diffusivity(&mut self, value: i32) -> Result<(), JsError> {
        self.configuration
            .set_diffusivity(value)
            .map_err(JsError::from)
    }

    #[wasm_bindgen(js_name = setExtended)]
    pub fn set_extended(&mut self, value: bool) {
        self.configuration.set_extended(value);
    }

    #[wasm_bindgen(js_name = setNOctaveLayers)]
    pub fn set_octave_layers(&mut self, value: i32) -> Result<(), JsError> {
        self.configuration
            .set_octave_layers(value)
            .map_err(JsError::from)
    }

    #[wasm_bindgen(js_name = setNOctaves)]
    pub fn set_octaves(&mut self, value: i32) -> Result<(), JsError> {
        self.configuration.set_octaves(value).map_err(JsError::from)
    }

    #[wasm_bindgen(js_name = setThreshold)]
    /// # Errors
    /// Returns an error without changing the handle when the threshold is non-finite.
    pub fn set_threshold(&mut self, value: f64) -> Result<(), JsError> {
        self.configuration
            .set_threshold(value)
            .map_err(JsError::from)
    }

    #[wasm_bindgen(js_name = setUpright)]
    pub fn set_upright(&mut self, value: bool) {
        self.configuration.set_upright(value);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn exported_factory_applies_documented_defaults() {
        let kaze = Kaze::create(None, None, None, None, None, None)
            .expect("documented defaults are valid");

        assert_eq!(kaze.get_default_name(), "Feature2D.KAZE");
        assert!(!kaze.get_extended());
        assert!(!kaze.get_upright());
        assert_eq!(
            kaze.get_threshold().to_bits(),
            f64::from(0.001_f32).to_bits()
        );
        assert_eq!(kaze.get_octaves(), 4);
        assert_eq!(kaze.get_octave_layers(), 4);
        assert_eq!(kaze.get_diffusivity(), 1);
    }

    #[test]
    fn exported_factory_and_methods_preserve_state() {
        let mut kaze = Kaze::create(
            Some(true),
            Some(true),
            Some(0.05),
            Some(5),
            Some(6),
            Some(2),
        )
        .expect("valid KAZE configuration");

        assert_eq!(kaze.get_default_name(), "Feature2D.KAZE");
        assert!(kaze.get_extended());
        assert!(kaze.get_upright());
        assert_eq!(kaze.get_threshold().to_bits(), 0.05_f64.to_bits());
        assert_eq!(kaze.get_octaves(), 5);
        assert_eq!(kaze.get_octave_layers(), 6);
        assert_eq!(kaze.get_diffusivity(), 2);

        kaze.set_extended(false);
        kaze.set_upright(false);
        kaze.set_threshold(0.1).expect("valid threshold");
        kaze.set_octaves(7).expect("valid octaves");
        kaze.set_octave_layers(8).expect("valid layers");
        kaze.set_diffusivity(3).expect("valid diffusivity");

        assert!(!kaze.get_extended());
        assert!(!kaze.get_upright());
        assert_eq!(kaze.get_threshold().to_bits(), 0.1_f64.to_bits());
        assert_eq!(kaze.get_octaves(), 7);
        assert_eq!(kaze.get_octave_layers(), 8);
        assert_eq!(kaze.get_diffusivity(), 3);
    }
}
