//! WebAssembly adapters for type-generic matrix reductions.

use std::{error::Error, fmt};

use wasm_bindgen::prelude::*;

use crate::{
    core_reductions::{
        count_non_zero, mean, mean_masked, min_max_loc, min_max_loc_masked, sum, trace,
        ReductionError, ScalarDepth,
    },
    mat::{Mat, MatDepth},
};

#[derive(Debug, Clone, PartialEq, Eq)]
enum ReductionWasmError {
    CountOverflow,
    InvalidMaskDepth(MatDepth),
    InvalidMaskChannels(u16),
    InvalidMaskShape {
        source_rows: u32,
        source_columns: u32,
        mask_rows: u32,
        mask_columns: u32,
    },
    Reduction(ReductionError),
}

impl fmt::Display for ReductionWasmError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::CountOverflow => {
                formatter.write_str("non-zero element count exceeds the WASM integer limit")
            }
            Self::InvalidMaskDepth(depth) => {
                write!(formatter, "reduction masks require U8 depth; received {depth:?}")
            }
            Self::InvalidMaskChannels(channels) => write!(
                formatter,
                "reduction masks require one channel; received {channels}"
            ),
            Self::InvalidMaskShape {
                source_rows,
                source_columns,
                mask_rows,
                mask_columns,
            } => write!(
                formatter,
                "reduction mask shape {mask_rows}x{mask_columns} does not match source shape {source_rows}x{source_columns}"
            ),
            Self::Reduction(error) => error.fmt(formatter),
        }
    }
}

impl Error for ReductionWasmError {
    fn source(&self) -> Option<&(dyn Error + 'static)> {
        match self {
            Self::CountOverflow
            | Self::InvalidMaskDepth(_)
            | Self::InvalidMaskChannels(_)
            | Self::InvalidMaskShape { .. } => None,
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

/// Averages up to four channels over pixels selected by a U8 mask.
///
/// # Errors
/// Returns an error for an invalid mask or more than four source channels.
#[wasm_bindgen(js_name = matMeanMasked)]
pub fn mat_mean_masked(source: &Mat, mask: &Mat) -> Result<Vec<f64>, JsError> {
    let mask = reduction_mask(source, mask).map_err(JsError::from)?;
    reduce_mean_masked(source, mask.as_deref())
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

/// Returns extrema and locations over pixels selected by a U8 mask.
///
/// # Errors
/// Returns an error for an invalid mask or a non-single-channel source.
#[wasm_bindgen(js_name = matMinMaxLocMasked)]
pub fn mat_min_max_loc_masked(source: &Mat, mask: &Mat) -> Result<Vec<f64>, JsError> {
    let mask = reduction_mask(source, mask).map_err(JsError::from)?;
    reduce_min_max_loc_masked(source, mask.as_deref()).map_err(JsError::from)
}

/// Sums up to four channels along the main diagonal.
///
/// # Errors
///
/// Returns an error when matrix metadata and its compact bytes disagree.
#[wasm_bindgen(js_name = matTrace)]
pub fn mat_trace(source: &Mat) -> Result<Vec<f64>, JsError> {
    reduce_trace(source)
        .map(|lanes| lanes.to_vec())
        .map_err(JsError::from)
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

fn reduce_mean_masked(source: &Mat, mask: Option<&[u8]>) -> Result<[f64; 4], ReductionWasmError> {
    mean_masked(
        &source.compact_bytes(),
        source.rows(),
        source.columns(),
        source.channels(),
        scalar_depth(source.depth()),
        mask,
    )
    .map_err(ReductionWasmError::from)
}

fn reduce_min_max_loc(source: &Mat) -> Result<Vec<f64>, ReductionWasmError> {
    if (source.rows() == 0 || source.columns() == 0) && source.is_continuous() {
        return Ok(vec![0.0, 0.0, -1.0, -1.0, -1.0, -1.0]);
    }
    let result = min_max_loc(
        &source.compact_bytes(),
        source.rows(),
        source.columns(),
        source.channels(),
        scalar_depth(source.depth()),
    )?;
    Ok(min_max_location_lanes(result))
}

fn reduce_min_max_loc_masked(
    source: &Mat,
    mask: Option<&[u8]>,
) -> Result<Vec<f64>, ReductionWasmError> {
    if (source.rows() == 0 || source.columns() == 0) && source.is_continuous() {
        return Ok(vec![0.0, 0.0, -1.0, -1.0, -1.0, -1.0]);
    }
    let result = min_max_loc_masked(
        &source.compact_bytes(),
        source.rows(),
        source.columns(),
        source.channels(),
        scalar_depth(source.depth()),
        mask,
    )?;
    Ok(min_max_location_lanes(result))
}

fn min_max_location_lanes(result: crate::core_reductions::MinMaxLocation) -> Vec<f64> {
    vec![
        result.minimum,
        result.maximum,
        f64::from(result.minimum_location.column),
        f64::from(result.minimum_location.row),
        f64::from(result.maximum_location.column),
        f64::from(result.maximum_location.row),
    ]
}

fn reduction_mask(source: &Mat, mask: &Mat) -> Result<Option<Vec<u8>>, ReductionWasmError> {
    if mask.byte_length() == 0 {
        return Ok(None);
    }
    if mask.depth() != MatDepth::U8 {
        return Err(ReductionWasmError::InvalidMaskDepth(mask.depth()));
    }
    if mask.channels() != 1 {
        return Err(ReductionWasmError::InvalidMaskChannels(mask.channels()));
    }
    if mask.rows() != source.rows() || mask.columns() != source.columns() {
        return Err(ReductionWasmError::InvalidMaskShape {
            source_rows: source.rows(),
            source_columns: source.columns(),
            mask_rows: mask.rows(),
            mask_columns: mask.columns(),
        });
    }
    Ok(Some(mask.compact_bytes()))
}

fn reduce_trace(source: &Mat) -> Result<[f64; 4], ReductionWasmError> {
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
    fn masked_reducers_compact_masks_and_return_empty_selection_sentinels() {
        let source = matrix(vec![1, 10, 100, 3, 30, 200], 1, 2, 3, MatDepth::U8);
        let mask = matrix(vec![1, 0], 1, 2, 1, MatDepth::U8);
        let mask_bytes = reduction_mask(&source, &mask).expect("valid mask");
        assert_exact_lanes(
            reduce_mean_masked(&source, mask_bytes.as_deref()),
            [1.0, 10.0, 100.0, 0.0],
        );

        let extrema = matrix(vec![5, 2, 9, 2, 9, 4], 2, 3, 1, MatDepth::U8);
        let parent = matrix(
            vec![99, 0, 1, 0, 99, 99, 1, 0, 1, 99],
            2,
            5,
            1,
            MatDepth::U8,
        );
        let mask_region = parent.roi(0, 1, 2, 3).expect("strided mask");
        let mask_bytes = reduction_mask(&extrema, &mask_region).expect("valid strided mask");
        assert_eq!(
            reduce_min_max_loc_masked(&extrema, mask_bytes.as_deref()),
            Ok(vec![2.0, 4.0, 1.0, 0.0, 2.0, 1.0])
        );

        let zero_mask = matrix(vec![0; 6], 2, 3, 1, MatDepth::U8);
        let mask_bytes = reduction_mask(&extrema, &zero_mask).expect("valid zero mask");
        assert_eq!(
            reduce_min_max_loc_masked(&extrema, mask_bytes.as_deref()),
            Ok(vec![0.0, 0.0, -1.0, -1.0, -1.0, -1.0])
        );
        assert_exact_lanes(reduce_mean(&Mat::empty_output()), [0.0; 4]);
        assert_eq!(
            reduce_min_max_loc(&Mat::empty_output()),
            Ok(vec![0.0, 0.0, -1.0, -1.0, -1.0, -1.0])
        );
        assert_eq!(
            reduce_min_max_loc(&crate::mat::mat_empty()),
            Ok(vec![0.0; 6])
        );
    }

    #[test]
    fn masked_reducers_reject_invalid_mask_metadata() {
        let source = matrix(vec![1, 2, 3, 4], 2, 2, 1, MatDepth::U8);
        let wrong_depth = matrix(vec![0; 16], 2, 2, 1, MatDepth::F32);
        assert_eq!(
            reduction_mask(&source, &wrong_depth),
            Err(ReductionWasmError::InvalidMaskDepth(MatDepth::F32))
        );
        let wrong_channels = matrix(vec![1; 8], 2, 2, 2, MatDepth::U8);
        assert_eq!(
            reduction_mask(&source, &wrong_channels),
            Err(ReductionWasmError::InvalidMaskChannels(2))
        );
        let wrong_shape = matrix(vec![1; 3], 1, 3, 1, MatDepth::U8);
        assert!(matches!(
            reduction_mask(&source, &wrong_shape),
            Err(ReductionWasmError::InvalidMaskShape { .. })
        ));
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
    fn trace_reads_every_channel_from_each_diagonal_pixel() {
        let source = matrix(vec![1, 10, 2, 20, 3, 30, 4, 40], 2, 2, 2, MatDepth::U8);

        assert_exact_lanes(reduce_trace(&source), [5.0, 50.0, 0.0, 0.0]);
        assert_exact_lanes(reduce_trace(&Mat::empty_output()), [0.0; 4]);
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
