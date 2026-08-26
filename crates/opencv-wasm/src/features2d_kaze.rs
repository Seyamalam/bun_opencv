//! Independently authored KAZE configuration state.

use std::{error::Error, fmt};

const DIFF_PM_G2: i32 = 1;

#[derive(Debug, Clone, PartialEq)]
pub(crate) struct KazeConfig {
    extended: bool,
    upright: bool,
    threshold: f64,
    octaves: i32,
    octave_layers: i32,
    diffusivity: i32,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub(crate) struct KazeParameters {
    pub(crate) extended: bool,
    pub(crate) upright: bool,
    pub(crate) threshold: f64,
    pub(crate) octaves: i32,
    pub(crate) octave_layers: i32,
    pub(crate) diffusivity: i32,
}

impl Default for KazeParameters {
    fn default() -> Self {
        Self {
            extended: false,
            upright: false,
            threshold: f64::from(0.001_f32),
            octaves: 4,
            octave_layers: 4,
            diffusivity: DIFF_PM_G2,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum KazeConfigError {
    Threshold,
    Octaves(i32),
    OctaveLayers(i32),
    Diffusivity(i32),
}

impl fmt::Display for KazeConfigError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Threshold => formatter.write_str("KAZE threshold must be finite"),
            Self::Octaves(value) => write!(
                formatter,
                "KAZE octave count must be greater than zero; received {value}"
            ),
            Self::OctaveLayers(value) => write!(
                formatter,
                "KAZE octave layer count must be greater than zero; received {value}"
            ),
            Self::Diffusivity(value) => write!(
                formatter,
                "KAZE diffusivity must be one of 0, 1, 2, or 3; received {value}"
            ),
        }
    }
}

impl Error for KazeConfigError {}

impl Default for KazeConfig {
    fn default() -> Self {
        Self::new(KazeParameters::default()).expect("documented defaults are valid")
    }
}

impl KazeConfig {
    pub(crate) fn new(parameters: KazeParameters) -> Result<Self, KazeConfigError> {
        validate_threshold(parameters.threshold)?;
        validate_octaves(parameters.octaves)?;
        validate_octave_layers(parameters.octave_layers)?;
        validate_diffusivity(parameters.diffusivity)?;

        Ok(Self {
            extended: parameters.extended,
            upright: parameters.upright,
            threshold: parameters.threshold,
            octaves: parameters.octaves,
            octave_layers: parameters.octave_layers,
            diffusivity: parameters.diffusivity,
        })
    }

    pub(crate) fn extended(&self) -> bool {
        self.extended
    }

    pub(crate) fn upright(&self) -> bool {
        self.upright
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

    pub(crate) fn set_extended(&mut self, value: bool) {
        self.extended = value;
    }

    pub(crate) fn set_upright(&mut self, value: bool) {
        self.upright = value;
    }

    pub(crate) fn set_threshold(&mut self, value: f64) -> Result<(), KazeConfigError> {
        validate_threshold(value)?;
        self.threshold = value;
        Ok(())
    }

    pub(crate) fn set_octaves(&mut self, value: i32) -> Result<(), KazeConfigError> {
        validate_octaves(value)?;
        self.octaves = value;
        Ok(())
    }

    pub(crate) fn set_octave_layers(&mut self, value: i32) -> Result<(), KazeConfigError> {
        validate_octave_layers(value)?;
        self.octave_layers = value;
        Ok(())
    }

    pub(crate) fn set_diffusivity(&mut self, value: i32) -> Result<(), KazeConfigError> {
        validate_diffusivity(value)?;
        self.diffusivity = value;
        Ok(())
    }
}

fn validate_threshold(value: f64) -> Result<(), KazeConfigError> {
    if value.is_finite() {
        Ok(())
    } else {
        Err(KazeConfigError::Threshold)
    }
}

fn validate_octaves(value: i32) -> Result<(), KazeConfigError> {
    if value > 0 {
        Ok(())
    } else {
        Err(KazeConfigError::Octaves(value))
    }
}

fn validate_octave_layers(value: i32) -> Result<(), KazeConfigError> {
    if value > 0 {
        Ok(())
    } else {
        Err(KazeConfigError::OctaveLayers(value))
    }
}

fn validate_diffusivity(value: i32) -> Result<(), KazeConfigError> {
    if matches!(value, 0..=3) {
        Ok(())
    } else {
        Err(KazeConfigError::Diffusivity(value))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn documented_constructor_defaults_are_stable() {
        let configuration = KazeConfig::default();

        assert!(!configuration.extended());
        assert!(!configuration.upright());
        assert_eq!(
            configuration.threshold().to_bits(),
            f64::from(0.001_f32).to_bits()
        );
        assert_eq!(configuration.octaves(), 4);
        assert_eq!(configuration.octave_layers(), 4);
        assert_eq!(configuration.diffusivity(), 1);
    }

    #[test]
    fn constructor_keeps_a_valid_explicit_configuration() {
        let configuration = KazeConfig::new(KazeParameters {
            extended: true,
            upright: true,
            threshold: 0.25,
            octaves: 3,
            octave_layers: 6,
            diffusivity: 3,
        })
        .expect("valid configuration");

        assert!(configuration.extended());
        assert!(configuration.upright());
        assert_eq!(configuration.threshold().to_bits(), 0.25_f64.to_bits());
        assert_eq!(configuration.octaves(), 3);
        assert_eq!(configuration.octave_layers(), 6);
        assert_eq!(configuration.diffusivity(), 3);
    }

    #[test]
    fn constructor_rejects_out_of_range_and_non_finite_values() {
        let defaults = KazeParameters::default();
        let invalid = [
            (
                KazeParameters {
                    threshold: f64::NAN,
                    ..defaults
                },
                KazeConfigError::Threshold,
            ),
            (
                KazeParameters {
                    octaves: 0,
                    ..defaults
                },
                KazeConfigError::Octaves(0),
            ),
            (
                KazeParameters {
                    octave_layers: 0,
                    ..defaults
                },
                KazeConfigError::OctaveLayers(0),
            ),
            (
                KazeParameters {
                    diffusivity: 4,
                    ..defaults
                },
                KazeConfigError::Diffusivity(4),
            ),
        ];

        for (parameters, expected) in invalid {
            assert_eq!(KazeConfig::new(parameters), Err(expected));
        }
    }

    #[test]
    fn setters_replace_each_mutable_configuration_value() {
        let mut configuration = KazeConfig::default();

        configuration.set_extended(true);
        configuration.set_upright(true);
        configuration
            .set_threshold(-0.125)
            .expect("finite thresholds are preserved");
        configuration.set_octaves(6).expect("valid octaves");
        configuration
            .set_octave_layers(8)
            .expect("valid octave layers");
        configuration.set_diffusivity(3).expect("valid diffusivity");

        assert!(configuration.extended());
        assert!(configuration.upright());
        assert_eq!(configuration.threshold().to_bits(), (-0.125_f64).to_bits());
        assert_eq!(configuration.octaves(), 6);
        assert_eq!(configuration.octave_layers(), 8);
        assert_eq!(configuration.diffusivity(), 3);
    }

    #[test]
    fn invalid_setters_leave_the_configuration_unchanged() {
        let mut configuration = KazeConfig::default();

        let before = configuration.clone();
        assert_eq!(
            configuration.set_threshold(f64::INFINITY),
            Err(KazeConfigError::Threshold)
        );
        assert_eq!(configuration, before);

        assert_eq!(
            configuration.set_octaves(-1),
            Err(KazeConfigError::Octaves(-1))
        );
        assert_eq!(configuration, before);

        assert_eq!(
            configuration.set_octave_layers(0),
            Err(KazeConfigError::OctaveLayers(0))
        );
        assert_eq!(configuration, before);

        assert_eq!(
            configuration.set_diffusivity(-1),
            Err(KazeConfigError::Diffusivity(-1))
        );
        assert_eq!(configuration, before);
    }
}
