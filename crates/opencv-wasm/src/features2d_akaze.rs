//! Independently authored AKAZE configuration state.

use std::{error::Error, fmt};

const DESCRIPTOR_MLDB: i32 = 5;
const DIFF_PM_G2: i32 = 1;

#[derive(Debug, Clone, PartialEq)]
pub(crate) struct AkazeConfig {
    descriptor_type: i32,
    descriptor_size: i32,
    descriptor_channels: i32,
    threshold: f64,
    octaves: i32,
    octave_layers: i32,
    diffusivity: i32,
    max_points: i32,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub(crate) struct AkazeParameters {
    pub(crate) descriptor_type: i32,
    pub(crate) descriptor_size: i32,
    pub(crate) descriptor_channels: i32,
    pub(crate) threshold: f64,
    pub(crate) octaves: i32,
    pub(crate) octave_layers: i32,
    pub(crate) diffusivity: i32,
    pub(crate) max_points: i32,
}

impl Default for AkazeParameters {
    fn default() -> Self {
        Self {
            descriptor_type: DESCRIPTOR_MLDB,
            descriptor_size: 0,
            descriptor_channels: 3,
            threshold: f64::from(0.001_f32),
            octaves: 4,
            octave_layers: 4,
            diffusivity: DIFF_PM_G2,
            max_points: -1,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum AkazeConfigError {
    DescriptorType(i32),
    DescriptorSize(i32),
    DescriptorChannels(i32),
    Threshold,
    Octaves(i32),
    OctaveLayers(i32),
    Diffusivity(i32),
}

impl fmt::Display for AkazeConfigError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::DescriptorType(value) => write!(
                formatter,
                "AKAZE descriptor type must be one of 2, 3, 4, or 5; received {value}"
            ),
            Self::DescriptorSize(value) => write!(
                formatter,
                "AKAZE descriptor size must be zero or greater; received {value}"
            ),
            Self::DescriptorChannels(value) => write!(
                formatter,
                "AKAZE descriptor channels must be 1, 2, or 3; received {value}"
            ),
            Self::Threshold => {
                formatter.write_str("AKAZE threshold must be finite and zero or greater")
            }
            Self::Octaves(value) => write!(
                formatter,
                "AKAZE octave count must be greater than zero; received {value}"
            ),
            Self::OctaveLayers(value) => write!(
                formatter,
                "AKAZE octave layer count must be greater than zero; received {value}"
            ),
            Self::Diffusivity(value) => write!(
                formatter,
                "AKAZE diffusivity must be one of 0, 1, 2, or 3; received {value}"
            ),
        }
    }
}

impl Error for AkazeConfigError {}

impl Default for AkazeConfig {
    fn default() -> Self {
        Self::new(AkazeParameters::default()).expect("documented defaults are valid")
    }
}

impl AkazeConfig {
    pub(crate) fn new(parameters: AkazeParameters) -> Result<Self, AkazeConfigError> {
        validate_descriptor_type(parameters.descriptor_type)?;
        validate_descriptor_size(parameters.descriptor_size)?;
        validate_descriptor_channels(parameters.descriptor_channels)?;
        validate_threshold(parameters.threshold)?;
        validate_octaves(parameters.octaves)?;
        validate_octave_layers(parameters.octave_layers)?;
        validate_diffusivity(parameters.diffusivity)?;

        Ok(Self {
            descriptor_type: parameters.descriptor_type,
            descriptor_size: parameters.descriptor_size,
            descriptor_channels: parameters.descriptor_channels,
            threshold: parameters.threshold,
            octaves: parameters.octaves,
            octave_layers: parameters.octave_layers,
            diffusivity: parameters.diffusivity,
            max_points: parameters.max_points,
        })
    }

    pub(crate) fn descriptor_type(&self) -> i32 {
        self.descriptor_type
    }

    pub(crate) fn descriptor_size(&self) -> i32 {
        self.descriptor_size
    }

    pub(crate) fn descriptor_channels(&self) -> i32 {
        self.descriptor_channels
    }

    pub(crate) fn threshold(&self) -> f64 {
        self.threshold
    }

    pub(crate) fn octaves(&self) -> i32 {
        self.octaves
    }

    pub(crate) fn octave_layers(&self) -> i32 {
        self.octave_layers
    }

    pub(crate) fn diffusivity(&self) -> i32 {
        self.diffusivity
    }

    #[cfg(test)]
    pub(crate) fn max_points(&self) -> i32 {
        self.max_points
    }

    pub(crate) fn set_descriptor_type(&mut self, value: i32) {
        self.descriptor_type = value;
    }

    pub(crate) fn set_descriptor_size(&mut self, value: i32) {
        self.descriptor_size = value;
    }

    pub(crate) fn set_descriptor_channels(&mut self, value: i32) {
        self.descriptor_channels = value;
    }

    pub(crate) fn set_threshold(&mut self, value: f64) {
        self.threshold = value;
    }

    pub(crate) fn set_octaves(&mut self, value: i32) {
        self.octaves = value;
    }

    pub(crate) fn set_octave_layers(&mut self, value: i32) {
        self.octave_layers = value;
    }

    pub(crate) fn set_diffusivity(&mut self, value: i32) {
        self.diffusivity = value;
    }
}

fn validate_descriptor_type(value: i32) -> Result<(), AkazeConfigError> {
    if matches!(value, 2..=5) {
        Ok(())
    } else {
        Err(AkazeConfigError::DescriptorType(value))
    }
}

fn validate_descriptor_size(value: i32) -> Result<(), AkazeConfigError> {
    if value >= 0 {
        Ok(())
    } else {
        Err(AkazeConfigError::DescriptorSize(value))
    }
}

fn validate_descriptor_channels(value: i32) -> Result<(), AkazeConfigError> {
    if matches!(value, 1..=3) {
        Ok(())
    } else {
        Err(AkazeConfigError::DescriptorChannels(value))
    }
}

fn validate_threshold(value: f64) -> Result<(), AkazeConfigError> {
    if value.is_finite() && value >= 0.0 {
        Ok(())
    } else {
        Err(AkazeConfigError::Threshold)
    }
}

fn validate_octaves(value: i32) -> Result<(), AkazeConfigError> {
    if value > 0 {
        Ok(())
    } else {
        Err(AkazeConfigError::Octaves(value))
    }
}

fn validate_octave_layers(value: i32) -> Result<(), AkazeConfigError> {
    if value > 0 {
        Ok(())
    } else {
        Err(AkazeConfigError::OctaveLayers(value))
    }
}

fn validate_diffusivity(value: i32) -> Result<(), AkazeConfigError> {
    if matches!(value, 0..=3) {
        Ok(())
    } else {
        Err(AkazeConfigError::Diffusivity(value))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn documented_constructor_defaults_are_stable() {
        let configuration = AkazeConfig::default();

        assert_eq!(configuration.descriptor_type(), 5);
        assert_eq!(configuration.descriptor_size(), 0);
        assert_eq!(configuration.descriptor_channels(), 3);
        assert_eq!(
            configuration.threshold().to_bits(),
            f64::from(0.001_f32).to_bits()
        );
        assert_eq!(configuration.octaves(), 4);
        assert_eq!(configuration.octave_layers(), 4);
        assert_eq!(configuration.diffusivity(), 1);
        assert_eq!(configuration.max_points(), -1);
    }

    #[test]
    fn constructor_keeps_a_valid_explicit_configuration() {
        let configuration = AkazeConfig::new(AkazeParameters {
            descriptor_type: 2,
            descriptor_size: 128,
            descriptor_channels: 1,
            threshold: 0.25,
            octaves: 3,
            octave_layers: 6,
            diffusivity: 3,
            max_points: 250,
        })
        .expect("valid configuration");

        assert_eq!(configuration.descriptor_type(), 2);
        assert_eq!(configuration.descriptor_size(), 128);
        assert_eq!(configuration.descriptor_channels(), 1);
        assert_eq!(configuration.threshold().to_bits(), 0.25_f64.to_bits());
        assert_eq!(configuration.octaves(), 3);
        assert_eq!(configuration.octave_layers(), 6);
        assert_eq!(configuration.diffusivity(), 3);
        assert_eq!(configuration.max_points(), 250);
    }

    #[test]
    fn constructor_rejects_out_of_range_and_non_finite_values() {
        let defaults = AkazeParameters::default();
        let invalid = [
            (
                AkazeParameters {
                    descriptor_type: 1,
                    ..defaults
                },
                AkazeConfigError::DescriptorType(1),
            ),
            (
                AkazeParameters {
                    descriptor_size: -1,
                    ..defaults
                },
                AkazeConfigError::DescriptorSize(-1),
            ),
            (
                AkazeParameters {
                    descriptor_channels: 4,
                    ..defaults
                },
                AkazeConfigError::DescriptorChannels(4),
            ),
            (
                AkazeParameters {
                    threshold: f64::NAN,
                    ..defaults
                },
                AkazeConfigError::Threshold,
            ),
            (
                AkazeParameters {
                    threshold: -0.01,
                    ..defaults
                },
                AkazeConfigError::Threshold,
            ),
            (
                AkazeParameters {
                    octaves: 0,
                    ..defaults
                },
                AkazeConfigError::Octaves(0),
            ),
            (
                AkazeParameters {
                    octave_layers: 0,
                    ..defaults
                },
                AkazeConfigError::OctaveLayers(0),
            ),
            (
                AkazeParameters {
                    diffusivity: 4,
                    ..defaults
                },
                AkazeConfigError::Diffusivity(4),
            ),
        ];

        for (parameters, expected) in invalid {
            assert_eq!(AkazeConfig::new(parameters), Err(expected));
        }
    }

    #[test]
    fn setters_replace_each_mutable_configuration_value() {
        let mut configuration = AkazeConfig::default();

        configuration.set_descriptor_type(2);
        configuration.set_descriptor_size(64);
        configuration.set_descriptor_channels(1);
        configuration.set_threshold(0.125);
        configuration.set_octaves(6);
        configuration.set_octave_layers(8);
        configuration.set_diffusivity(3);

        assert_eq!(configuration.descriptor_type(), 2);
        assert_eq!(configuration.descriptor_size(), 64);
        assert_eq!(configuration.descriptor_channels(), 1);
        assert_eq!(configuration.threshold().to_bits(), 0.125_f64.to_bits());
        assert_eq!(configuration.octaves(), 6);
        assert_eq!(configuration.octave_layers(), 8);
        assert_eq!(configuration.diffusivity(), 3);
    }

    #[test]
    fn enum_setters_preserve_unknown_wire_codes() {
        let mut configuration = AkazeConfig::default();

        for value in [i32::MIN, -1, 0, 6, i32::MAX] {
            configuration.set_descriptor_type(value);
            assert_eq!(configuration.descriptor_type(), value);

            configuration.set_diffusivity(value);
            assert_eq!(configuration.diffusivity(), value);
        }
    }

    #[test]
    fn primitive_setters_preserve_the_complete_wasm_scalar_domain() {
        let mut configuration = AkazeConfig::default();

        for value in [i32::MIN, -1, 0, i32::MAX] {
            configuration.set_descriptor_channels(value);
            assert_eq!(configuration.descriptor_channels(), value);

            configuration.set_descriptor_size(value);
            assert_eq!(configuration.descriptor_size(), value);

            configuration.set_octave_layers(value);
            assert_eq!(configuration.octave_layers(), value);

            configuration.set_octaves(value);
            assert_eq!(configuration.octaves(), value);
        }

        for threshold in [-0.0, f64::NAN, f64::INFINITY, f64::NEG_INFINITY] {
            configuration.set_threshold(threshold);
            assert_eq!(configuration.threshold().to_bits(), threshold.to_bits());
        }
    }
}
