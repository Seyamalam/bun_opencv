//! WebAssembly adapters for type-generic matrix reductions.

use std::{error::Error, fmt};

use wasm_bindgen::prelude::*;

use crate::{
    core_reductions::{ReductionError, ScalarDepth, count_non_zero, mean, min_max_loc, sum, trace},
    mat::{Mat, MatDepth},
};

#[derive(Debug, Clone, PartialEq, Eq)]
enum ReductionWasmError {
    CountOverflow,
    Reduction(ReductionError),
}

impl fmt::Display for ReductionWasmError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::CountOverflow => {
                formatter.write_str("non-zero element count exceeds the WASM integer limit")
            }
            Self::Reduction(error) => error.fmt(formatter),
        }
    }
}

impl Error for ReductionWasmError {
    fn source(&self) -> Option<&(dyn Error + 'static)> {
        match self {
            Self::CountOverflow => None,
            Self::Reduction(error) => Some(error),
        }
    }
}

impl From<ReductionError> for ReductionWasmError {
    fn from(error: ReductionError) -> Self {
        Self::Reduction(error)
    }
}

/// Counts non-zero elements in a single-channel matrix of any supported depth.
///
/// # Errors
///
/// Returns an error when the matrix is not single-channel or its count cannot fit a WASM `u32`.
#[wasm_bindgen(js_name = matCountNonZero)]
pub fn mat_count_non_zero(source: &Mat) -> Result<u32, JsError> {
    reduce_count_non_zero(source).map_err(JsError::from)
}

/// Sums up to four interleaved channels and returns four lanes.
///
/// # Errors
///
/// Returns an error when the matrix has more than four channels.
#[wasm_bindgen(js_name = matSum)]
pub fn mat_sum(source: &Mat) -> Result<Vec<f64>, JsError> {
    reduce_sum(source)
        .map(|lanes| lanes.to_vec())
        .map_err(JsError::from)
}

/// Averages up to four interleaved channels and returns four lanes.
///
/// # Errors
///
/// Returns an error when the matrix has more than four channels.
#[wasm_bindgen(js_name = matMean)]
pub fn mat_mean(source: &Mat) -> Result<Vec<f64>, JsError> {
    reduce_mean(source)
        .map(|lanes| lanes.to_vec())
        .map_err(JsError::from)
}

/// Returns minimum, maximum, minimum x/y, and maximum x/y for a single-channel matrix.
///
/// # Errors
///
/// Returns an error when the matrix is not single-channel or contains only NaN values.
#[wasm_bindgen(js_name = matMinMaxLoc)]
pub fn mat_min_max_loc(source: &Mat) -> Result<Vec<f64>, JsError> {
    reduce_min_max_loc(source).map_err(JsError::from)
}

/// Sums channel zero along the main diagonal.
///
/// # Errors
///
/// Returns an error when matrix metadata and its compact bytes disagree.
#[wasm_bindgen(js_name = matTrace)]
pub fn mat_trace(source: &Mat) -> Result<f64, JsError> {
    reduce_trace(source).map_err(JsError::from)
}

fn reduce_count_non_zero(source: &Mat) -> Result<u32, ReductionWasmError> {
    let count = count_non_zero(
        &source.compact_bytes(),
        source.rows(),
        source.columns(),
        source.channels(),
        scalar_depth(source.depth()),
    )?;
    u32::try_from(count).map_err(|_| ReductionWasmError::CountOverflow)
}

fn reduce_sum(source: &Mat) -> Result<[f64; 4], ReductionWasmError> {
    sum(
        &source.compact_bytes(),
        source.rows(),
        source.columns(),
        source.channels(),
        scalar_depth(source.depth()),
    )
    .map_err(ReductionWasmError::from)
}

fn reduce_mean(source: &Mat) -> Result<[f64; 4], ReductionWasmError> {
    mean(
        &source.compact_bytes(),
        source.rows(),
        source.columns(),
        source.channels(),
        scalar_depth(source.depth()),
    )
    .map_err(ReductionWasmError::from)
}

fn reduce_min_max_loc(source: &Mat) -> Result<Vec<f64>, ReductionWasmError> {
    let result = min_max_loc(
        &source.compact_bytes(),
        source.rows(),
        source.columns(),
        source.channels(),
        scalar_depth(source.depth()),
    )?;
    Ok(vec![
        result.minimum,
        result.maximum,
        f64::from(result.minimum_location.column),
        f64::from(result.minimum_location.row),
        f64::from(result.maximum_location.column),
        f64::from(result.maximum_location.row),
    ])
}

fn reduce_trace(source: &Mat) -> Result<f64, ReductionWasmError> {
    trace(
        &source.compact_bytes(),
        source.rows(),
        source.columns(),
        source.channels(),
        scalar_depth(source.depth()),
    )
    .map_err(ReductionWasmError::from)
}

const fn scalar_depth(depth: MatDepth) -> ScalarDepth {
    match depth {
        MatDepth::U8 => ScalarDepth::U8,
        MatDepth::I8 => ScalarDepth::I8,
        MatDepth::U16 => ScalarDepth::U16,
        MatDepth::I16 => ScalarDepth::I16,
        MatDepth::I32 => ScalarDepth::I32,
        MatDepth::F32 => ScalarDepth::F32,
        MatDepth::F64 => ScalarDepth::F64,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn assert_exact_lanes(actual: Result<[f64; 4], ReductionWasmError>, expected: [f64; 4]) {
        let actual = actual.expect("reduction should succeed");
        assert_eq!(actual.map(f64::to_bits), expected.map(f64::to_bits));
    }

    fn matrix(data: Vec<u8>, rows: u32, columns: u32, channels: u16, depth: MatDepth) -> Mat {
        Mat::from_owned_bytes(data, rows, columns, channels, depth).expect("valid test matrix")
    }

    #[test]
    fn count_adapter_maps_every_matrix_depth() {
        let cases = [
            (MatDepth::U8, vec![1_u8]),
            (MatDepth::I8, (-1_i8).to_ne_bytes().to_vec()),
            (MatDepth::U16, 1_u16.to_ne_bytes().to_vec()),
            (MatDepth::I16, (-1_i16).to_ne_bytes().to_vec()),
            (MatDepth::I32, 1_i32.to_ne_bytes().to_vec()),
            (MatDepth::F32, (-1.5_f32).to_ne_bytes().to_vec()),
            (MatDepth::F64, 1.5_f64.to_ne_bytes().to_vec()),
        ];

        for (depth, bytes) in cases {
            let source = matrix(bytes, 1, 1, 1, depth);
            assert_eq!(reduce_count_non_zero(&source), Ok(1));
        }
    }

    #[test]
    fn count_adapter_accepts_an_empty_matrix() {
        assert_eq!(reduce_count_non_zero(&Mat::empty_output()), Ok(0));
    }

    #[test]
    fn strided_roi_is_compacted_before_reduction() {
        let bytes = [1_u16, 2, 3, 4, 5, 6, 7, 8, 9]
            .into_iter()
            .flat_map(u16::to_ne_bytes)
            .collect();
        let parent = matrix(bytes, 3, 3, 1, MatDepth::U16);
        let region = parent.roi(1, 1, 2, 2).expect("valid strided ROI");

        assert!(!region.is_continuous());
        assert_eq!(reduce_count_non_zero(&region), Ok(4));
        assert_exact_lanes(reduce_sum(&region), [28.0, 0.0, 0.0, 0.0]);
        assert_exact_lanes(reduce_mean(&region), [7.0, 0.0, 0.0, 0.0]);
    }

    #[test]
    fn sum_and_mean_preserve_channel_lanes() {
        let source = matrix(vec![1, 10, 100, 2, 20, 200], 1, 2, 3, MatDepth::U8);

        assert_exact_lanes(reduce_sum(&source), [3.0, 30.0, 300.0, 0.0]);
        assert_exact_lanes(reduce_mean(&source), [1.5, 15.0, 150.0, 0.0]);
    }

    #[test]
    fn min_max_result_uses_x_then_y_coordinate_order() {
        let source = matrix(vec![5, 9, 1, 7, 8, 2], 2, 3, 1, MatDepth::U8);

        assert_eq!(
            reduce_min_max_loc(&source),
            Ok(vec![1.0, 9.0, 2.0, 0.0, 1.0, 0.0])
        );
    }

    #[test]
    fn trace_reads_channel_zero_from_each_diagonal_pixel() {
        let source = matrix(vec![1, 10, 2, 20, 3, 30, 4, 40], 2, 2, 2, MatDepth::U8);

        assert_eq!(
            reduce_trace(&source)
                .expect("trace should succeed")
                .to_bits(),
            5.0_f64.to_bits()
        );
    }

    #[test]
    fn adapters_reject_channel_shapes_the_operation_cannot_represent() {
        let two_channels = matrix(vec![1, 2], 1, 1, 2, MatDepth::U8);
        assert_eq!(
            reduce_count_non_zero(&two_channels),
            Err(ReductionWasmError::Reduction(
                ReductionError::SingleChannelRequired { actual: 2 }
            ))
        );
        assert_eq!(
            reduce_min_max_loc(&two_channels),
            Err(ReductionWasmError::Reduction(
                ReductionError::SingleChannelRequired { actual: 2 }
            ))
        );

        let five_channels = matrix(vec![1, 2, 3, 4, 5], 1, 1, 5, MatDepth::U8);
        assert_eq!(
            reduce_sum(&five_channels),
            Err(ReductionWasmError::Reduction(
                ReductionError::TooManyChannels { actual: 5 }
            ))
        );
        assert_eq!(
            reduce_mean(&five_channels),
            Err(ReductionWasmError::Reduction(
                ReductionError::TooManyChannels { actual: 5 }
            ))
        );
    }
}
