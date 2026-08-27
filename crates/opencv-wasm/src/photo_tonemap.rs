//! Independently authored tone-mapping configuration state.

#[derive(Debug, Clone, Copy, PartialEq)]
pub(crate) struct TonemapDragoConfig {
    gamma: f32,
    saturation: f32,
    bias: f32,
}

impl Default for TonemapDragoConfig {
    fn default() -> Self {
        Self {
            gamma: 1.0,
            saturation: 1.0,
            bias: 0.85,
        }
    }
}

impl TonemapDragoConfig {
    pub(crate) fn new(gamma: f32, saturation: f32, bias: f32) -> Self {
        Self {
            gamma,
            saturation,
            bias,
        }
    }

    pub(crate) fn gamma(self) -> f32 {
        self.gamma
    }

    pub(crate) fn saturation(self) -> f32 {
        self.saturation
    }

    pub(crate) fn bias(self) -> f32 {
        self.bias
    }

    pub(crate) fn set_gamma(&mut self, value: f32) {
        self.gamma = value;
    }

    pub(crate) fn set_saturation(&mut self, value: f32) {
        self.saturation = value;
    }

    pub(crate) fn set_bias(&mut self, value: f32) {
        self.bias = value;
    }
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub(crate) struct TonemapMantiukConfig {
    gamma: f32,
    scale: f32,
    saturation: f32,
}

impl Default for TonemapMantiukConfig {
    fn default() -> Self {
        Self {
            gamma: 1.0,
            scale: 0.7,
            saturation: 1.0,
        }
    }
}

impl TonemapMantiukConfig {
    pub(crate) fn new(gamma: f32, scale: f32, saturation: f32) -> Self {
        Self {
            gamma,
            scale,
            saturation,
        }
    }

    pub(crate) fn gamma(self) -> f32 {
        self.gamma
    }

    pub(crate) fn scale(self) -> f32 {
        self.scale
    }

    pub(crate) fn saturation(self) -> f32 {
        self.saturation
    }

    pub(crate) fn set_gamma(&mut self, value: f32) {
        self.gamma = value;
    }

    pub(crate) fn set_scale(&mut self, value: f32) {
        self.scale = value;
    }

    pub(crate) fn set_saturation(&mut self, value: f32) {
        self.saturation = value;
    }
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub(crate) struct TonemapReinhardConfig {
    gamma: f32,
    intensity: f32,
    light_adaptation: f32,
    color_adaptation: f32,
}

impl Default for TonemapReinhardConfig {
    fn default() -> Self {
        Self {
            gamma: 1.0,
            intensity: 0.0,
            light_adaptation: 1.0,
            color_adaptation: 0.0,
        }
    }
}

impl TonemapReinhardConfig {
    pub(crate) fn new(
        gamma: f32,
        intensity: f32,
        light_adaptation: f32,
        color_adaptation: f32,
    ) -> Self {
        Self {
            gamma,
            intensity,
            light_adaptation,
            color_adaptation,
        }
    }

    pub(crate) fn gamma(self) -> f32 {
        self.gamma
    }

    pub(crate) fn intensity(self) -> f32 {
        self.intensity
    }

    pub(crate) fn light_adaptation(self) -> f32 {
        self.light_adaptation
    }

    pub(crate) fn color_adaptation(self) -> f32 {
        self.color_adaptation
    }

    pub(crate) fn set_gamma(&mut self, value: f32) {
        self.gamma = value;
    }

    pub(crate) fn set_intensity(&mut self, value: f32) {
        self.intensity = value;
    }

    pub(crate) fn set_light_adaptation(&mut self, value: f32) {
        self.light_adaptation = value;
    }

    pub(crate) fn set_color_adaptation(&mut self, value: f32) {
        self.color_adaptation = value;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn drago_uses_the_pinned_browser_defaults() {
        let configuration = TonemapDragoConfig::default();

        assert_eq!(configuration.gamma().to_bits(), 1.0_f32.to_bits());
        assert_eq!(configuration.saturation().to_bits(), 1.0_f32.to_bits());
        assert_eq!(configuration.bias().to_bits(), 0.85_f32.to_bits());
    }

    #[test]
    fn drago_preserves_every_f32_state_value() {
        let mut configuration = TonemapDragoConfig::new(f32::NAN, f32::INFINITY, f32::NEG_INFINITY);

        assert!(configuration.gamma().is_nan());
        assert_eq!(
            configuration.saturation().to_bits(),
            f32::INFINITY.to_bits()
        );
        assert_eq!(configuration.bias().to_bits(), f32::NEG_INFINITY.to_bits());

        configuration.set_gamma(-0.0);
        configuration.set_saturation(-2.25);
        configuration.set_bias(f32::from_bits(1));

        assert_eq!(configuration.gamma().to_bits(), (-0.0_f32).to_bits());
        assert_eq!(configuration.saturation().to_bits(), (-2.25_f32).to_bits());
        assert_eq!(configuration.bias().to_bits(), 1);
    }

    #[test]
    fn mantiuk_defaults_and_mutation_match_the_pinned_browser() {
        let mut configuration = TonemapMantiukConfig::default();

        assert_eq!(configuration.gamma().to_bits(), 1.0_f32.to_bits());
        assert_eq!(configuration.scale().to_bits(), 0.7_f32.to_bits());
        assert_eq!(configuration.saturation().to_bits(), 1.0_f32.to_bits());

        configuration = TonemapMantiukConfig::new(2.0, 3.0, 4.0);
        assert_eq!(configuration.gamma().to_bits(), 2.0_f32.to_bits());
        assert_eq!(configuration.scale().to_bits(), 3.0_f32.to_bits());
        assert_eq!(configuration.saturation().to_bits(), 4.0_f32.to_bits());

        configuration.set_gamma(f32::NAN);
        configuration.set_scale(-0.0);
        configuration.set_saturation(f32::INFINITY);

        assert!(configuration.gamma().is_nan());
        assert_eq!(configuration.scale().to_bits(), (-0.0_f32).to_bits());
        assert_eq!(
            configuration.saturation().to_bits(),
            f32::INFINITY.to_bits()
        );
    }

    #[test]
    fn reinhard_defaults_and_mutation_match_the_pinned_browser() {
        let mut configuration = TonemapReinhardConfig::default();

        assert_eq!(configuration.gamma().to_bits(), 1.0_f32.to_bits());
        assert_eq!(configuration.intensity().to_bits(), 0.0_f32.to_bits());
        assert_eq!(
            configuration.light_adaptation().to_bits(),
            1.0_f32.to_bits()
        );
        assert_eq!(
            configuration.color_adaptation().to_bits(),
            0.0_f32.to_bits()
        );

        configuration = TonemapReinhardConfig::new(2.0, -1.0, 0.5, 0.25);
        assert_eq!(configuration.gamma().to_bits(), 2.0_f32.to_bits());
        assert_eq!(configuration.intensity().to_bits(), (-1.0_f32).to_bits());
        assert_eq!(
            configuration.light_adaptation().to_bits(),
            0.5_f32.to_bits()
        );
        assert_eq!(
            configuration.color_adaptation().to_bits(),
            0.25_f32.to_bits()
        );

        configuration.set_gamma(f32::NEG_INFINITY);
        configuration.set_intensity(-2.25);
        configuration.set_light_adaptation(f32::NAN);
        configuration.set_color_adaptation(-0.0);

        assert_eq!(configuration.gamma().to_bits(), f32::NEG_INFINITY.to_bits());
        assert_eq!(configuration.intensity().to_bits(), (-2.25_f32).to_bits());
        assert!(configuration.light_adaptation().is_nan());
        assert_eq!(
            configuration.color_adaptation().to_bits(),
            (-0.0_f32).to_bits()
        );
    }
}
