use std::{error::Error, fmt};

use crate::mat::{Mat, MatDepth, MatError};

pub(crate) const COLOR_BGR2_BGRA: i32 = 0;
pub(crate) const COLOR_BGRA2_BGR: i32 = 1;
pub(crate) const COLOR_BGR2_RGBA: i32 = 2;
pub(crate) const COLOR_RGBA2_BGR: i32 = 3;
pub(crate) const COLOR_BGR2_RGB: i32 = 4;
pub(crate) const COLOR_BGRA2_RGBA: i32 = 5;
pub(crate) const COLOR_BGR2_GRAY: i32 = 6;
pub(crate) const COLOR_RGB2_GRAY: i32 = 7;
pub(crate) const COLOR_GRAY2_BGR: i32 = 8;
pub(crate) const COLOR_GRAY2_BGRA: i32 = 9;
pub(crate) const COLOR_BGRA2_GRAY: i32 = 10;
pub(crate) const COLOR_RGBA2_GRAY: i32 = 11;

const BLUE_TO_GRAY: u32 = 1_868;
const GREEN_TO_GRAY: u32 = 9_617;
const RED_TO_GRAY: u32 = 4_899;
const GRAY_SHIFT: u32 = 14;
const GRAY_ROUND: u32 = 1 << (GRAY_SHIFT - 1);

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) enum ColorError {
    InvalidDestinationChannels(i32),
    InvalidSourceChannels { expected: u16, actual: u16 },
    Matrix(MatError),
    UnsupportedCode(i32),
    UnsupportedDepth(MatDepth),
}

impl fmt::Display for ColorError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::InvalidDestinationChannels(channels) => {
                write!(
                    formatter,
                    "cvtColor destination channels must be 0, 3, or 4; received {channels}"
                )
            }
            Self::InvalidSourceChannels { expected, actual } => write!(
                formatter,
                "cvtColor source has {actual} channels; conversion requires {expected}"
            ),
            Self::Matrix(error) => error.fmt(formatter),
            Self::UnsupportedCode(code) => write!(formatter, "unsupported cvtColor code {code}"),
            Self::UnsupportedDepth(depth) => {
                write!(formatter, "cvtColor depth {depth:?} is not implemented")
            }
        }
    }
}

impl Error for ColorError {
    fn source(&self) -> Option<&(dyn Error + 'static)> {
        match self {
            Self::Matrix(error) => Some(error),
            _ => None,
        }
    }
}

impl From<MatError> for ColorError {
    fn from(error: MatError) -> Self {
        Self::Matrix(error)
    }
}

pub(crate) fn cvt_color_into(
    source: &Mat,
    destination: &Mat,
    code: i32,
    destination_channels: i32,
) -> Result<(), ColorError> {
    if source.depth() != MatDepth::U8 {
        return Err(ColorError::UnsupportedDepth(source.depth()));
    }

    let specification = Conversion::from_code(code)?;
    require_source_channels(source, specification.source_channels())?;
    let output_channels = specification.output_channels(destination_channels)?;
    let source_bytes = source.compact_bytes();
    let output = specification.convert_u8(&source_bytes, output_channels);
    destination.write_output(
        output,
        source.rows(),
        source.columns(),
        output_channels,
        source.depth(),
    )?;
    Ok(())
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Conversion {
    AddAlpha {
        swap_blue_red: bool,
    },
    DropAlpha {
        swap_blue_red: bool,
    },
    Gray {
        blue_index: usize,
        source_channels: u16,
    },
    GrayToColor {
        default_channels: u16,
    },
    SwapBlueRed {
        channels: u16,
    },
}

impl Conversion {
    fn from_code(code: i32) -> Result<Self, ColorError> {
        match code {
            COLOR_BGR2_BGRA => Ok(Self::AddAlpha {
                swap_blue_red: false,
            }),
            COLOR_BGRA2_BGR => Ok(Self::DropAlpha {
                swap_blue_red: false,
            }),
            COLOR_BGR2_RGBA => Ok(Self::AddAlpha {
                swap_blue_red: true,
            }),
            COLOR_RGBA2_BGR => Ok(Self::DropAlpha {
                swap_blue_red: true,
            }),
            COLOR_BGR2_RGB => Ok(Self::SwapBlueRed { channels: 3 }),
            COLOR_BGRA2_RGBA => Ok(Self::SwapBlueRed { channels: 4 }),
            COLOR_BGR2_GRAY => Ok(Self::Gray {
                blue_index: 0,
                source_channels: 3,
            }),
            COLOR_RGB2_GRAY => Ok(Self::Gray {
                blue_index: 2,
                source_channels: 3,
            }),
            COLOR_GRAY2_BGR => Ok(Self::GrayToColor {
                default_channels: 3,
            }),
            COLOR_GRAY2_BGRA => Ok(Self::GrayToColor {
                default_channels: 4,
            }),
            COLOR_BGRA2_GRAY => Ok(Self::Gray {
                blue_index: 0,
                source_channels: 4,
            }),
            COLOR_RGBA2_GRAY => Ok(Self::Gray {
                blue_index: 2,
                source_channels: 4,
            }),
            _ => Err(ColorError::UnsupportedCode(code)),
        }
    }

    const fn source_channels(self) -> u16 {
        match self {
            Self::AddAlpha { .. } | Self::SwapBlueRed { channels: 3 } => 3,
            Self::DropAlpha { .. } | Self::SwapBlueRed { channels: 4 } => 4,
            Self::Gray {
                source_channels, ..
            } => source_channels,
            Self::GrayToColor { .. } => 1,
            Self::SwapBlueRed { .. } => unreachable!(),
        }
    }

    fn output_channels(self, requested: i32) -> Result<u16, ColorError> {
        let default = match self {
            Self::AddAlpha { .. } | Self::SwapBlueRed { channels: 4 } => 4,
            Self::DropAlpha { .. } | Self::SwapBlueRed { channels: 3 } => 3,
            Self::Gray { .. } => return Ok(1),
            Self::GrayToColor { default_channels } => default_channels,
            Self::SwapBlueRed { .. } => unreachable!(),
        };
        match requested {
            0 => Ok(default),
            3 => Ok(3),
            4 => Ok(4),
            value => Err(ColorError::InvalidDestinationChannels(value)),
        }
    }

    fn convert_u8(self, source: &[u8], output_channels: u16) -> Vec<u8> {
        let source_channels = usize::from(self.source_channels());
        let output_channels_usize = usize::from(output_channels);
        let pixels = source.len() / source_channels;
        let mut output = Vec::with_capacity(pixels * output_channels_usize);
        for pixel in source.chunks_exact(source_channels) {
            match self {
                Self::AddAlpha { swap_blue_red } | Self::DropAlpha { swap_blue_red } => {
                    append_color_pixel(&mut output, pixel, output_channels, swap_blue_red);
                }
                Self::SwapBlueRed { .. } => {
                    append_color_pixel(&mut output, pixel, output_channels, true);
                }
                Self::Gray {
                    blue_index,
                    source_channels: _,
                } => {
                    let red_index = 2 - blue_index;
                    output.push(gray_u8(pixel[red_index], pixel[1], pixel[blue_index]));
                }
                Self::GrayToColor { .. } => {
                    output.extend_from_slice(&[pixel[0], pixel[0], pixel[0]]);
                    if output_channels == 4 {
                        output.push(u8::MAX);
                    }
                }
            }
        }
        output
    }
}

fn require_source_channels(source: &Mat, expected: u16) -> Result<(), ColorError> {
    let actual = source.channels();
    if actual != expected {
        return Err(ColorError::InvalidSourceChannels { expected, actual });
    }
    Ok(())
}

fn append_color_pixel(output: &mut Vec<u8>, pixel: &[u8], channels: u16, swap: bool) {
    if swap {
        output.extend_from_slice(&[pixel[2], pixel[1], pixel[0]]);
    } else {
        output.extend_from_slice(&pixel[..3]);
    }
    if channels == 4 {
        output.push(pixel.get(3).copied().unwrap_or(u8::MAX));
    }
}

fn gray_u8(red: u8, green: u8, blue: u8) -> u8 {
    let weighted = u32::from(red) * RED_TO_GRAY
        + u32::from(green) * GREEN_TO_GRAY
        + u32::from(blue) * BLUE_TO_GRAY
        + GRAY_ROUND;
    u8::try_from(weighted >> GRAY_SHIFT).unwrap_or(u8::MAX)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::mat::{mat_empty, mat_from_u8};

    #[test]
    fn rgba_to_gray_matches_pinned_u8_rounding() {
        let source = mat_from_u8(&[255, 0, 0, 7, 1, 2, 3, 4], 1, 2, 4).expect("source");
        let destination = mat_empty();
        cvt_color_into(&source, &destination, COLOR_RGBA2_GRAY, 0).expect("conversion");
        assert_eq!(destination.channels(), 1);
        assert_eq!(destination.compact_bytes(), [76, 2]);
    }

    #[test]
    fn rgba_to_bgra_preserves_alpha() {
        let source = mat_from_u8(&[1, 2, 3, 4], 1, 1, 4).expect("source");
        let destination = mat_empty();
        cvt_color_into(&source, &destination, COLOR_BGRA2_RGBA, 0).expect("conversion");
        assert_eq!(destination.compact_bytes(), [3, 2, 1, 4]);
    }

    #[test]
    fn gray_expansion_uses_an_opaque_alpha_channel() {
        let source = mat_from_u8(&[7, 9], 1, 2, 1).expect("source");
        let destination = mat_empty();
        cvt_color_into(&source, &destination, COLOR_GRAY2_BGRA, 0).expect("conversion");
        assert_eq!(destination.compact_bytes(), [7, 7, 7, 255, 9, 9, 9, 255]);
    }

    #[test]
    fn conversion_is_safe_in_place() {
        let matrix = mat_from_u8(&[1, 2, 3, 4], 1, 1, 4).expect("source");
        cvt_color_into(&matrix, &matrix, COLOR_RGBA2_GRAY, 0).expect("conversion");
        assert_eq!(matrix.channels(), 1);
        assert_eq!(matrix.compact_bytes(), [2]);
    }
}
