//! Independently authored MSER configuration state.

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) struct MserParameters {
    pub(crate) delta: i32,
    pub(crate) min_area: i32,
    pub(crate) max_area: i32,
    pub(crate) pass2_only: bool,
}

impl Default for MserParameters {
    fn default() -> Self {
        Self {
            delta: 5,
            min_area: 60,
            max_area: 14_400,
            pass2_only: false,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct MserConfig {
    parameters: MserParameters,
}

impl Default for MserConfig {
    fn default() -> Self {
        Self::new(MserParameters::default())
    }
}

impl MserConfig {
    pub(crate) fn new(parameters: MserParameters) -> Self {
        Self { parameters }
    }

    pub(crate) fn delta(&self) -> i32 {
        self.parameters.delta
    }

    pub(crate) fn min_area(&self) -> i32 {
        self.parameters.min_area
    }

    pub(crate) fn max_area(&self) -> i32 {
        self.parameters.max_area
    }

    pub(crate) fn pass2_only(&self) -> bool {
        self.parameters.pass2_only
    }

    pub(crate) fn set_delta(&mut self, value: i32) {
        self.parameters.delta = value;
    }

    pub(crate) fn set_min_area(&mut self, value: i32) {
        self.parameters.min_area = value;
    }

    pub(crate) fn set_max_area(&mut self, value: i32) {
        self.parameters.max_area = value;
    }

    pub(crate) fn set_pass2_only(&mut self, value: bool) {
        self.parameters.pass2_only = value;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn defaults_match_the_pinned_browser_binding() {
        let configuration = MserConfig::default();

        assert_eq!(configuration.delta(), 5);
        assert_eq!(configuration.min_area(), 60);
        assert_eq!(configuration.max_area(), 14_400);
        assert!(!configuration.pass2_only());
    }

    #[test]
    fn setters_preserve_the_full_signed_integer_domain() {
        let mut configuration = MserConfig::default();

        configuration.set_delta(i32::MIN);
        configuration.set_min_area(-1);
        configuration.set_max_area(i32::MAX);
        configuration.set_pass2_only(true);

        assert_eq!(configuration.delta(), i32::MIN);
        assert_eq!(configuration.min_area(), -1);
        assert_eq!(configuration.max_area(), i32::MAX);
        assert!(configuration.pass2_only());
    }
}
