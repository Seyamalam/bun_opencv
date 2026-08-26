//! Depth-agnostic byte-layout kernels for compact matrices.

use std::{error::Error, fmt};

#[cfg(test)]
mod tests {
    use super::*;

    fn matrix(
        bytes: &[u8],
        rows: u32,
        columns: u32,
        channels: u16,
        element_width: u8,
    ) -> ByteMatrix<'_> {
        ByteMatrix::new(
            bytes,
            MatLayout::new(rows, columns, channels, element_width).expect("valid test layout"),
        )
        .expect("matching test bytes")
    }

    #[test]
    fn flip_preserves_multibyte_elements_without_changing_byte_order() {
        let bytes = [1, 2, 3, 4, 5, 6, 7, 8];
        let source = matrix(&bytes, 2, 2, 1, 2);

        assert_eq!(
            flip_bytes(source, 0).expect("vertical flip").bytes(),
            [5, 6, 7, 8, 1, 2, 3, 4]
        );
        assert_eq!(
            flip_bytes(source, 1).expect("horizontal flip").bytes(),
            [3, 4, 1, 2, 7, 8, 5, 6]
        );
        assert_eq!(
            flip_bytes(source, -1).expect("both axes").bytes(),
            [7, 8, 5, 6, 3, 4, 1, 2]
        );
    }

    #[test]
    fn transpose_moves_interleaved_multi_channel_pixels_as_units() {
        let bytes = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
        let source = matrix(&bytes, 2, 3, 2, 1);
        let output = transpose_bytes(source).expect("transpose");

        assert_eq!(output.layout(), MatLayout::new(3, 2, 2, 1).expect("layout"));
        assert_eq!(output.layout().columns(), 2);
        assert_eq!(output.layout().channels(), 2);
        assert_eq!(output.layout().element_width(), 1);
        assert_eq!(output.bytes(), [1, 2, 7, 8, 3, 4, 9, 10, 5, 6, 11, 12]);
    }

    #[test]
    fn rotations_match_opencv_rotation_codes() {
        let bytes = [1, 2, 3, 4, 5, 6];
        let source = matrix(&bytes, 2, 3, 1, 1);

        let clockwise = rotate_bytes(source, 0).expect("90 clockwise");
        assert_eq!(
            clockwise.layout(),
            MatLayout::new(3, 2, 1, 1).expect("layout")
        );
        assert_eq!(clockwise.bytes(), [4, 1, 5, 2, 6, 3]);

        let half_turn = rotate_bytes(source, 1).expect("180");
        assert_eq!(half_turn.layout(), source.layout());
        assert_eq!(half_turn.bytes(), [6, 5, 4, 3, 2, 1]);

        let counterclockwise = rotate_bytes(source, 2).expect("90 counterclockwise");
        assert_eq!(
            counterclockwise.layout(),
            MatLayout::new(3, 2, 1, 1).expect("layout")
        );
        assert_eq!(counterclockwise.bytes(), [3, 6, 2, 5, 1, 4]);
    }

    #[test]
    fn singleton_dimensions_remain_valid_for_every_transform() {
        let bytes = [10, 11, 20, 21, 30, 31];
        let row = matrix(&bytes, 1, 3, 1, 2);

        assert_eq!(
            flip_bytes(row, 0).expect("vertical singleton").bytes(),
            bytes
        );
        assert_eq!(
            flip_bytes(row, 1).expect("horizontal row").bytes(),
            [30, 31, 20, 21, 10, 11]
        );
        assert_eq!(
            transpose_bytes(row).expect("transpose row").layout().rows(),
            3
        );
        assert_eq!(rotate_bytes(row, 0).expect("rotate row").bytes(), bytes);
    }

    #[test]
    fn repeat_tiles_rows_and_columns_independently() {
        let bytes = [1, 2, 3, 4];
        let source = matrix(&bytes, 2, 2, 1, 1);
        let output = repeat_bytes(source, 2, 3).expect("repeat");

        assert_eq!(output.layout(), MatLayout::new(4, 6, 1, 1).expect("layout"));
        assert_eq!(
            output.bytes(),
            [
                1, 2, 1, 2, 1, 2, 3, 4, 3, 4, 3, 4, 1, 2, 1, 2, 1, 2, 3, 4, 3, 4, 3, 4
            ]
        );
    }

    #[test]
    fn horizontal_concat_preserves_source_order_and_layout() {
        let left_bytes = [1, 2, 3, 4];
        let middle_bytes = [5, 6];
        let right_bytes = [7, 8, 9, 10];
        let sources = [
            matrix(&left_bytes, 2, 2, 1, 1),
            matrix(&middle_bytes, 2, 1, 1, 1),
            matrix(&right_bytes, 2, 2, 1, 1),
        ];
        let output = hconcat_bytes(&sources).expect("compatible matrices");

        assert_eq!(output.layout(), MatLayout::new(2, 5, 1, 1).expect("layout"));
        assert_eq!(output.bytes(), [1, 2, 5, 7, 8, 3, 4, 6, 9, 10]);
    }

    #[test]
    fn vertical_concat_preserves_source_order_and_layout() {
        let top_bytes = [1, 2, 3, 4];
        let middle_bytes = [5, 6];
        let bottom_bytes = [7, 8, 9, 10];
        let sources = [
            matrix(&top_bytes, 2, 2, 1, 1),
            matrix(&middle_bytes, 1, 2, 1, 1),
            matrix(&bottom_bytes, 2, 2, 1, 1),
        ];
        let output = vconcat_bytes(&sources).expect("compatible matrices");

        assert_eq!(output.layout(), MatLayout::new(5, 2, 1, 1).expect("layout"));
        assert_eq!(output.bytes(), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
        let (owned_bytes, owned_layout) = output.into_parts();
        assert_eq!(owned_bytes, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
        assert_eq!(owned_layout, MatLayout::new(5, 2, 1, 1).expect("layout"));
    }

    #[test]
    fn source_descriptor_rejects_incorrect_buffer_length() {
        let layout = MatLayout::new(2, 2, 1, 2).expect("valid layout");
        assert_eq!(
            ByteMatrix::new(&[0; 7], layout),
            Err(LayoutError::IncorrectBufferLength {
                expected: 8,
                actual: 7
            })
        );
    }

    #[test]
    fn invalid_transform_codes_are_rejected() {
        let bytes = [1];
        let source = matrix(&bytes, 1, 1, 1, 1);
        assert_eq!(
            rotate_bytes(source, -1),
            Err(LayoutError::InvalidRotateCode(-1))
        );
        assert_eq!(
            rotate_bytes(source, 3),
            Err(LayoutError::InvalidRotateCode(3))
        );
    }

    #[test]
    fn flip_uses_the_sign_of_every_i32_code() {
        let bytes = [1, 2, 3, 4, 5, 6];
        let source = matrix(&bytes, 2, 3, 1, 1);

        assert_eq!(
            flip_bytes(source, 2).expect("positive codes flip columns").bytes(),
            [3, 2, 1, 6, 5, 4]
        );
        assert_eq!(
            flip_bytes(source, -2).expect("negative codes flip both axes").bytes(),
            [6, 5, 4, 3, 2, 1]
        );
    }

    #[test]
    fn repeat_rejects_zero_and_negative_counts() {
        let bytes = [1];
        let source = matrix(&bytes, 1, 1, 1, 1);
        assert_eq!(
            repeat_bytes(source, 0, 1),
            Err(LayoutError::InvalidRepeatCount {
                rows: 0,
                columns: 1
            })
        );
        assert_eq!(
            repeat_bytes(source, 1, -2),
            Err(LayoutError::InvalidRepeatCount {
                rows: 1,
                columns: -2
            })
        );
    }

    #[test]
    fn layout_rejects_zero_metadata_and_checked_size_overflow() {
        assert_eq!(MatLayout::new(0, 1, 1, 1), Err(LayoutError::EmptyRows));
        assert_eq!(MatLayout::new(1, 0, 1, 1), Err(LayoutError::EmptyColumns));
        assert_eq!(MatLayout::new(1, 1, 0, 1), Err(LayoutError::EmptyChannels));
        assert_eq!(
            MatLayout::new(1, 1, 1, 0),
            Err(LayoutError::EmptyElementWidth)
        );
        assert_eq!(
            MatLayout::new(u32::MAX, u32::MAX, u16::MAX, u8::MAX),
            Err(LayoutError::SizeOverflow)
        );
    }

    #[test]
    fn concat_rejects_empty_and_incompatible_sources() {
        assert_eq!(hconcat_bytes(&[]), Err(LayoutError::EmptySources));
        assert_eq!(vconcat_bytes(&[]), Err(LayoutError::EmptySources));

        let first_bytes = [1, 2];
        let second_bytes = [3, 4, 5, 6];
        let first = matrix(&first_bytes, 1, 2, 1, 1);
        let different_rows = matrix(&second_bytes, 2, 2, 1, 1);
        assert!(matches!(
            hconcat_bytes(&[first, different_rows]),
            Err(LayoutError::IncompatibleSource { index: 1, .. })
        ));

        let different_columns = matrix(&second_bytes, 1, 2, 2, 1);
        assert!(matches!(
            vconcat_bytes(&[first, different_columns]),
            Err(LayoutError::IncompatibleSource { index: 1, .. })
        ));
    }
}

/// Compact matrix shape and scalar storage width.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) struct MatLayout {
    rows: u32,
    columns: u32,
    channels: u16,
    element_width: u8,
}

impl MatLayout {
    /// Builds validated compact matrix metadata.
    pub(crate) fn new(
        rows: u32,
        columns: u32,
        channels: u16,
        element_width: u8,
    ) -> Result<Self, LayoutError> {
        if rows == 0 {
            return Err(LayoutError::EmptyRows);
        }
        if columns == 0 {
            return Err(LayoutError::EmptyColumns);
        }
        if channels == 0 {
            return Err(LayoutError::EmptyChannels);
        }
        if element_width == 0 {
            return Err(LayoutError::EmptyElementWidth);
        }

        let layout = Self {
            rows,
            columns,
            channels,
            element_width,
        };
        layout.byte_length()?;
        Ok(layout)
    }

    pub(crate) const fn rows(self) -> u32 {
        self.rows
    }

    pub(crate) const fn columns(self) -> u32 {
        self.columns
    }

    pub(crate) const fn channels(self) -> u16 {
        self.channels
    }

    #[cfg(test)]
    pub(crate) const fn element_width(self) -> u8 {
        self.element_width
    }

    fn pixel_width(self) -> Result<usize, LayoutError> {
        usize::from(self.channels)
            .checked_mul(usize::from(self.element_width))
            .ok_or(LayoutError::SizeOverflow)
    }

    fn row_width(self) -> Result<usize, LayoutError> {
        usize::try_from(self.columns)
            .map_err(|_| LayoutError::SizeOverflow)?
            .checked_mul(self.pixel_width()?)
            .ok_or(LayoutError::SizeOverflow)
    }

    fn byte_length(self) -> Result<usize, LayoutError> {
        usize::try_from(self.rows)
            .map_err(|_| LayoutError::SizeOverflow)?
            .checked_mul(self.row_width()?)
            .ok_or(LayoutError::SizeOverflow)
    }
}

/// Validated borrowed compact matrix bytes.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) struct ByteMatrix<'data> {
    bytes: &'data [u8],
    layout: MatLayout,
}

impl<'data> ByteMatrix<'data> {
    /// Validates that the byte slice exactly fills the declared compact layout.
    pub(crate) fn new(bytes: &'data [u8], layout: MatLayout) -> Result<Self, LayoutError> {
        let expected = layout.byte_length()?;
        if bytes.len() != expected {
            return Err(LayoutError::IncorrectBufferLength {
                expected,
                actual: bytes.len(),
            });
        }
        Ok(Self { bytes, layout })
    }

    #[cfg(test)]
    pub(crate) const fn layout(self) -> MatLayout {
        self.layout
    }
}

/// Rust-owned compact matrix bytes produced by a layout kernel.
#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct OwnedByteMatrix {
    bytes: Vec<u8>,
    layout: MatLayout,
}

impl OwnedByteMatrix {
    #[cfg(test)]
    pub(crate) fn bytes(&self) -> &[u8] {
        &self.bytes
    }

    #[cfg(test)]
    pub(crate) const fn layout(&self) -> MatLayout {
        self.layout
    }

    pub(crate) fn into_parts(self) -> (Vec<u8>, MatLayout) {
        (self.bytes, self.layout)
    }
}

/// Validation or allocation failure from a compact byte-layout kernel.
#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) enum LayoutError {
    EmptyRows,
    EmptyColumns,
    EmptyChannels,
    EmptyElementWidth,
    SizeOverflow,
    AllocationFailed,
    IncorrectBufferLength {
        expected: usize,
        actual: usize,
    },
    InvalidRotateCode(i32),
    InvalidRepeatCount {
        rows: i32,
        columns: i32,
    },
    EmptySources,
    IncompatibleSource {
        index: usize,
        expected: MatLayout,
        actual: MatLayout,
    },
    InternalBounds,
}

impl fmt::Display for LayoutError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::EmptyRows => formatter.write_str("matrix rows must be greater than zero"),
            Self::EmptyColumns => formatter.write_str("matrix columns must be greater than zero"),
            Self::EmptyChannels => formatter.write_str("matrix channels must be greater than zero"),
            Self::EmptyElementWidth => {
                formatter.write_str("matrix element width must be greater than zero")
            }
            Self::SizeOverflow => {
                formatter.write_str("matrix layout exceeds the addressable byte limit")
            }
            Self::AllocationFailed => formatter.write_str("matrix output allocation failed"),
            Self::IncorrectBufferLength { expected, actual } => write!(
                formatter,
                "matrix buffer has {actual} bytes; expected {expected} bytes"
            ),
            Self::InvalidRotateCode(code) => {
                write!(formatter, "rotate code {code} is not 0, 1, or 2")
            }
            Self::InvalidRepeatCount { rows, columns } => write!(
                formatter,
                "repeat counts must be positive; received {rows} row repeats and {columns} column repeats"
            ),
            Self::EmptySources => formatter.write_str("concatenation requires at least one matrix"),
            Self::IncompatibleSource {
                index,
                expected,
                actual,
            } => write!(
                formatter,
                "source {index} has layout {actual:?}; expected compatibility with {expected:?}"
            ),
            Self::InternalBounds => {
                formatter.write_str("validated matrix layout produced an invalid byte range")
            }
        }
    }
}

impl Error for LayoutError {}

/// Flips compact matrix bytes vertically (`0`), horizontally (positive), or on both axes
/// (negative).
pub(crate) fn flip_bytes(
    source: ByteMatrix<'_>,
    flip_code: i32,
) -> Result<OwnedByteMatrix, LayoutError> {
    let (flip_rows, flip_columns) = match flip_code.cmp(&0) {
        std::cmp::Ordering::Equal => (true, false),
        std::cmp::Ordering::Greater => (false, true),
        std::cmp::Ordering::Less => (true, true),
    };
    remap_pixels(source, source.layout, |row, column| {
        let source_row = if flip_rows {
            source.layout.rows - row - 1
        } else {
            row
        };
        let source_column = if flip_columns {
            source.layout.columns - column - 1
        } else {
            column
        };
        (source_row, source_column)
    })
}

/// Transposes compact matrix bytes while preserving channels and scalar byte order.
pub(crate) fn transpose_bytes(source: ByteMatrix<'_>) -> Result<OwnedByteMatrix, LayoutError> {
    let output_layout = MatLayout::new(
        source.layout.columns,
        source.layout.rows,
        source.layout.channels,
        source.layout.element_width,
    )?;
    remap_pixels(source, output_layout, |row, column| (column, row))
}

/// Rotates compact matrix bytes using `OpenCV` codes: `0` clockwise, `1` half-turn, `2` counterclockwise.
pub(crate) fn rotate_bytes(
    source: ByteMatrix<'_>,
    rotate_code: i32,
) -> Result<OwnedByteMatrix, LayoutError> {
    let output_layout = match rotate_code {
        0 | 2 => MatLayout::new(
            source.layout.columns,
            source.layout.rows,
            source.layout.channels,
            source.layout.element_width,
        )?,
        1 => source.layout,
        code => return Err(LayoutError::InvalidRotateCode(code)),
    };

    remap_pixels(source, output_layout, |row, column| match rotate_code {
        0 => (source.layout.rows - column - 1, row),
        1 => (
            source.layout.rows - row - 1,
            source.layout.columns - column - 1,
        ),
        2 => (column, source.layout.columns - row - 1),
        _ => (row, column),
    })
}

/// Repeats a compact matrix by positive vertical and horizontal tile counts.
pub(crate) fn repeat_bytes(
    source: ByteMatrix<'_>,
    row_repeats: i32,
    column_repeats: i32,
) -> Result<OwnedByteMatrix, LayoutError> {
    if row_repeats <= 0 || column_repeats <= 0 {
        return Err(LayoutError::InvalidRepeatCount {
            rows: row_repeats,
            columns: column_repeats,
        });
    }
    let rows = source
        .layout
        .rows
        .checked_mul(u32::try_from(row_repeats).map_err(|_| LayoutError::SizeOverflow)?)
        .ok_or(LayoutError::SizeOverflow)?;
    let columns = source
        .layout
        .columns
        .checked_mul(u32::try_from(column_repeats).map_err(|_| LayoutError::SizeOverflow)?)
        .ok_or(LayoutError::SizeOverflow)?;
    let output_layout = MatLayout::new(
        rows,
        columns,
        source.layout.channels,
        source.layout.element_width,
    )?;

    remap_pixels(source, output_layout, |row, column| {
        (row % source.layout.rows, column % source.layout.columns)
    })
}

/// Concatenates compact matrices horizontally.
pub(crate) fn hconcat_bytes(sources: &[ByteMatrix<'_>]) -> Result<OwnedByteMatrix, LayoutError> {
    let first = *sources.first().ok_or(LayoutError::EmptySources)?;
    let mut columns = 0_u32;
    for (index, source) in sources.iter().copied().enumerate() {
        if source.layout.rows != first.layout.rows
            || source.layout.channels != first.layout.channels
            || source.layout.element_width != first.layout.element_width
        {
            return Err(LayoutError::IncompatibleSource {
                index,
                expected: first.layout,
                actual: source.layout,
            });
        }
        columns = columns
            .checked_add(source.layout.columns)
            .ok_or(LayoutError::SizeOverflow)?;
    }

    let output_layout = MatLayout::new(
        first.layout.rows,
        columns,
        first.layout.channels,
        first.layout.element_width,
    )?;
    let mut output = allocate_output(output_layout)?;
    let mut output_offset = 0;
    for row in 0..first.layout.rows {
        for source in sources.iter().copied() {
            let row_range = source_row_range(source, row)?;
            let row_bytes = source
                .bytes
                .get(row_range)
                .ok_or(LayoutError::InternalBounds)?;
            copy_at(&mut output, output_offset, row_bytes)?;
            output_offset = output_offset
                .checked_add(row_bytes.len())
                .ok_or(LayoutError::SizeOverflow)?;
        }
    }
    Ok(OwnedByteMatrix {
        bytes: output,
        layout: output_layout,
    })
}

/// Concatenates compact matrices vertically.
pub(crate) fn vconcat_bytes(sources: &[ByteMatrix<'_>]) -> Result<OwnedByteMatrix, LayoutError> {
    let first = *sources.first().ok_or(LayoutError::EmptySources)?;
    let mut rows = 0_u32;
    for (index, source) in sources.iter().copied().enumerate() {
        if source.layout.columns != first.layout.columns
            || source.layout.channels != first.layout.channels
            || source.layout.element_width != first.layout.element_width
        {
            return Err(LayoutError::IncompatibleSource {
                index,
                expected: first.layout,
                actual: source.layout,
            });
        }
        rows = rows
            .checked_add(source.layout.rows)
            .ok_or(LayoutError::SizeOverflow)?;
    }

    let output_layout = MatLayout::new(
        rows,
        first.layout.columns,
        first.layout.channels,
        first.layout.element_width,
    )?;
    let mut output = allocate_output(output_layout)?;
    let mut output_offset = 0;
    for source in sources.iter().copied() {
        copy_at(&mut output, output_offset, source.bytes)?;
        output_offset = output_offset
            .checked_add(source.bytes.len())
            .ok_or(LayoutError::SizeOverflow)?;
    }
    Ok(OwnedByteMatrix {
        bytes: output,
        layout: output_layout,
    })
}

fn remap_pixels(
    source: ByteMatrix<'_>,
    output_layout: MatLayout,
    source_position: impl Fn(u32, u32) -> (u32, u32),
) -> Result<OwnedByteMatrix, LayoutError> {
    let pixel_width = source.layout.pixel_width()?;
    let mut output = allocate_output(output_layout)?;
    for row in 0..output_layout.rows {
        for column in 0..output_layout.columns {
            let (source_row, source_column) = source_position(row, column);
            let source_offset = pixel_offset(source.layout, source_row, source_column)?;
            let output_offset = pixel_offset(output_layout, row, column)?;
            let source_end = source_offset
                .checked_add(pixel_width)
                .ok_or(LayoutError::SizeOverflow)?;
            let source_pixel = source
                .bytes
                .get(source_offset..source_end)
                .ok_or(LayoutError::InternalBounds)?;
            copy_at(&mut output, output_offset, source_pixel)?;
        }
    }
    Ok(OwnedByteMatrix {
        bytes: output,
        layout: output_layout,
    })
}

fn allocate_output(layout: MatLayout) -> Result<Vec<u8>, LayoutError> {
    let byte_length = layout.byte_length()?;
    let mut output = Vec::new();
    output
        .try_reserve_exact(byte_length)
        .map_err(|_| LayoutError::AllocationFailed)?;
    output.resize(byte_length, 0);
    Ok(output)
}

fn pixel_offset(layout: MatLayout, row: u32, column: u32) -> Result<usize, LayoutError> {
    if row >= layout.rows || column >= layout.columns {
        return Err(LayoutError::InternalBounds);
    }
    let row_offset = usize::try_from(row)
        .map_err(|_| LayoutError::SizeOverflow)?
        .checked_mul(layout.row_width()?)
        .ok_or(LayoutError::SizeOverflow)?;
    let column_offset = usize::try_from(column)
        .map_err(|_| LayoutError::SizeOverflow)?
        .checked_mul(layout.pixel_width()?)
        .ok_or(LayoutError::SizeOverflow)?;
    row_offset
        .checked_add(column_offset)
        .ok_or(LayoutError::SizeOverflow)
}

fn source_row_range(
    source: ByteMatrix<'_>,
    row: u32,
) -> Result<std::ops::Range<usize>, LayoutError> {
    let start = usize::try_from(row)
        .map_err(|_| LayoutError::SizeOverflow)?
        .checked_mul(source.layout.row_width()?)
        .ok_or(LayoutError::SizeOverflow)?;
    let end = start
        .checked_add(source.layout.row_width()?)
        .ok_or(LayoutError::SizeOverflow)?;
    Ok(start..end)
}

fn copy_at(output: &mut [u8], offset: usize, source: &[u8]) -> Result<(), LayoutError> {
    let end = offset
        .checked_add(source.len())
        .ok_or(LayoutError::SizeOverflow)?;
    let target = output
        .get_mut(offset..end)
        .ok_or(LayoutError::InternalBounds)?;
    target.copy_from_slice(source);
    Ok(())
}
