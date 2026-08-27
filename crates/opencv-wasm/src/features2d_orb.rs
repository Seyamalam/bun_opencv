//! Independently authored ORB configuration state.

use std::{error::Error, fmt};

#[derive(Debug, Clone, Copy, PartialEq)]
pub(crate) struct OrbParameters {
    pub(crate) max_features: i32,
    pub(crate) scale_factor: f64,
    pub(crate) levels: i32,
    pub(crate) edge_threshold: i32,
    pub(crate) first_level: i32,
    pub(crate) wta_k: i32,
    pub(crate) score_type: i32,
    pub(crate) patch_size: i32,
    pub(crate) fast_threshold: i32,
}

impl Default for OrbParameters {
    fn default() -> Self {
        Self {
            max_features: 500,
            scale_factor: f64::from(1.2_f32),
            levels: 8,
            edge_threshold: 31,
            first_level: 0,
            wta_k: 2,
            score_type: 0,
            patch_size: 31,
            fast_threshold: 20,
        }
    }
}

#[derive(Debug, Clone, PartialEq)]
pub(crate) struct OrbConfig {
    parameters: OrbParameters,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) struct OrbConfigError {
    first_level: i32,
}

impl fmt::Display for OrbConfigError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            formatter,
            "ORB first level must be zero or greater; received {}",
            self.first_level
        )
    }
}

impl Error for OrbConfigError {}

impl Default for OrbConfig {
    fn default() -> Self {
        Self::new(OrbParameters::default()).expect("documented ORB defaults are valid")
    }
}

impl OrbConfig {
    pub(crate) fn new(parameters: OrbParameters) -> Result<Self, OrbConfigError> {
        validate_first_level(parameters.first_level)?;
        Ok(Self { parameters })
    }

    #[cfg(test)]
    pub(crate) fn edge_threshold(&self) -> i32 {
        self.parameters.edge_threshold
    }

    pub(crate) fn fast_threshold(&self) -> i32 {
        self.parameters.fast_threshold
    }

    #[cfg(test)]
    pub(crate) fn first_level(&self) -> i32 {
        self.parameters.first_level
    }

    #[cfg(test)]
    pub(crate) fn levels(&self) -> i32 {
        self.parameters.levels
    }

    #[cfg(test)]
    pub(crate) fn max_features(&self) -> i32 {
        self.parameters.max_features
    }

    #[cfg(test)]
    pub(crate) fn patch_size(&self) -> i32 {
        self.parameters.patch_size
    }

    #[cfg(test)]
    pub(crate) fn scale_factor(&self) -> f64 {
        self.parameters.scale_factor
    }

    #[cfg(test)]
    pub(crate) fn score_type(&self) -> i32 {
        self.parameters.score_type
    }

    #[cfg(test)]
    pub(crate) fn wta_k(&self) -> i32 {
        self.parameters.wta_k
    }

    pub(crate) fn set_edge_threshold(&mut self, value: i32) {
        self.parameters.edge_threshold = value;
    }

    pub(crate) fn set_fast_threshold(&mut self, value: i32) {
        self.parameters.fast_threshold = value;
    }

    pub(crate) fn set_first_level(&mut self, value: i32) -> Result<(), OrbConfigError> {
        validate_first_level(value)?;
        self.parameters.first_level = value;
        Ok(())
    }

    pub(crate) fn set_levels(&mut self, value: i32) {
        self.parameters.levels = value;
    }

    pub(crate) fn set_max_features(&mut self, value: i32) {
        self.parameters.max_features = value;
    }

    pub(crate) fn set_patch_size(&mut self, value: i32) {
        self.parameters.patch_size = value;
    }

    pub(crate) fn set_scale_factor(&mut self, value: f64) {
        self.parameters.scale_factor = value;
    }

    pub(crate) fn set_score_type(&mut self, value: i32) {
        self.parameters.score_type = value;
    }

    pub(crate) fn set_wta_k(&mut self, value: i32) {
        self.parameters.wta_k = value;
    }
}

fn validate_first_level(value: i32) -> Result<(), OrbConfigError> {
    if value >= 0 {
        Ok(())
    } else {
        Err(OrbConfigError { first_level: value })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn defaults_match_the_pinned_constructor() {
        let configuration = OrbConfig::default();

        assert_eq!(configuration.max_features(), 500);
        assert_eq!(
            configuration.scale_factor().to_bits(),
            f64::from(1.2_f32).to_bits()
        );
        assert_eq!(configuration.levels(), 8);
        assert_eq!(configuration.edge_threshold(), 31);
        assert_eq!(configuration.first_level(), 0);
        assert_eq!(configuration.wta_k(), 2);
        assert_eq!(configuration.score_type(), 0);
        assert_eq!(configuration.patch_size(), 31);
        assert_eq!(configuration.fast_threshold(), 20);
    }

    #[test]
    fn setters_preserve_the_observed_scalar_domain() {
        let mut configuration = OrbConfig::default();

        configuration.set_edge_threshold(i32::MIN);
        configuration.set_fast_threshold(i32::MAX);
        configuration.set_levels(-1);
        configuration.set_max_features(i32::MIN);
        configuration.set_patch_size(-1);
        configuration.set_scale_factor(f64::INFINITY);
        configuration.set_score_type(i32::MAX);
        configuration.set_wta_k(-1);
        configuration
            .set_first_level(i32::MAX)
            .expect("non-negative first level");

        assert_eq!(configuration.edge_threshold(), i32::MIN);
        assert_eq!(configuration.fast_threshold(), i32::MAX);
        assert_eq!(configuration.levels(), -1);
        assert_eq!(configuration.max_features(), i32::MIN);
        assert_eq!(configuration.patch_size(), -1);
        assert_eq!(configuration.scale_factor(), f64::INFINITY);
        assert_eq!(configuration.score_type(), i32::MAX);
        assert_eq!(configuration.wta_k(), -1);
        assert_eq!(configuration.first_level(), i32::MAX);
    }

    #[test]
    fn first_level_rejects_negative_values_without_mutation() {
        let mut configuration = OrbConfig::default();

        assert_eq!(
            configuration.set_first_level(-1),
            Err(OrbConfigError { first_level: -1 })
        );
        assert_eq!(configuration.first_level(), 0);
    }
}
