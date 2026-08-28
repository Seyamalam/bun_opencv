use std::{error::Error, fmt};

use crate::{
    imgproc_border::{
        BORDER_CONSTANT, BORDER_ISOLATED, BORDER_REFLECT, BORDER_REFLECT_101, BORDER_REPLICATE,
        BORDER_WRAP, border_index,
    },
    mat::{Mat, MatDepth, MatError},
};

pub(crate) const MORPH_ERODE: i32 = 0;
pub(crate) const MORPH_DILATE: i32 = 1;
pub(crate) const MORPH_OPEN: i32 = 2;
pub(crate) const MORPH_CLOSE: i32 = 3;
pub(crate) const MORPH_GRADIENT: i32 = 4;
pub(crate) const MORPH_TOPHAT: i32 = 5;
pub(crate) const MORPH_BLACKHAT: i32 = 6;

#[derive(Debug, Clone, PartialEq)]
pub(crate) enum FilterError {
    EmptySource,
    InvalidAnchor { x: i32, y: i32 },
    InvalidDerivative { dx: i32, dy: i32, kernel_size: i32 },
    InvalidIterations(i32),
    InvalidKernelSize { width: i32, height: i32 },
    InvalidBorderType(i32),
    InvalidMorphologyOperation(i32),
    Matrix(MatError),
    UnsupportedDepth(MatDepth),
    UnsupportedDestinationDepth(i32),
}

impl fmt::Display for FilterError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::EmptySource => formatter.write_str("filter source must not be empty"),
            Self::InvalidAnchor { x, y } => write!(formatter, "invalid filter anchor ({x}, {y})"),
            Self::InvalidDerivative {
                dx,
                dy,
                kernel_size,
            } => write!(
                formatter,
                "unsupported Sobel derivative dx={dx}, dy={dy}, ksize={kernel_size}"
            ),
            Self::InvalidIterations(value) => {
                write!(
                    formatter,
                    "morphology iterations must be positive; received {value}"
                )
            }
            Self::InvalidKernelSize { width, height } => write!(
                formatter,
                "filter kernel dimensions must be positive odd values; received {width} by {height}"
            ),
            Self::InvalidBorderType(value) => write!(formatter, "unsupported border type {value}"),
            Self::InvalidMorphologyOperation(value) => {
                write!(formatter, "unsupported morphology operation {value}")
            }
            Self::Matrix(error) => error.fmt(formatter),
            Self::UnsupportedDepth(depth) => {
                write!(
                    formatter,
                    "filter source depth {depth:?} is not implemented"
                )
            }
            Self::UnsupportedDestinationDepth(depth) => {
                write!(formatter, "unsupported Sobel destination depth {depth}")
            }
        }
    }
}

impl Error for FilterError {
    fn source(&self) -> Option<&(dyn Error + 'static)> {
        match self {
            Self::Matrix(error) => Some(error),
            _ => None,
        }
    }
}

impl From<MatError> for FilterError {
    fn from(error: MatError) -> Self {
        Self::Matrix(error)
    }
}

#[allow(clippy::too_many_arguments)]
pub(crate) fn gaussian_blur_into(
    source: &Mat,
    destination: &Mat,
    width: i32,
    height: i32,
    sigma_x: f64,
    sigma_y: f64,
    border_type: i32,
) -> Result<(), FilterError> {
    require_u8(source)?;
    validate_odd_kernel(width, height)?;
    validate_border_type(border_type)?;
    let sigma_y = if sigma_y > 0.0 { sigma_y } else { sigma_x };
    let horizontal = gaussian_kernel(width, sigma_x);
    let vertical = gaussian_kernel(height, sigma_y);
    let input = source.compact_bytes();
    let channels = usize::from(source.channels());
    let mut output = vec![0; input.len()];
    for row in 0..source.rows() {
        for column in 0..source.columns() {
            for channel in 0..channels {
                let mut sum = 0.0;
                for (kernel_y, &vertical_weight) in vertical.iter().enumerate() {
                    let source_y = i64::from(row) + index_delta(kernel_y, vertical.len());
                    let mapped_y =
                        border_index(source_y, source.rows(), border_type & !BORDER_ISOLATED);
                    for (kernel_x, &horizontal_weight) in horizontal.iter().enumerate() {
                        let source_x = i64::from(column) + index_delta(kernel_x, horizontal.len());
                        let mapped_x = border_index(
                            source_x,
                            source.columns(),
                            border_type & !BORDER_ISOLATED,
                        );
                        if let (Some(y), Some(x)) = (mapped_y, mapped_x) {
                            sum += f64::from(
                                input[pixel_offset(y, x, source.columns(), channels, channel)],
                            ) * vertical_weight
                                * horizontal_weight;
                        }
                    }
                }
                output[pixel_offset(row, column, source.columns(), channels, channel)] =
                    round_u8(sum);
            }
        }
    }
    destination.write_output(
        output,
        source.rows(),
        source.columns(),
        source.channels(),
        MatDepth::U8,
    )?;
    Ok(())
}

#[allow(clippy::too_many_arguments)]
pub(crate) fn morphology_ex_into(
    source: &Mat,
    destination: &Mat,
    operation: i32,
    kernel: &Mat,
    anchor_x: i32,
    anchor_y: i32,
    iterations: i32,
    border_type: i32,
    border_value: &[f64],
    default_border_value: bool,
) -> Result<(), FilterError> {
    require_u8(source)?;
    require_u8(kernel)?;
    if kernel.channels() != 1 {
        return Err(FilterError::InvalidKernelSize {
            width: i32::try_from(kernel.columns()).unwrap_or(i32::MAX),
            height: i32::try_from(kernel.rows()).unwrap_or(i32::MAX),
        });
    }
    if iterations <= 0 {
        return Err(FilterError::InvalidIterations(iterations));
    }
    validate_border_type(border_type)?;
    if !matches!(
        operation,
        MORPH_ERODE
            | MORPH_DILATE
            | MORPH_OPEN
            | MORPH_CLOSE
            | MORPH_GRADIENT
            | MORPH_TOPHAT
            | MORPH_BLACKHAT
    ) {
        return Err(FilterError::InvalidMorphologyOperation(operation));
    }
    let anchor = resolve_anchor(anchor_x, anchor_y, kernel.columns(), kernel.rows())?;
    let source_bytes = source.compact_bytes();
    let kernel_bytes = kernel.compact_bytes();
    let channels = usize::from(source.channels());
    let apply = |input: &[u8], erode: bool| {
        morphology_primitive(
            input,
            source.rows(),
            source.columns(),
            channels,
            &kernel_bytes,
            kernel.rows(),
            kernel.columns(),
            anchor,
            iterations,
            border_type,
            border_value,
            default_border_value,
            erode,
        )
    };
    let erode = || apply(&source_bytes, true);
    let dilate = || apply(&source_bytes, false);
    let output = match operation {
        MORPH_ERODE => erode(),
        MORPH_DILATE => dilate(),
        MORPH_OPEN => apply(&erode(), false),
        MORPH_CLOSE => apply(&dilate(), true),
        MORPH_GRADIENT => subtract_saturating(&dilate(), &erode()),
        MORPH_TOPHAT => subtract_saturating(&source_bytes, &apply(&erode(), false)),
        MORPH_BLACKHAT => subtract_saturating(&apply(&dilate(), true), &source_bytes),
        _ => unreachable!("morphology operation was validated"),
    };
    destination.write_output(
        output,
        source.rows(),
        source.columns(),
        source.channels(),
        MatDepth::U8,
    )?;
    Ok(())
}

#[allow(clippy::too_many_arguments)]
pub(crate) fn sobel_into(
    source: &Mat,
    destination: &Mat,
    destination_depth: i32,
    dx: i32,
    dy: i32,
    kernel_size: i32,
    scale: f64,
    delta: f64,
    border_type: i32,
) -> Result<(), FilterError> {
    require_u8(source)?;
    validate_border_type(border_type)?;
    if kernel_size != 3 || dx < 0 || dy < 0 || dx > 2 || dy > 2 || dx + dy == 0 || dx + dy > 2 {
        return Err(FilterError::InvalidDerivative {
            dx,
            dy,
            kernel_size,
        });
    }
    let horizontal = derivative_kernel(dx);
    let vertical = derivative_kernel(dy);
    let input = source.compact_bytes();
    let channels = usize::from(source.channels());
    let mut values = Vec::with_capacity(input.len());
    for row in 0..source.rows() {
        for column in 0..source.columns() {
            for channel in 0..channels {
                let mut sum = 0.0;
                for (kernel_y, &vertical_weight) in vertical.iter().enumerate() {
                    let mapped_y = border_index(
                        i64::from(row) + index_delta(kernel_y, 3),
                        source.rows(),
                        border_type & !BORDER_ISOLATED,
                    );
                    for (kernel_x, &horizontal_weight) in horizontal.iter().enumerate() {
                        let mapped_x = border_index(
                            i64::from(column) + index_delta(kernel_x, 3),
                            source.columns(),
                            border_type & !BORDER_ISOLATED,
                        );
                        if let (Some(y), Some(x)) = (mapped_y, mapped_x) {
                            sum += f64::from(
                                input[pixel_offset(y, x, source.columns(), channels, channel)],
                            ) * vertical_weight
                                * horizontal_weight;
                        }
                    }
                }
                values.push(sum * scale + delta);
            }
        }
    }
    let (output, depth) = encode_sobel(&values, destination_depth, source.depth())?;
    destination.write_output(
        output,
        source.rows(),
        source.columns(),
        source.channels(),
        depth,
    )?;
    Ok(())
}

fn require_u8(source: &Mat) -> Result<(), FilterError> {
    if source.rows() == 0 || source.columns() == 0 {
        return Err(FilterError::EmptySource);
    }
    if source.depth() != MatDepth::U8 {
        return Err(FilterError::UnsupportedDepth(source.depth()));
    }
    Ok(())
}

fn validate_odd_kernel(width: i32, height: i32) -> Result<(), FilterError> {
    if width <= 0 || height <= 0 || width % 2 == 0 || height % 2 == 0 {
        return Err(FilterError::InvalidKernelSize { width, height });
    }
    Ok(())
}

fn validate_border_type(border_type: i32) -> Result<(), FilterError> {
    if matches!(
        border_type & !BORDER_ISOLATED,
        BORDER_CONSTANT | BORDER_REPLICATE | BORDER_REFLECT | BORDER_WRAP | BORDER_REFLECT_101
    ) {
        Ok(())
    } else {
        Err(FilterError::InvalidBorderType(border_type))
    }
}

fn gaussian_kernel(size: i32, sigma: f64) -> Vec<f64> {
    if size == 1 {
        return vec![1.0];
    }
    if sigma <= 0.0 && size == 3 {
        return vec![0.25, 0.5, 0.25];
    }
    let sigma = if sigma > 0.0 {
        sigma
    } else {
        0.3 * ((f64::from(size) - 1.0) * 0.5 - 1.0) + 0.8
    };
    let radius = (size - 1) / 2;
    let mut values = (-radius..=radius)
        .map(|position| (-f64::from(position * position) / (2.0 * sigma * sigma)).exp())
        .collect::<Vec<_>>();
    let sum = values.iter().sum::<f64>();
    for value in &mut values {
        *value /= sum;
    }
    values
}

fn derivative_kernel(order: i32) -> [f64; 3] {
    match order {
        0 => [1.0, 2.0, 1.0],
        1 => [-1.0, 0.0, 1.0],
        2 => [1.0, -2.0, 1.0],
        _ => unreachable!("Sobel derivative order was validated"),
    }
}

#[allow(clippy::too_many_arguments)]
fn morphology_primitive(
    source: &[u8],
    rows: u32,
    columns: u32,
    channels: usize,
    kernel: &[u8],
    kernel_rows: u32,
    kernel_columns: u32,
    anchor: (i32, i32),
    iterations: i32,
    border_type: i32,
    border_value: &[f64],
    default_border_value: bool,
    erode: bool,
) -> Vec<u8> {
    let mut current = source.to_vec();
    for _ in 0..iterations {
        let mut output = vec![0; current.len()];
        for row in 0..rows {
            for column in 0..columns {
                for channel in 0..channels {
                    let mut selected = if erode { u8::MAX } else { u8::MIN };
                    for kernel_y in 0..kernel_rows {
                        for kernel_x in 0..kernel_columns {
                            if kernel[usize::try_from(kernel_y * kernel_columns + kernel_x)
                                .expect("kernel index fits usize")]
                                == 0
                            {
                                continue;
                            }
                            let mapped_y = border_index(
                                i64::from(row) + i64::from(kernel_y) - i64::from(anchor.1),
                                rows,
                                border_type & !BORDER_ISOLATED,
                            );
                            let mapped_x = border_index(
                                i64::from(column) + i64::from(kernel_x) - i64::from(anchor.0),
                                columns,
                                border_type & !BORDER_ISOLATED,
                            );
                            let value = match (mapped_y, mapped_x) {
                                (Some(y), Some(x)) => {
                                    current[pixel_offset(y, x, columns, channels, channel)]
                                }
                                _ if border_type & !BORDER_ISOLATED == BORDER_CONSTANT => {
                                    if default_border_value {
                                        if erode { u8::MAX } else { u8::MIN }
                                    } else {
                                        round_u8(*border_value.get(channel).unwrap_or(&0.0))
                                    }
                                }
                                _ => unreachable!("non-constant borders always map an index"),
                            };
                            selected = if erode {
                                selected.min(value)
                            } else {
                                selected.max(value)
                            };
                        }
                    }
                    output[pixel_offset(row, column, columns, channels, channel)] = selected;
                }
            }
        }
        current = output;
    }
    current
}

fn resolve_anchor(x: i32, y: i32, columns: u32, rows: u32) -> Result<(i32, i32), FilterError> {
    let center_x = i32::try_from(columns / 2).map_err(|_| FilterError::InvalidAnchor { x, y })?;
    let center_y = i32::try_from(rows / 2).map_err(|_| FilterError::InvalidAnchor { x, y })?;
    let resolved = (
        if x < 0 { center_x } else { x },
        if y < 0 { center_y } else { y },
    );
    if resolved.0 < 0
        || resolved.1 < 0
        || u32::try_from(resolved.0).map_or(true, |value| value >= columns)
        || u32::try_from(resolved.1).map_or(true, |value| value >= rows)
    {
        return Err(FilterError::InvalidAnchor { x, y });
    }
    Ok(resolved)
}

fn subtract_saturating(left: &[u8], right: &[u8]) -> Vec<u8> {
    left.iter()
        .zip(right)
        .map(|(&left, &right)| left.saturating_sub(right))
        .collect()
}

fn encode_sobel(
    values: &[f64],
    destination_depth: i32,
    source_depth: MatDepth,
) -> Result<(Vec<u8>, MatDepth), FilterError> {
    let destination_depth = if destination_depth == -1 {
        0
    } else {
        destination_depth
    };
    let depth = match destination_depth {
        0 => source_depth,
        3 => MatDepth::I16,
        5 => MatDepth::F32,
        6 => MatDepth::F64,
        _ => return Err(FilterError::UnsupportedDestinationDepth(destination_depth)),
    };
    let mut output = Vec::with_capacity(values.len() * depth.byte_width());
    for &value in values {
        match depth {
            MatDepth::U8 => output.push(round_u8(value)),
            MatDepth::I16 => {
                #[allow(clippy::cast_possible_truncation)]
                let converted = value
                    .round_ties_even()
                    .clamp(f64::from(i16::MIN), f64::from(i16::MAX))
                    as i16;
                output.extend_from_slice(&converted.to_ne_bytes());
            }
            MatDepth::F32 => output.extend_from_slice(&(value as f32).to_ne_bytes()),
            MatDepth::F64 => output.extend_from_slice(&value.to_ne_bytes()),
            _ => unreachable!("Sobel output depth is constrained"),
        }
    }
    Ok((output, depth))
}

fn index_delta(index: usize, length: usize) -> i64 {
    i64::try_from(index).expect("kernel index fits i64")
        - i64::try_from(length / 2).expect("kernel radius fits i64")
}

fn pixel_offset(row: u32, column: u32, columns: u32, channels: usize, channel: usize) -> usize {
    (usize::try_from(row).expect("matrix row fits usize")
        * usize::try_from(columns).expect("matrix width fits usize")
        + usize::try_from(column).expect("matrix column fits usize"))
        * channels
        + channel
}

fn round_u8(value: f64) -> u8 {
    if value.is_nan() {
        return 0;
    }
    #[allow(clippy::cast_possible_truncation, clippy::cast_sign_loss)]
    {
        value.round_ties_even().clamp(0.0, 255.0) as u8
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::mat::{mat_empty, mat_from_u8};

    #[test]
    fn gaussian_three_tap_impulse_matches_the_exact_binomial_kernel() {
        let source = mat_from_u8(&[0, 0, 255, 0, 0], 1, 5, 1).expect("source");
        let destination = mat_empty();
        gaussian_blur_into(&source, &destination, 3, 1, 0.0, 0.0, BORDER_CONSTANT).expect("blur");
        assert_eq!(destination.compact_bytes(), [0, 64, 128, 64, 0]);
    }

    #[test]
    fn morphology_uses_default_neutral_constant_borders() {
        let source = mat_from_u8(&[0, 255, 255, 255, 0], 1, 5, 1).expect("source");
        let kernel = mat_from_u8(&[1, 1, 1], 1, 3, 1).expect("kernel");
        let eroded = mat_empty();
        let dilated = mat_empty();
        morphology_ex_into(
            &source,
            &eroded,
            MORPH_ERODE,
            &kernel,
            -1,
            -1,
            1,
            0,
            &[],
            true,
        )
        .expect("erode");
        morphology_ex_into(
            &source,
            &dilated,
            MORPH_DILATE,
            &kernel,
            -1,
            -1,
            1,
            0,
            &[],
            true,
        )
        .expect("dilate");
        assert_eq!(eroded.compact_bytes(), [0, 0, 255, 0, 0]);
        assert_eq!(dilated.compact_bytes(), [255; 5]);
    }

    #[test]
    fn sobel_writes_signed_gradients() {
        let source = mat_from_u8(&[0, 10, 20, 0, 10, 20, 0, 10, 20], 3, 3, 1).expect("source");
        let destination = mat_empty();
        sobel_into(&source, &destination, 3, 1, 0, 3, 1.0, 0.0, BORDER_CONSTANT).expect("sobel");
        let values = destination
            .compact_bytes()
            .chunks_exact(2)
            .map(|bytes| i16::from_ne_bytes([bytes[0], bytes[1]]))
            .collect::<Vec<_>>();
        assert_eq!(values, [30, 60, -30, 40, 80, -40, 30, 60, -30]);
    }
}
