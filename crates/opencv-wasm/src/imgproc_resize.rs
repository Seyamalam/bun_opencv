use std::{error::Error, fmt};

use crate::mat::{Mat, MatDepth, MatError};

pub(crate) const INTER_NEAREST: i32 = 0;
pub(crate) const INTER_LINEAR: i32 = 1;
pub(crate) const INTER_AREA: i32 = 3;

#[derive(Debug, Clone, PartialEq)]
pub(crate) enum ResizeError {
    EmptySource,
    InvalidScale { x: f64, y: f64 },
    InvalidTarget { width: i32, height: i32 },
    Matrix(MatError),
    SizeOverflow,
    UnsupportedInterpolation(i32),
    UnsupportedAreaGeometry,
    UnsupportedLinearDepth(MatDepth),
}

impl fmt::Display for ResizeError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::EmptySource => formatter.write_str("resize source must not be empty"),
            Self::InvalidScale { x, y } => {
                write!(
                    formatter,
                    "resize scale factors must be positive and finite; received {x}, {y}"
                )
            }
            Self::InvalidTarget { width, height } => write!(
                formatter,
                "resize target dimensions must both be positive or both be zero; received {width} by {height}"
            ),
            Self::Matrix(error) => error.fmt(formatter),
            Self::SizeOverflow => {
                formatter.write_str("resize output exceeds the WASM matrix limit")
            }
            Self::UnsupportedInterpolation(code) => {
                write!(formatter, "unsupported resize interpolation code {code}")
            }
            Self::UnsupportedAreaGeometry => {
                formatter.write_str("INTER_AREA currently supports shrinking U8 matrices")
            }
            Self::UnsupportedLinearDepth(depth) => {
                write!(
                    formatter,
                    "linear resize depth {depth:?} is not implemented"
                )
            }
        }
    }
}

impl Error for ResizeError {
    fn source(&self) -> Option<&(dyn Error + 'static)> {
        match self {
            Self::Matrix(error) => Some(error),
            _ => None,
        }
    }
}

impl From<MatError> for ResizeError {
    fn from(error: MatError) -> Self {
        Self::Matrix(error)
    }
}

#[allow(clippy::too_many_arguments)]
pub(crate) fn resize_into(
    source: &Mat,
    destination: &Mat,
    target_width: i32,
    target_height: i32,
    scale_x: f64,
    scale_y: f64,
    interpolation: i32,
) -> Result<(), ResizeError> {
    if source.rows() == 0 || source.columns() == 0 {
        return Err(ResizeError::EmptySource);
    }
    if !matches!(interpolation, INTER_NEAREST | INTER_LINEAR | INTER_AREA) {
        return Err(ResizeError::UnsupportedInterpolation(interpolation));
    }
    let (target_width, target_height) = resolve_target(
        source.columns(),
        source.rows(),
        target_width,
        target_height,
        scale_x,
        scale_y,
    )?;
    let output = match interpolation {
        INTER_NEAREST => resize_nearest_bytes(source, target_width, target_height)?,
        INTER_LINEAR => resize_linear_u8(source, target_width, target_height)?,
        INTER_AREA => resize_area_u8(source, target_width, target_height)?,
        _ => unreachable!("interpolation was validated"),
    };
    destination.write_output(
        output,
        target_height,
        target_width,
        source.channels(),
        source.depth(),
    )?;
    Ok(())
}

fn resolve_target(
    source_width: u32,
    source_height: u32,
    target_width: i32,
    target_height: i32,
    scale_x: f64,
    scale_y: f64,
) -> Result<(u32, u32), ResizeError> {
    if target_width > 0 && target_height > 0 {
        return Ok((target_width.unsigned_abs(), target_height.unsigned_abs()));
    }
    if target_width != 0 || target_height != 0 {
        return Err(ResizeError::InvalidTarget {
            width: target_width,
            height: target_height,
        });
    }
    if !scale_x.is_finite() || !scale_y.is_finite() || scale_x <= 0.0 || scale_y <= 0.0 {
        return Err(ResizeError::InvalidScale {
            x: scale_x,
            y: scale_y,
        });
    }
    let width = round_dimension(f64::from(source_width) * scale_x)?;
    let height = round_dimension(f64::from(source_height) * scale_y)?;
    Ok((width, height))
}

fn round_dimension(value: f64) -> Result<u32, ResizeError> {
    let rounded = value.round_ties_even();
    if !rounded.is_finite() || rounded < 1.0 || rounded > f64::from(u32::MAX) {
        return Err(ResizeError::SizeOverflow);
    }
    #[allow(clippy::cast_possible_truncation, clippy::cast_sign_loss)]
    Ok(rounded as u32)
}

fn resize_nearest_bytes(
    source: &Mat,
    target_width: u32,
    target_height: u32,
) -> Result<Vec<u8>, ResizeError> {
    let pixel_bytes = usize::from(source.channels())
        .checked_mul(source.depth().byte_width())
        .ok_or(ResizeError::SizeOverflow)?;
    let output_length = usize::try_from(target_width)
        .ok()
        .and_then(|width| {
            usize::try_from(target_height)
                .ok()
                .and_then(|height| width.checked_mul(height))
        })
        .and_then(|pixels| pixels.checked_mul(pixel_bytes))
        .filter(|&length| length <= u32::MAX as usize)
        .ok_or(ResizeError::SizeOverflow)?;
    let input = source.compact_bytes();
    let source_width = u64::from(source.columns());
    let source_height = u64::from(source.rows());
    let mut output = vec![0; output_length];
    for target_y in 0..target_height {
        let source_y = u64::from(target_y) * source_height / u64::from(target_height);
        for target_x in 0..target_width {
            let source_x = u64::from(target_x) * source_width / u64::from(target_width);
            let source_pixel = source_y * source_width + source_x;
            let target_pixel = u64::from(target_y) * u64::from(target_width) + u64::from(target_x);
            let source_offset = usize::try_from(source_pixel)
                .ok()
                .and_then(|pixel| pixel.checked_mul(pixel_bytes))
                .ok_or(ResizeError::SizeOverflow)?;
            let target_offset = usize::try_from(target_pixel)
                .ok()
                .and_then(|pixel| pixel.checked_mul(pixel_bytes))
                .ok_or(ResizeError::SizeOverflow)?;
            output[target_offset..target_offset + pixel_bytes]
                .copy_from_slice(&input[source_offset..source_offset + pixel_bytes]);
        }
    }
    Ok(output)
}

fn resize_linear_u8(
    source: &Mat,
    target_width: u32,
    target_height: u32,
) -> Result<Vec<u8>, ResizeError> {
    if source.depth() != MatDepth::U8 {
        return Err(ResizeError::UnsupportedLinearDepth(source.depth()));
    }
    let channels = usize::from(source.channels());
    let output_length = usize::try_from(target_width)
        .ok()
        .and_then(|width| {
            usize::try_from(target_height)
                .ok()
                .and_then(|height| width.checked_mul(height))
        })
        .and_then(|pixels| pixels.checked_mul(channels))
        .filter(|&length| length <= u32::MAX as usize)
        .ok_or(ResizeError::SizeOverflow)?;
    let input = source.compact_bytes();
    let source_width = source.columns();
    let source_height = source.rows();
    let mut output = vec![0; output_length];
    for target_y in 0..target_height {
        let (top, bottom, vertical) = linear_axis(target_y, target_height, source_height);
        for target_x in 0..target_width {
            let (left, right, horizontal) = linear_axis(target_x, target_width, source_width);
            for channel in 0..channels {
                let top_left = input[pixel_offset(top, left, source_width, channels, channel)?];
                let top_right = input[pixel_offset(top, right, source_width, channels, channel)?];
                let bottom_left =
                    input[pixel_offset(bottom, left, source_width, channels, channel)?];
                let bottom_right =
                    input[pixel_offset(bottom, right, source_width, channels, channel)?];
                let top_value =
                    f64::from(top_left) * (1.0 - horizontal) + f64::from(top_right) * horizontal;
                let bottom_value = f64::from(bottom_left) * (1.0 - horizontal)
                    + f64::from(bottom_right) * horizontal;
                let value = top_value * (1.0 - vertical) + bottom_value * vertical;
                let output_offset =
                    pixel_offset(target_y, target_x, target_width, channels, channel)?;
                #[allow(clippy::cast_possible_truncation, clippy::cast_sign_loss)]
                {
                    output[output_offset] = value.round_ties_even().clamp(0.0, 255.0) as u8;
                }
            }
        }
    }
    Ok(output)
}

fn resize_area_u8(
    source: &Mat,
    target_width: u32,
    target_height: u32,
) -> Result<Vec<u8>, ResizeError> {
    if source.depth() != MatDepth::U8
        || target_width > source.columns()
        || target_height > source.rows()
    {
        return Err(ResizeError::UnsupportedAreaGeometry);
    }
    let channels = usize::from(source.channels());
    let output_length = usize::try_from(target_width)
        .ok()
        .and_then(|width| {
            usize::try_from(target_height)
                .ok()
                .and_then(|height| width.checked_mul(height))
        })
        .and_then(|pixels| pixels.checked_mul(channels))
        .filter(|&length| length <= u32::MAX as usize)
        .ok_or(ResizeError::SizeOverflow)?;
    let input = source.compact_bytes();
    let mut output = vec![0; output_length];
    let horizontal_scale = f64::from(source.columns()) / f64::from(target_width);
    let vertical_scale = f64::from(source.rows()) / f64::from(target_height);
    let covered_area = horizontal_scale * vertical_scale;
    for target_y in 0..target_height {
        let source_top = f64::from(target_y) * vertical_scale;
        let source_bottom = f64::from(target_y + 1) * vertical_scale;
        let first_row = source_top.floor() as u32;
        #[allow(clippy::cast_possible_truncation, clippy::cast_sign_loss)]
        let row_end = source_bottom.ceil() as u32;
        for target_x in 0..target_width {
            let source_left = f64::from(target_x) * horizontal_scale;
            let source_right = f64::from(target_x + 1) * horizontal_scale;
            let first_column = source_left.floor() as u32;
            #[allow(clippy::cast_possible_truncation, clippy::cast_sign_loss)]
            let column_end = source_right.ceil() as u32;
            for channel in 0..channels {
                let mut sum = 0.0;
                for source_y in first_row..row_end.min(source.rows()) {
                    let vertical_weight = overlap(
                        source_top,
                        source_bottom,
                        f64::from(source_y),
                        f64::from(source_y + 1),
                    );
                    for source_x in first_column..column_end.min(source.columns()) {
                        let horizontal_weight = overlap(
                            source_left,
                            source_right,
                            f64::from(source_x),
                            f64::from(source_x + 1),
                        );
                        let value = input[pixel_offset(
                            source_y,
                            source_x,
                            source.columns(),
                            channels,
                            channel,
                        )?];
                        sum += f64::from(value) * vertical_weight * horizontal_weight;
                    }
                }
                let value = (sum / covered_area).round_ties_even().clamp(0.0, 255.0);
                let output_offset =
                    pixel_offset(target_y, target_x, target_width, channels, channel)?;
                #[allow(clippy::cast_possible_truncation, clippy::cast_sign_loss)]
                {
                    output[output_offset] = value as u8;
                }
            }
        }
    }
    Ok(output)
}

fn overlap(first_start: f64, first_end: f64, second_start: f64, second_end: f64) -> f64 {
    first_end.min(second_end) - first_start.max(second_start)
}

fn linear_axis(target: u32, target_length: u32, source_length: u32) -> (u32, u32, f64) {
    let position =
        (f64::from(target) + 0.5) * f64::from(source_length) / f64::from(target_length) - 0.5;
    let lower = position.floor();
    let fraction = position - lower;
    let maximum = f64::from(source_length - 1);
    #[allow(clippy::cast_possible_truncation, clippy::cast_sign_loss)]
    let first = lower.clamp(0.0, maximum) as u32;
    #[allow(clippy::cast_possible_truncation, clippy::cast_sign_loss)]
    let second = (lower + 1.0).clamp(0.0, maximum) as u32;
    (first, second, fraction)
}

fn pixel_offset(
    row: u32,
    column: u32,
    width: u32,
    channels: usize,
    channel: usize,
) -> Result<usize, ResizeError> {
    usize::try_from(u64::from(row) * u64::from(width) + u64::from(column))
        .ok()
        .and_then(|pixel| pixel.checked_mul(channels))
        .and_then(|offset| offset.checked_add(channel))
        .ok_or(ResizeError::SizeOverflow)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::mat::{mat_empty, mat_from_u8};

    #[test]
    fn nearest_neighbor_expands_pixels_without_interpolation() {
        let source = mat_from_u8(&[1, 2, 3, 4], 2, 2, 1).expect("source");
        let destination = mat_empty();
        resize_into(&source, &destination, 4, 2, 0.0, 0.0, INTER_NEAREST).expect("resize");
        assert_eq!(destination.rows(), 2);
        assert_eq!(destination.columns(), 4);
        assert_eq!(destination.compact_bytes(), [1, 1, 2, 2, 3, 3, 4, 4]);
    }

    #[test]
    fn scale_factors_resolve_zero_target_dimensions() {
        let source = mat_from_u8(&[1, 2, 3, 4], 2, 2, 1).expect("source");
        let destination = mat_empty();
        resize_into(&source, &destination, 0, 0, 2.0, 0.5, INTER_NEAREST).expect("resize");
        assert_eq!(destination.rows(), 1);
        assert_eq!(destination.columns(), 4);
        assert_eq!(destination.compact_bytes(), [1, 1, 2, 2]);
    }

    #[test]
    fn linear_uses_half_pixel_coordinates_and_nearest_even_rounding() {
        let source = mat_from_u8(&[0, 100, 150, 255], 2, 2, 1).expect("source");
        let destination = mat_empty();
        resize_into(&source, &destination, 3, 3, 0.0, 0.0, INTER_LINEAR).expect("resize");
        assert_eq!(
            destination.compact_bytes(),
            [0, 50, 100, 75, 126, 178, 150, 202, 255]
        );
    }

    #[test]
    fn area_averages_each_covered_source_pixel_when_shrinking() {
        let source = mat_from_u8(
            &[
                0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150,
            ],
            4,
            4,
            1,
        )
        .expect("source");
        let destination = mat_empty();
        resize_into(&source, &destination, 2, 2, 0.0, 0.0, INTER_AREA).expect("resize");
        assert_eq!(destination.compact_bytes(), [25, 45, 105, 125]);
    }
}
