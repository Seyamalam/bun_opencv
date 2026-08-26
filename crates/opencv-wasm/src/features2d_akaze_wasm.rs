//! Browser WebAssembly handle for AKAZE configuration.

use wasm_bindgen::prelude::*;

use crate::features2d_akaze::{AkazeConfig, AkazeParameters};

const DEFAULT_NAME: &str = "Feature2D.AKAZE";

/// Owned AKAZE configuration handle for the browser package.
///
/// This slice stores configuration only. It does not implement feature detection or descriptor
/// extraction. JavaScript owns each returned handle and releases it through wasm-bindgen's
/// generated `free()` method.
#[wasm_bindgen(js_name = AKAZE)]
pub struct Akaze {
    configuration: AkazeConfig,
}

#[wasm_bindgen(js_class = AKAZE)]
impl Akaze {
    /// Creates an owned configuration handle using `OpenCV` 4.13's documented defaults for omitted
    /// arguments.
    ///
    /// Descriptor types use the documented numeric values 2 through 5. Diffusivity uses the
    /// documented numeric values 0 through 3. `max_points` is retained for constructor parity,
    /// although its accessor is outside this configuration slice.
    ///
    /// # Errors
    ///
    /// Returns an error before allocating the handle when any parameter is invalid.
    #[wasm_bindgen(js_name = create)]
    #[allow(clippy::too_many_arguments)]
    pub fn create(
        descriptor_type: Option<i32>,
        descriptor_size: Option<i32>,
        descriptor_channels: Option<i32>,
        threshold: Option<f64>,
        octaves: Option<i32>,
        octave_layers: Option<i32>,
        diffusivity: Option<i32>,
        max_points: Option<i32>,
    ) -> Result<Akaze, JsError> {
        let defaults = AkazeParameters::default();
        let configuration = AkazeConfig::new(AkazeParameters {
            descriptor_type: descriptor_type.unwrap_or(defaults.descriptor_type),
            descriptor_size: descriptor_size.unwrap_or(defaults.descriptor_size),
            descriptor_channels: descriptor_channels.unwrap_or(defaults.descriptor_channels),
            threshold: threshold.unwrap_or(defaults.threshold),
            octaves: octaves.unwrap_or(defaults.octaves),
            octave_layers: octave_layers.unwrap_or(defaults.octave_layers),
            diffusivity: diffusivity.unwrap_or(defaults.diffusivity),
            max_points: max_points.unwrap_or(defaults.max_points),
        })
        .map_err(JsError::from)?;
        Ok(Self { configuration })
    }

    #[wasm_bindgen(js_name = getDefaultName)]
    #[allow(clippy::unused_self)]
    pub fn get_default_name(&self) -> String {
        DEFAULT_NAME.to_owned()
    }

    #[wasm_bindgen(js_name = getDescriptorChannels)]
    pub fn get_descriptor_channels(&self) -> i32 {
        self.configuration.descriptor_channels()
    }

    #[wasm_bindgen(js_name = getDescriptorSize)]
    pub fn get_descriptor_size(&self) -> i32 {
        self.configuration.descriptor_size()
    }

    #[wasm_bindgen(js_name = getDescriptorType)]
    pub fn get_descriptor_type(&self) -> i32 {
        self.configuration.descriptor_type()
    }

    #[wasm_bindgen(js_name = getDiffusivity)]
    pub fn get_diffusivity(&self) -> i32 {
        self.configuration.diffusivity()
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

    /// Stores the signed 32-bit wire value produced by the JavaScript enum binding.
    #[wasm_bindgen(js_name = setDescriptorType)]
    pub fn set_descriptor_type(&mut self, value: i32) {
        self.configuration.set_descriptor_type(value);
    }

    /// Stores the signed 32-bit value produced by the JavaScript binding.
    #[wasm_bindgen(js_name = setDescriptorSize)]
    pub fn set_descriptor_size(&mut self, value: i32) {
        self.configuration.set_descriptor_size(value);
    }

    /// Stores the signed 32-bit value produced by the JavaScript binding.
    #[wasm_bindgen(js_name = setDescriptorChannels)]
    pub fn set_descriptor_channels(&mut self, value: i32) {
        self.configuration.set_descriptor_channels(value);
    }

    /// Stores the double value produced by the JavaScript binding, including non-finite values.
    #[wasm_bindgen(js_name = setThreshold)]
    pub fn set_threshold(&mut self, value: f64) {
        self.configuration.set_threshold(value);
    }

    /// Stores the signed 32-bit value produced by the JavaScript binding.
    #[wasm_bindgen(js_name = setNOctaves)]
    pub fn set_octaves(&mut self, value: i32) {
        self.configuration.set_octaves(value);
    }

    /// Stores the signed 32-bit value produced by the JavaScript binding.
    #[wasm_bindgen(js_name = setNOctaveLayers)]
    pub fn set_octave_layers(&mut self, value: i32) {
        self.configuration.set_octave_layers(value);
    }

    /// Stores the signed 32-bit wire value produced by the JavaScript enum binding.
    #[wasm_bindgen(js_name = setDiffusivity)]
    pub fn set_diffusivity(&mut self, value: i32) {
        self.configuration.set_diffusivity(value);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn exported_factory_applies_documented_defaults() {
        let akaze = Akaze::create(None, None, None, None, None, None, None, None)
            .expect("documented defaults are valid");

        assert_eq!(akaze.get_default_name(), "Feature2D.AKAZE");
        assert_eq!(akaze.get_descriptor_type(), 5);
        assert_eq!(akaze.get_descriptor_size(), 0);
        assert_eq!(akaze.get_descriptor_channels(), 3);
        assert_eq!(
            akaze.get_threshold().to_bits(),
            f64::from(0.001_f32).to_bits()
        );
        assert_eq!(akaze.get_octaves(), 4);
        assert_eq!(akaze.get_octave_layers(), 4);
        assert_eq!(akaze.get_diffusivity(), 1);
    }

    #[test]
    fn exported_factory_and_methods_preserve_state() {
        let mut akaze = Akaze::create(
            Some(4),
            Some(96),
            Some(2),
            Some(0.05),
            Some(5),
            Some(6),
            Some(2),
            Some(300),
        )
        .expect("valid AKAZE configuration");

        assert_eq!(akaze.get_default_name(), "Feature2D.AKAZE");
        assert_eq!(akaze.get_descriptor_type(), 4);
        assert_eq!(akaze.get_descriptor_size(), 96);
        assert_eq!(akaze.get_descriptor_channels(), 2);
        assert_eq!(akaze.get_threshold().to_bits(), 0.05_f64.to_bits());
        assert_eq!(akaze.get_octaves(), 5);
        assert_eq!(akaze.get_octave_layers(), 6);
        assert_eq!(akaze.get_diffusivity(), 2);

        akaze.set_descriptor_type(3);
        akaze.set_descriptor_size(128);
        akaze.set_descriptor_channels(3);
        akaze.set_threshold(0.1);
        akaze.set_octaves(7);
        akaze.set_octave_layers(8);
        akaze.set_diffusivity(3);

        assert_eq!(akaze.get_descriptor_type(), 3);
        assert_eq!(akaze.get_descriptor_size(), 128);
        assert_eq!(akaze.get_descriptor_channels(), 3);
        assert_eq!(akaze.get_threshold().to_bits(), 0.1_f64.to_bits());
        assert_eq!(akaze.get_octaves(), 7);
        assert_eq!(akaze.get_octave_layers(), 8);
        assert_eq!(akaze.get_diffusivity(), 3);
    }

    #[test]
    fn primitive_setters_preserve_wasm_boundary_values() {
        let mut akaze = Akaze::create(None, None, None, None, None, None, None, None)
            .expect("documented defaults are valid");

        akaze.set_descriptor_channels(i32::MIN);
        akaze.set_descriptor_size(i32::MAX);
        akaze.set_octave_layers(0);
        akaze.set_octaves(-1);
        assert_eq!(akaze.get_descriptor_channels(), i32::MIN);
        assert_eq!(akaze.get_descriptor_size(), i32::MAX);
        assert_eq!(akaze.get_octave_layers(), 0);
        assert_eq!(akaze.get_octaves(), -1);

        for threshold in [-0.0, f64::NAN, f64::INFINITY, f64::NEG_INFINITY] {
            akaze.set_threshold(threshold);
            assert_eq!(akaze.get_threshold().to_bits(), threshold.to_bits());
        }
    }

    #[test]
    fn enum_setters_preserve_unknown_wasm_wire_codes() {
        let mut akaze = Akaze::create(None, None, None, None, None, None, None, None)
            .expect("documented defaults are valid");

        akaze.set_descriptor_type(i32::MIN);
        akaze.set_diffusivity(i32::MAX);

        assert_eq!(akaze.get_descriptor_type(), i32::MIN);
        assert_eq!(akaze.get_diffusivity(), i32::MAX);
    }
}
