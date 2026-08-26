//! Browser WebAssembly bindings for deterministic matrix initialization.

use std::cell::RefCell;

use wasm_bindgen::prelude::*;

use crate::{
    core_random::{RandomGenerator, fill_normal, fill_uniform, set_identity},
    mat::Mat,
};

const DEFAULT_RANDOM_SEED: u64 = 0xFFFF_FFFF_FFFF_FFFF;

thread_local! {
    /// Package-owned state for the single-thread browser build.
    ///
    /// This does not use OpenCV's RNG and intentionally does not reproduce its byte sequence.
    /// A future threaded build must provide explicit worker-local or caller-owned state rather
    /// than sharing this `thread_local` value across workers.
    static RANDOM_GENERATOR: RefCell<RandomGenerator> =
        const { RefCell::new(RandomGenerator::new(DEFAULT_RANDOM_SEED)) };
}

/// Resets the package-owned random generator used by `matRandu` and `matRandn`.
///
/// The implementation interprets the signed JavaScript integer as its unsigned 32-bit bit pattern
/// and seeds an independently authored `SplitMix64` generator. Equal seeds replay equal package
/// sequences, but those sequences differ from `OpenCV` because no `OpenCV` RNG code is included.
#[wasm_bindgen(js_name = setRNGSeed)]
pub fn set_rng_seed(seed: i32) {
    let seed_bits = u32::from_ne_bytes(seed.to_ne_bytes());
    RANDOM_GENERATOR.with(|generator| {
        *generator.borrow_mut() = RandomGenerator::new(u64::from(seed_bits));
    });
}

/// Replaces a matrix with an identity matrix using one broadcast value or one value per channel.
///
/// The destination keeps its existing shape, channel count, depth, storage, and ROI relationship.
/// Integer values use nearest-even rounding and saturation. Extra scalar lanes are ignored.
///
/// # Errors
///
/// Returns an error when the scalar has neither one value nor enough values for all channels.
#[wasm_bindgen(js_name = matSetIdentity)]
pub fn mat_set_identity(destination: &Mat, value: &[f64]) -> Result<(), JsError> {
    set_identity(destination, value).map_err(JsError::from)
}

/// Fills a matrix from channel-specific uniform distributions.
///
/// Each lower bound is inclusive and each upper bound is exclusive. Integer destinations floor
/// each draw before saturation. Floating destinations retain the generated floating value. Scalar
/// arrays may contain one broadcast value or one value per channel. The package rejects non-finite
/// bounds and empty ranges before consuming random state or changing the destination.
///
/// # Errors
///
/// Returns an error for invalid scalar lengths, non-finite bounds, or `lower >= upper`.
#[wasm_bindgen(js_name = matRandu)]
pub fn mat_randu(destination: &Mat, lower: &[f64], upper: &[f64]) -> Result<(), JsError> {
    RANDOM_GENERATOR.with(|generator| {
        fill_uniform(destination, lower, upper, &mut generator.borrow_mut()).map_err(JsError::from)
    })
}

/// Fills a matrix from channel-specific normal distributions.
///
/// The independently authored implementation uses the Box-Muller transform over the package's
/// `SplitMix64` stream. Integer results use nearest-even rounding and saturation. Scalar arrays may
/// contain one broadcast value or one value per channel. Non-finite means or deviations and
/// negative deviations are rejected before consuming random state or changing the destination.
///
/// # Errors
///
/// Returns an error for invalid scalar lengths, non-finite parameters, or negative deviations.
#[wasm_bindgen(js_name = matRandn)]
pub fn mat_randn(
    destination: &Mat,
    mean: &[f64],
    standard_deviation: &[f64],
) -> Result<(), JsError> {
    RANDOM_GENERATOR.with(|generator| {
        fill_normal(
            destination,
            mean,
            standard_deviation,
            &mut generator.borrow_mut(),
        )
        .map_err(JsError::from)
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::mat::{Mat, MatDepth};

    #[test]
    fn resetting_the_exported_seed_replays_the_shared_sequence() {
        let first =
            Mat::from_owned_bytes(vec![0; 32], 1, 32, 1, MatDepth::U8).expect("valid destination");
        let second =
            Mat::from_owned_bytes(vec![0; 32], 1, 32, 1, MatDepth::U8).expect("valid destination");

        set_rng_seed(1234);
        mat_randu(&first, &[0.0], &[256.0]).expect("valid uniform fill");
        set_rng_seed(1234);
        mat_randu(&second, &[0.0], &[256.0]).expect("valid uniform fill");

        assert_eq!(first.compact_bytes(), second.compact_bytes());
    }

    #[test]
    fn resetting_the_exported_seed_replays_normal_fills() {
        let first =
            Mat::from_owned_bytes(vec![0; 64], 1, 8, 1, MatDepth::F64).expect("valid destination");
        let second =
            Mat::from_owned_bytes(vec![0; 64], 1, 8, 1, MatDepth::F64).expect("valid destination");

        set_rng_seed(-44);
        mat_randn(&first, &[3.0], &[2.0]).expect("valid normal fill");
        set_rng_seed(-44);
        mat_randn(&second, &[3.0], &[2.0]).expect("valid normal fill");

        assert_eq!(first.compact_bytes(), second.compact_bytes());
    }
}
