//! Depth-agnostic border expansion over compact interleaved matrix bytes.

use std::{error::Error, fmt};

pub(crate) const BORDER_CONSTANT: i32 = 0;
pub(crate) const BORDER_REPLICATE: i32 = 1;
pub(crate) const BORDER_REFLECT: i32 = 2;
pub(crate) const BORDER_WRAP: i32 = 3;
pub(crate) const BORDER_REFLECT_101: i32 = 4;
pub(crate) const BORDER_ISOLATED: i32 = 16;

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) enum BorderError {
    EmptyDimensions,
    EmptyPixel,
    IncorrectByteLength { expected: usize, actual: usize },
    IncorrectConstantLength { expected: usize, actual: usize },
    InvalidBorderType(i32),
    SizeOverflow,
}

impl fmt::Display for BorderError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::EmptyDimensions => formatter.write_str("matrix dimensions must be positive"),
            Self::EmptyPixel => formatter.write_str("matrix pixel width must be positive"),
            Self::IncorrectByteLength { expected, actual } => write!(
                formatter,
                "matrix buffer has {actual} bytes; expected {expected} bytes"
            ),
            Self::IncorrectConstantLength { expected, actual } => write!(
                formatter,
                "constant border pixel has {actual} bytes; expected {expected} bytes"
            ),
            Self::InvalidBorderType(value) => write!(formatter, "unsupported border type {value}"),
            Self::SizeOverflow => {
                formatter.write_str("bordered matrix exceeds the WASM size limit")
            }
        }
    }
}

impl Error for BorderError {}

pub(crate) struct BorderedBytes {
    bytes: Vec<u8>,
    rows: u32,
    columns: u32,
}

impl BorderedBytes {
    pub(crate) fn into_parts(self) -> (Vec<u8>, u32, u32) {
        (self.bytes, self.rows, self.columns)
    }
}

#[derive(Clone, Copy)]
pub(crate) struct BorderSpec<'a> {
    pub(crate) rows: u32,
    pub(crate) columns: u32,
    pub(crate) pixel_width: usize,
    pub(crate) top: u32,
    pub(crate) bottom: u32,
    pub(crate) left: u32,
    pub(crate) right: u32,
    pub(crate) border_type: i32,
    pub(crate) constant_pixel: &'a [u8],
}

pub(crate) fn copy_make_border(
    source: &[u8],
    spec: BorderSpec<'_>,
) -> Result<BorderedBytes, BorderError> {
    if spec.rows == 0 || spec.columns == 0 {
        return Err(BorderError::EmptyDimensions);
    }
    if spec.pixel_width == 0 {
        return Err(BorderError::EmptyPixel);
    }
    let source_pixels = usize::try_from(spec.rows)
        .ok()
        .and_then(|rows| {
            usize::try_from(spec.columns)
                .ok()
                .and_then(|columns| rows.checked_mul(columns))
        })
        .ok_or(BorderError::SizeOverflow)?;
    let expected = source_pixels
        .checked_mul(spec.pixel_width)
        .ok_or(BorderError::SizeOverflow)?;
    if source.len() != expected {
        return Err(BorderError::IncorrectByteLength {
            expected,
            actual: source.len(),
        });
    }
    if spec.constant_pixel.len() != spec.pixel_width {
        return Err(BorderError::IncorrectConstantLength {
            expected: spec.pixel_width,
            actual: spec.constant_pixel.len(),
        });
    }
    let base_border_type = spec.border_type & !BORDER_ISOLATED;
    if !matches!(
        base_border_type,
        BORDER_CONSTANT | BORDER_REPLICATE | BORDER_REFLECT | BORDER_WRAP | BORDER_REFLECT_101
    ) {
        return Err(BorderError::InvalidBorderType(spec.border_type));
    }

    let output_rows = spec
        .rows
        .checked_add(spec.top)
        .and_then(|value| value.checked_add(spec.bottom))
        .ok_or(BorderError::SizeOverflow)?;
    let output_columns = spec
        .columns
        .checked_add(spec.left)
        .and_then(|value| value.checked_add(spec.right))
        .ok_or(BorderError::SizeOverflow)?;
    let output_pixels = usize::try_from(output_rows)
        .ok()
        .and_then(|rows| {
            usize::try_from(output_columns)
                .ok()
                .and_then(|columns| rows.checked_mul(columns))
        })
        .ok_or(BorderError::SizeOverflow)?;
    let mut output = Vec::with_capacity(
        output_pixels
            .checked_mul(spec.pixel_width)
            .ok_or(BorderError::SizeOverflow)?,
    );

    for output_row in 0..output_rows {
        let source_row = border_index(
            i64::from(output_row) - i64::from(spec.top),
            spec.rows,
            base_border_type,
        );
        for output_column in 0..output_columns {
            let source_column = border_index(
                i64::from(output_column) - i64::from(spec.left),
                spec.columns,
                base_border_type,
            );
            match (source_row, source_column) {
                (Some(row), Some(column)) => {
                    let pixel = (usize::try_from(row).map_err(|_| BorderError::SizeOverflow)?
                        * usize::try_from(spec.columns).map_err(|_| BorderError::SizeOverflow)?
                        + usize::try_from(column).map_err(|_| BorderError::SizeOverflow)?)
                        * spec.pixel_width;
                    output.extend_from_slice(&source[pixel..pixel + spec.pixel_width]);
                }
                _ => output.extend_from_slice(spec.constant_pixel),
            }
        }
    }
    Ok(BorderedBytes {
        bytes: output,
        rows: output_rows,
        columns: output_columns,
    })
}

pub(crate) fn border_index(index: i64, length: u32, border_type: i32) -> Option<u32> {
    let length = i64::from(length);
    if (0..length).contains(&index) {
        return u32::try_from(index).ok();
    }
    if border_type == BORDER_CONSTANT {
        return None;
    }
    let mapped = match border_type {
        BORDER_REPLICATE => index.clamp(0, length - 1),
        BORDER_WRAP => index.rem_euclid(length),
        BORDER_REFLECT => reflect_index(index, length, false),
        BORDER_REFLECT_101 => reflect_index(index, length, true),
        _ => unreachable!("copy_make_border validates the border type"),
    };
    u32::try_from(mapped).ok()
}

fn reflect_index(index: i64, length: i64, omit_edge: bool) -> i64 {
    if length == 1 {
        return 0;
    }
    let period = if omit_edge {
        2 * length - 2
    } else {
        2 * length
    };
    let position = index.rem_euclid(period);
    if omit_edge {
        if position < length {
            position
        } else {
            period - position
        }
    } else if position < length {
        position
    } else {
        period - position - 1
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn apply(border_type: i32) -> Vec<u8> {
        copy_make_border(
            &[1, 2, 3],
            BorderSpec {
                rows: 1,
                columns: 3,
                pixel_width: 1,
                top: 0,
                bottom: 0,
                left: 2,
                right: 2,
                border_type,
                constant_pixel: &[9],
            },
        )
        .expect("valid border")
        .into_parts()
        .0
    }

    #[test]
    fn border_modes_match_documented_opencv_sequences() {
        assert_eq!(apply(BORDER_CONSTANT), [9, 9, 1, 2, 3, 9, 9]);
        assert_eq!(apply(BORDER_REPLICATE), [1, 1, 1, 2, 3, 3, 3]);
        assert_eq!(apply(BORDER_WRAP), [2, 3, 1, 2, 3, 1, 2]);
        assert_eq!(apply(BORDER_REFLECT), [2, 1, 1, 2, 3, 3, 2]);
        assert_eq!(apply(BORDER_REFLECT_101), [3, 2, 1, 2, 3, 2, 1]);
    }

    #[test]
    fn preserves_all_bytes_of_interleaved_wide_scalars() {
        let output = copy_make_border(
            &[1, 2, 3, 4],
            BorderSpec {
                rows: 1,
                columns: 1,
                pixel_width: 4,
                top: 1,
                bottom: 0,
                left: 1,
                right: 0,
                border_type: BORDER_CONSTANT,
                constant_pixel: &[8, 7, 6, 5],
            },
        )
        .expect("valid border");
        assert_eq!(
            output.into_parts(),
            (vec![8, 7, 6, 5, 8, 7, 6, 5, 8, 7, 6, 5, 1, 2, 3, 4], 2, 2)
        );
    }
}
