//! Browser WebAssembly handles for independently authored tone-mapping state.

use wasm_bindgen::prelude::*;

use crate::photo_tonemap::{TonemapDragoConfig, TonemapMantiukConfig, TonemapReinhardConfig};

#[wasm_bindgen(js_name = TonemapDrago)]
pub struct TonemapDrago {
    configuration: TonemapDragoConfig,
}

#[wasm_bindgen(js_class = TonemapDrago)]
impl TonemapDrago {
    #[wasm_bindgen(js_name = create)]
    pub fn create(gamma: Option<f32>, saturation: Option<f32>, bias: Option<f32>) -> Self {
        let defaults = TonemapDragoConfig::default();
        Self {
            configuration: TonemapDragoConfig::new(
                gamma.unwrap_or(defaults.gamma()),
                saturation.unwrap_or(defaults.saturation()),
                bias.unwrap_or(defaults.bias()),
            ),
        }
    }

    #[wasm_bindgen(js_name = getGamma)]
    pub fn get_gamma(&self) -> f32 {
        self.configuration.gamma()
    }

    #[wasm_bindgen(js_name = getBias)]
    pub fn get_bias(&self) -> f32 {
        self.configuration.bias()
    }

    #[wasm_bindgen(js_name = getSaturation)]
    pub fn get_saturation(&self) -> f32 {
        self.configuration.saturation()
    }

    #[wasm_bindgen(js_name = setGamma)]
    pub fn set_gamma(&mut self, value: f32) {
        self.configuration.set_gamma(value);
    }

    #[wasm_bindgen(js_name = setBias)]
    pub fn set_bias(&mut self, value: f32) {
        self.configuration.set_bias(value);
    }

    #[wasm_bindgen(js_name = setSaturation)]
    pub fn set_saturation(&mut self, value: f32) {
        self.configuration.set_saturation(value);
    }
}

#[wasm_bindgen(js_name = TonemapMantiuk)]
pub struct TonemapMantiuk {
    configuration: TonemapMantiukConfig,
}

#[wasm_bindgen(js_class = TonemapMantiuk)]
impl TonemapMantiuk {
    #[wasm_bindgen(js_name = create)]
    pub fn create(gamma: Option<f32>, scale: Option<f32>, saturation: Option<f32>) -> Self {
        let defaults = TonemapMantiukConfig::default();
        Self {
            configuration: TonemapMantiukConfig::new(
                gamma.unwrap_or(defaults.gamma()),
                scale.unwrap_or(defaults.scale()),
                saturation.unwrap_or(defaults.saturation()),
            ),
        }
    }

    #[wasm_bindgen(js_name = getGamma)]
    pub fn get_gamma(&self) -> f32 {
        self.configuration.gamma()
    }

    #[wasm_bindgen(js_name = getSaturation)]
    pub fn get_saturation(&self) -> f32 {
        self.configuration.saturation()
    }

    #[wasm_bindgen(js_name = getScale)]
    pub fn get_scale(&self) -> f32 {
        self.configuration.scale()
    }

    #[wasm_bindgen(js_name = setGamma)]
    pub fn set_gamma(&mut self, value: f32) {
        self.configuration.set_gamma(value);
    }

    #[wasm_bindgen(js_name = setSaturation)]
    pub fn set_saturation(&mut self, value: f32) {
        self.configuration.set_saturation(value);
    }

    #[wasm_bindgen(js_name = setScale)]
    pub fn set_scale(&mut self, value: f32) {
        self.configuration.set_scale(value);
    }
}

#[wasm_bindgen(js_name = TonemapReinhard)]
pub struct TonemapReinhard {
    configuration: TonemapReinhardConfig,
}

#[wasm_bindgen(js_class = TonemapReinhard)]
impl TonemapReinhard {
    #[wasm_bindgen(js_name = create)]
    pub fn create(
        gamma: Option<f32>,
        intensity: Option<f32>,
        light_adaptation: Option<f32>,
        color_adaptation: Option<f32>,
    ) -> Self {
        let defaults = TonemapReinhardConfig::default();
        Self {
            configuration: TonemapReinhardConfig::new(
                gamma.unwrap_or(defaults.gamma()),
                intensity.unwrap_or(defaults.intensity()),
                light_adaptation.unwrap_or(defaults.light_adaptation()),
                color_adaptation.unwrap_or(defaults.color_adaptation()),
            ),
        }
    }

    #[wasm_bindgen(js_name = getGamma)]
    pub fn get_gamma(&self) -> f32 {
        self.configuration.gamma()
    }

    #[wasm_bindgen(js_name = getColorAdaptation)]
    pub fn get_color_adaptation(&self) -> f32 {
        self.configuration.color_adaptation()
    }

    #[wasm_bindgen(js_name = getIntensity)]
    pub fn get_intensity(&self) -> f32 {
        self.configuration.intensity()
    }

    #[wasm_bindgen(js_name = getLightAdaptation)]
    pub fn get_light_adaptation(&self) -> f32 {
        self.configuration.light_adaptation()
    }

    #[wasm_bindgen(js_name = setGamma)]
    pub fn set_gamma(&mut self, value: f32) {
        self.configuration.set_gamma(value);
    }

    #[wasm_bindgen(js_name = setColorAdaptation)]
    pub fn set_color_adaptation(&mut self, value: f32) {
        self.configuration.set_color_adaptation(value);
    }

    #[wasm_bindgen(js_name = setIntensity)]
    pub fn set_intensity(&mut self, value: f32) {
        self.configuration.set_intensity(value);
    }

    #[wasm_bindgen(js_name = setLightAdaptation)]
    pub fn set_light_adaptation(&mut self, value: f32) {
        self.configuration.set_light_adaptation(value);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn drago_factory_and_methods_preserve_f32_state() {
        let mut tonemap = TonemapDrago::create(Some(-0.0), Some(f32::NAN), Some(f32::INFINITY));

        assert_eq!(tonemap.get_gamma().to_bits(), (-0.0_f32).to_bits());
        assert!(tonemap.get_saturation().is_nan());
        assert_eq!(tonemap.get_bias().to_bits(), f32::INFINITY.to_bits());

        tonemap.set_gamma(-2.25);
        tonemap.set_saturation(f32::NEG_INFINITY);
        tonemap.set_bias(f32::from_bits(1));
        assert_eq!(tonemap.get_gamma().to_bits(), (-2.25_f32).to_bits());
        assert_eq!(
            tonemap.get_saturation().to_bits(),
            f32::NEG_INFINITY.to_bits()
        );
        assert_eq!(tonemap.get_bias().to_bits(), 1);
    }

    #[test]
    fn mantiuk_factory_applies_each_omitted_default() {
        let tonemap = TonemapMantiuk::create(None, None, None);

        assert_eq!(tonemap.get_gamma().to_bits(), 1.0_f32.to_bits());
        assert_eq!(tonemap.get_scale().to_bits(), 0.7_f32.to_bits());
        assert_eq!(tonemap.get_saturation().to_bits(), 1.0_f32.to_bits());
    }

    #[test]
    fn reinhard_factory_and_methods_preserve_f32_state() {
        let mut tonemap = TonemapReinhard::create(Some(2.0), Some(-1.0), Some(0.5), Some(0.25));

        tonemap.set_gamma(f32::NAN);
        tonemap.set_intensity(f32::INFINITY);
        tonemap.set_light_adaptation(f32::NEG_INFINITY);
        tonemap.set_color_adaptation(-0.0);

        assert!(tonemap.get_gamma().is_nan());
        assert_eq!(tonemap.get_intensity().to_bits(), f32::INFINITY.to_bits());
        assert_eq!(
            tonemap.get_light_adaptation().to_bits(),
            f32::NEG_INFINITY.to_bits()
        );
        assert_eq!(
            tonemap.get_color_adaptation().to_bits(),
            (-0.0_f32).to_bits()
        );
    }
}
