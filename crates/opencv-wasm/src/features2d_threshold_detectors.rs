//! Independently authored AGAST and FAST detector configuration state.

use std::{error::Error, fmt};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum DetectorConfigError {
    AgastType(i32),
    FastType(i32),
}

impl fmt::Display for DetectorConfigError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::AgastType(value) => write!(
                formatter,
                "AGAST detector type must be one of 0, 1, 2, or 3; received {value}"
            ),
            Self::FastType(value) => write!(
                formatter,
                "FAST detector type must be one of 0, 1, or 2; received {value}"
            ),
        }
    }
}

impl Error for DetectorConfigError {}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct AgastConfig {
    threshold: i32,
    nonmax_suppression: bool,
    detector_type: i32,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct FastConfig {
    threshold: i32,
    nonmax_suppression: bool,
    detector_type: i32,
}

impl Default for FastConfig {
    fn default() -> Self {
        Self::new(10, true, 2).expect("documented FAST defaults are valid")
    }
}

impl FastConfig {
    pub(crate) fn new(
        threshold: i32,
        nonmax_suppression: bool,
        detector_type: i32,
    ) -> Result<Self, DetectorConfigError> {
        validate_fast_type(detector_type)?;
        Ok(Self {
            threshold,
            nonmax_suppression,
            detector_type,
        })
    }

    pub(crate) fn threshold(&self) -> i32 {
        self.threshold
    }

    pub(crate) fn nonmax_suppression(&self) -> bool {
        self.nonmax_suppression
    }

    pub(crate) fn detector_type(&self) -> i32 {
        self.detector_type
    }

    pub(crate) fn set_threshold(&mut self, value: i32) {
        self.threshold = value;
    }

    pub(crate) fn set_nonmax_suppression(&mut self, value: bool) {
        self.nonmax_suppression = value;
    }

    pub(crate) fn set_detector_type(&mut self, value: i32) -> Result<(), DetectorConfigError> {
        validate_fast_type(value)?;
        self.detector_type = value;
        Ok(())
    }
}

impl Default for AgastConfig {
    fn default() -> Self {
        Self::new(10, true, 3).expect("documented AGAST defaults are valid")
    }
}

impl AgastConfig {
    pub(crate) fn new(
        threshold: i32,
        nonmax_suppression: bool,
        detector_type: i32,
    ) -> Result<Self, DetectorConfigError> {
        validate_agast_type(detector_type)?;
        Ok(Self {
            threshold,
            nonmax_suppression,
            detector_type,
        })
    }

    pub(crate) fn threshold(&self) -> i32 {
        self.threshold
    }

    pub(crate) fn nonmax_suppression(&self) -> bool {
        self.nonmax_suppression
    }

    pub(crate) fn detector_type(&self) -> i32 {
        self.detector_type
    }

    pub(crate) fn set_threshold(&mut self, value: i32) {
        self.threshold = value;
    }

    pub(crate) fn set_nonmax_suppression(&mut self, value: bool) {
        self.nonmax_suppression = value;
    }

    pub(crate) fn set_detector_type(&mut self, value: i32) -> Result<(), DetectorConfigError> {
        validate_agast_type(value)?;
        self.detector_type = value;
        Ok(())
    }
}

fn validate_agast_type(value: i32) -> Result<(), DetectorConfigError> {
    if matches!(value, 0..=3) {
        Ok(())
    } else {
        Err(DetectorConfigError::AgastType(value))
    }
}

fn validate_fast_type(value: i32) -> Result<(), DetectorConfigError> {
    if matches!(value, 0..=2) {
        Ok(())
    } else {
        Err(DetectorConfigError::FastType(value))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn agast_documented_constructor_defaults_are_stable() {
        let configuration = AgastConfig::default();

        assert_eq!(configuration.threshold(), 10);
        assert!(configuration.nonmax_suppression());
        assert_eq!(configuration.detector_type(), 3);
    }

    #[test]
    fn agast_constructor_keeps_a_valid_explicit_configuration() {
        let configuration = AgastConfig::new(42, false, 1).expect("valid AGAST configuration");

        assert_eq!(configuration.threshold(), 42);
        assert!(!configuration.nonmax_suppression());
        assert_eq!(configuration.detector_type(), 1);
    }

    #[test]
    fn agast_setters_replace_each_mutable_value() {
        let mut configuration = AgastConfig::default();

        configuration.set_threshold(63);
        configuration.set_nonmax_suppression(false);
        configuration.set_detector_type(0).expect("valid type");

        assert_eq!(configuration.threshold(), 63);
        assert!(!configuration.nonmax_suppression());
        assert_eq!(configuration.detector_type(), 0);
    }

    #[test]
    fn agast_preserves_signed_thresholds_and_rejects_invalid_types() {
        for threshold in [i32::MIN, -1, 256, i32::MAX] {
            let configuration =
                AgastConfig::new(threshold, true, 3).expect("signed threshold is preserved");
            assert_eq!(configuration.threshold(), threshold);
        }
        for detector_type in [-1, 4] {
            assert_eq!(
                AgastConfig::new(10, true, detector_type),
                Err(DetectorConfigError::AgastType(detector_type))
            );
        }

        let mut configuration = AgastConfig::default();
        configuration.set_threshold(i32::MIN);
        assert_eq!(configuration.threshold(), i32::MIN);
        let before_invalid_type = configuration.clone();
        assert_eq!(
            configuration.set_detector_type(5),
            Err(DetectorConfigError::AgastType(5))
        );
        assert_eq!(configuration, before_invalid_type);
    }

    #[test]
    fn fast_documented_constructor_defaults_are_stable() {
        let configuration = FastConfig::default();

        assert_eq!(configuration.threshold(), 10);
        assert!(configuration.nonmax_suppression());
        assert_eq!(configuration.detector_type(), 2);
    }

    #[test]
    fn fast_constructor_keeps_a_valid_explicit_configuration() {
        let configuration = FastConfig::new(31, false, 0).expect("valid FAST configuration");

        assert_eq!(configuration.threshold(), 31);
        assert!(!configuration.nonmax_suppression());
        assert_eq!(configuration.detector_type(), 0);
    }

    #[test]
    fn fast_setters_replace_each_mutable_value() {
        let mut configuration = FastConfig::default();

        configuration.set_threshold(80);
        configuration.set_nonmax_suppression(false);
        configuration.set_detector_type(1).expect("valid type");

        assert_eq!(configuration.threshold(), 80);
        assert!(!configuration.nonmax_suppression());
        assert_eq!(configuration.detector_type(), 1);
    }

    #[test]
    fn fast_preserves_signed_thresholds_and_rejects_invalid_types() {
        for threshold in [i32::MIN, -1, 256, i32::MAX] {
            let configuration =
                FastConfig::new(threshold, true, 2).expect("signed threshold is preserved");
            assert_eq!(configuration.threshold(), threshold);
        }
        for detector_type in [-1, 3] {
            assert_eq!(
                FastConfig::new(10, true, detector_type),
                Err(DetectorConfigError::FastType(detector_type))
            );
        }

        let mut configuration = FastConfig::default();
        configuration.set_threshold(i32::MAX);
        assert_eq!(configuration.threshold(), i32::MAX);
        let before_invalid_type = configuration.clone();
        assert_eq!(
            configuration.set_detector_type(8),
            Err(DetectorConfigError::FastType(8))
        );
        assert_eq!(configuration, before_invalid_type);
    }
}
