//! Independently authored GFTT detector configuration state.

#[derive(Debug, Clone, PartialEq)]
pub(crate) struct GfttConfig {
    max_features: i32,
    quality_level: f64,
    min_distance: f64,
    block_size: i32,
    harris_detector: bool,
    k: f64,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub(crate) struct GfttParameters {
    pub(crate) max_features: i32,
    pub(crate) quality_level: f64,
    pub(crate) min_distance: f64,
    pub(crate) block_size: i32,
    pub(crate) harris_detector: bool,
    pub(crate) k: f64,
}

impl Default for GfttParameters {
    fn default() -> Self {
        Self {
            max_features: 1_000,
            quality_level: 0.01,
            min_distance: 1.0,
            block_size: 3,
            harris_detector: false,
            k: 0.04,
        }
    }
}

impl Default for GfttConfig {
    fn default() -> Self {
        Self::new(GfttParameters::default())
    }
}

impl GfttConfig {
    pub(crate) fn new(parameters: GfttParameters) -> Self {
        Self {
            max_features: parameters.max_features,
            quality_level: parameters.quality_level,
            min_distance: parameters.min_distance,
            block_size: parameters.block_size,
            harris_detector: parameters.harris_detector,
            k: parameters.k,
        }
    }

    pub(crate) fn max_features(&self) -> i32 {
        self.max_features
    }

    pub(crate) fn quality_level(&self) -> f64 {
        self.quality_level
    }

    pub(crate) fn min_distance(&self) -> f64 {
        self.min_distance
    }

    pub(crate) fn block_size(&self) -> i32 {
        self.block_size
    }

    pub(crate) fn harris_detector(&self) -> bool {
        self.harris_detector
    }

    pub(crate) fn k(&self) -> f64 {
        self.k
    }

    pub(crate) fn set_max_features(&mut self, value: i32) {
        self.max_features = value;
    }

    pub(crate) fn set_quality_level(&mut self, value: f64) {
        self.quality_level = value;
    }

    pub(crate) fn set_min_distance(&mut self, value: f64) {
        self.min_distance = value;
    }

    pub(crate) fn set_block_size(&mut self, value: i32) {
        self.block_size = value;
    }

    pub(crate) fn set_harris_detector(&mut self, value: bool) {
        self.harris_detector = value;
    }

    pub(crate) fn set_k(&mut self, value: f64) {
        self.k = value;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn documented_constructor_defaults_are_stable() {
        let configuration = GfttConfig::default();

        assert_eq!(configuration.max_features(), 1_000);
        assert_eq!(configuration.quality_level().to_bits(), 0.01_f64.to_bits());
        assert_eq!(configuration.min_distance().to_bits(), 1.0_f64.to_bits());
        assert_eq!(configuration.block_size(), 3);
        assert!(!configuration.harris_detector());
        assert_eq!(configuration.k().to_bits(), 0.04_f64.to_bits());
    }

    #[test]
    fn constructor_preserves_every_representable_configuration_value() {
        let configuration = GfttConfig::new(GfttParameters {
            max_features: i32::MIN,
            quality_level: f64::NAN,
            min_distance: f64::NEG_INFINITY,
            block_size: i32::MAX,
            harris_detector: true,
            k: f64::INFINITY,
        });

        assert_eq!(configuration.max_features(), i32::MIN);
        assert!(configuration.quality_level().is_nan());
        assert_eq!(
            configuration.min_distance().to_bits(),
            f64::NEG_INFINITY.to_bits()
        );
        assert_eq!(configuration.block_size(), i32::MAX);
        assert!(configuration.harris_detector());
        assert_eq!(configuration.k().to_bits(), f64::INFINITY.to_bits());
    }

    #[test]
    fn setters_replace_each_configuration_value_without_extra_validation() {
        let mut configuration = GfttConfig::default();

        configuration.set_max_features(-1);
        configuration.set_quality_level(f64::NEG_INFINITY);
        configuration.set_min_distance(f64::NAN);
        configuration.set_block_size(0);
        configuration.set_harris_detector(true);
        configuration.set_k(f64::INFINITY);

        assert_eq!(configuration.max_features(), -1);
        assert_eq!(
            configuration.quality_level().to_bits(),
            f64::NEG_INFINITY.to_bits()
        );
        assert!(configuration.min_distance().is_nan());
        assert_eq!(configuration.block_size(), 0);
        assert!(configuration.harris_detector());
        assert_eq!(configuration.k().to_bits(), f64::INFINITY.to_bits());
    }
}
