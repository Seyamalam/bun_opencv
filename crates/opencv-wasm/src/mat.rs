use std::{error::Error, fmt, sync::Arc};

use wasm_bindgen::prelude::*;

#[derive(Debug, Clone, PartialEq, Eq)]
enum MatError {
    EmptyDimensions,
    EmptyChannels,
    BufferSizeOverflow,
    IncorrectBufferLength { expected: usize, actual: usize },
    RegionOutOfBounds,
}

impl fmt::Display for MatError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::EmptyDimensions => {
                formatter.write_str("matrix dimensions must be greater than zero")
            }
            Self::EmptyChannels => formatter.write_str("matrix channels must be greater than zero"),
            Self::BufferSizeOverflow => {
                formatter.write_str("matrix dimensions exceed the WASM buffer limit")
            }
            Self::IncorrectBufferLength { expected, actual } => {
                write!(
                    formatter,
                    "matrix buffer has {actual} bytes; expected {expected} bytes"
                )
            }
            Self::RegionOutOfBounds => {
                formatter.write_str("matrix region extends outside its parent")
            }
        }
    }
}

impl Error for MatError {}

/// Element storage depth for a matrix.
#[wasm_bindgen]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MatDepth {
    /// Unsigned 8-bit elements.
    U8 = 0,
}

/// Rust-owned matrix storage shared by zero-copy regions of interest.
#[wasm_bindgen]
#[derive(Debug, Clone)]
pub struct Mat {
    data: Arc<[u8]>,
    rows: u32,
    columns: u32,
    channels: u16,
    depth: MatDepth,
    row_stride: usize,
    offset: usize,
}

impl Mat {
    fn from_u8_slice(
        data: &[u8],
        rows: u32,
        columns: u32,
        channels: u16,
    ) -> Result<Self, MatError> {
        let expected = checked_u8_length(rows, columns, channels)?;
        if data.len() != expected {
            return Err(MatError::IncorrectBufferLength {
                expected,
                actual: data.len(),
            });
        }

        let row_stride = checked_row_bytes(columns, channels)?;
        Ok(Self {
            data: Arc::from(data),
            rows,
            columns,
            channels,
            depth: MatDepth::U8,
            row_stride,
            offset: 0,
        })
    }

    fn zeros_u8(rows: u32, columns: u32, channels: u16) -> Result<Self, MatError> {
        let length = checked_u8_length(rows, columns, channels)?;
        let row_stride = checked_row_bytes(columns, channels)?;
        Ok(Self {
            data: vec![0; length].into(),
            rows,
            columns,
            channels,
            depth: MatDepth::U8,
            row_stride,
            offset: 0,
        })
    }

    fn logical_byte_length(&self) -> usize {
        self.rows as usize * self.columns as usize * usize::from(self.channels)
    }

    fn row_bytes(&self) -> usize {
        self.columns as usize * usize::from(self.channels)
    }

    fn compact_u8(&self) -> Vec<u8> {
        if self.is_continuous_storage() {
            let end = self.offset + self.logical_byte_length();
            return self.data[self.offset..end].to_vec();
        }

        let row_bytes = self.row_bytes();
        let mut output = Vec::with_capacity(self.logical_byte_length());
        for row in 0..self.rows as usize {
            let start = self.offset + row * self.row_stride;
            output.extend_from_slice(&self.data[start..start + row_bytes]);
        }
        output
    }

    fn region(&self, row: u32, column: u32, rows: u32, columns: u32) -> Result<Self, MatError> {
        if rows == 0 || columns == 0 {
            return Err(MatError::EmptyDimensions);
        }

        let row_end = row.checked_add(rows).ok_or(MatError::RegionOutOfBounds)?;
        let column_end = column
            .checked_add(columns)
            .ok_or(MatError::RegionOutOfBounds)?;
        if row_end > self.rows || column_end > self.columns {
            return Err(MatError::RegionOutOfBounds);
        }

        let row_offset = row as usize * self.row_stride;
        let column_offset = column as usize * usize::from(self.channels);
        let offset = self
            .offset
            .checked_add(row_offset)
            .and_then(|value| value.checked_add(column_offset))
            .ok_or(MatError::BufferSizeOverflow)?;

        Ok(Self {
            data: Arc::clone(&self.data),
            rows,
            columns,
            channels: self.channels,
            depth: self.depth,
            row_stride: self.row_stride,
            offset,
        })
    }

    fn is_continuous_storage(&self) -> bool {
        self.rows <= 1 || self.row_stride == self.row_bytes()
    }
}

#[wasm_bindgen]
impl Mat {
    /// Returns the number of rows.
    #[must_use]
    #[wasm_bindgen(getter)]
    pub fn rows(&self) -> u32 {
        self.rows
    }

    /// Returns the number of columns.
    #[must_use]
    #[wasm_bindgen(getter)]
    pub fn columns(&self) -> u32 {
        self.columns
    }

    /// Returns the number of interleaved channels.
    #[must_use]
    #[wasm_bindgen(getter)]
    pub fn channels(&self) -> u16 {
        self.channels
    }

    /// Returns the element depth.
    #[must_use]
    #[wasm_bindgen(getter)]
    pub fn depth(&self) -> MatDepth {
        self.depth
    }

    /// Returns the byte distance between the start of adjacent rows.
    #[must_use]
    #[wasm_bindgen(getter, js_name = rowStride)]
    pub fn row_stride(&self) -> u32 {
        u32::try_from(self.row_stride).unwrap_or(u32::MAX)
    }

    /// Returns the logical byte length without padding between rows.
    #[must_use]
    #[wasm_bindgen(getter, js_name = byteLength)]
    pub fn byte_length(&self) -> u32 {
        u32::try_from(self.logical_byte_length()).unwrap_or(u32::MAX)
    }

    /// Returns whether all logical bytes occupy one contiguous range.
    #[must_use]
    #[wasm_bindgen(getter, js_name = isContinuous)]
    pub fn is_continuous(&self) -> bool {
        self.is_continuous_storage()
    }

    /// Creates a region that shares its parent's Rust allocation without copying pixels.
    ///
    /// # Errors
    ///
    /// Returns an error when dimensions are zero or the requested region lies outside the parent.
    #[wasm_bindgen(js_name = roi)]
    pub fn roi(&self, row: u32, column: u32, rows: u32, columns: u32) -> Result<Self, JsError> {
        self.region(row, column, rows, columns)
            .map_err(JsError::from)
    }

    /// Copies logical matrix bytes into a compact JavaScript `Uint8Array`.
    #[must_use]
    #[wasm_bindgen(js_name = toUint8Array)]
    pub fn to_u8_array(&self) -> Vec<u8> {
        self.compact_u8()
    }
}

/// Copies an unsigned 8-bit JavaScript buffer into Rust-owned matrix storage.
///
/// # Errors
///
/// Returns an error when dimensions or channels are zero, the allocation exceeds the WASM buffer
/// limit, or the supplied byte length does not match the matrix metadata.
#[wasm_bindgen(js_name = matFromU8)]
pub fn mat_from_u8(data: &[u8], rows: u32, columns: u32, channels: u16) -> Result<Mat, JsError> {
    Mat::from_u8_slice(data, rows, columns, channels).map_err(JsError::from)
}

/// Allocates a zero-filled unsigned 8-bit matrix in Rust-owned WASM memory.
///
/// # Errors
///
/// Returns an error when dimensions or channels are zero or the allocation exceeds the WASM buffer
/// limit.
#[wasm_bindgen(js_name = matZerosU8)]
pub fn mat_zeros_u8(rows: u32, columns: u32, channels: u16) -> Result<Mat, JsError> {
    Mat::zeros_u8(rows, columns, channels).map_err(JsError::from)
}

fn checked_row_bytes(columns: u32, channels: u16) -> Result<usize, MatError> {
    if columns == 0 {
        return Err(MatError::EmptyDimensions);
    }
    if channels == 0 {
        return Err(MatError::EmptyChannels);
    }

    let bytes = u64::from(columns) * u64::from(channels);
    if bytes > u64::from(u32::MAX) {
        return Err(MatError::BufferSizeOverflow);
    }
    usize::try_from(bytes).map_err(|_| MatError::BufferSizeOverflow)
}

fn checked_u8_length(rows: u32, columns: u32, channels: u16) -> Result<usize, MatError> {
    if rows == 0 {
        return Err(MatError::EmptyDimensions);
    }
    let row_bytes = checked_row_bytes(columns, channels)?;
    let bytes = u64::from(rows) * row_bytes as u64;
    if bytes > u64::from(u32::MAX) {
        return Err(MatError::BufferSizeOverflow);
    }
    usize::try_from(bytes).map_err(|_| MatError::BufferSizeOverflow)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn matrix_validates_its_buffer_length() {
        let error = Mat::from_u8_slice(&[1, 2, 3], 1, 1, 4).expect_err("short input must fail");
        assert_eq!(
            error,
            MatError::IncorrectBufferLength {
                expected: 4,
                actual: 3,
            }
        );
    }

    #[test]
    fn zero_matrix_allocates_in_rust() {
        let matrix = Mat::zeros_u8(2, 3, 4).expect("valid matrix");
        assert_eq!(matrix.logical_byte_length(), 24);
        assert_eq!(matrix.compact_u8(), vec![0; 24]);
    }

    #[test]
    fn region_shares_storage_and_compacts_strided_rows() {
        let source = Mat::from_u8_slice(&[1, 2, 3, 4, 5, 6, 7, 8], 2, 4, 1).expect("valid matrix");
        let region = source.region(0, 1, 2, 2).expect("valid region");

        assert!(Arc::ptr_eq(&source.data, &region.data));
        assert!(!region.is_continuous_storage());
        assert_eq!(region.compact_u8(), [2, 3, 6, 7]);
    }

    #[test]
    fn one_row_region_is_continuous() {
        let source = Mat::from_u8_slice(&[1, 2, 3, 4], 1, 4, 1).expect("valid matrix");
        let region = source.region(0, 1, 1, 2).expect("valid region");
        assert!(region.is_continuous_storage());
        assert_eq!(region.compact_u8(), [2, 3]);
    }

    #[test]
    fn out_of_bounds_region_is_rejected() {
        let source = Mat::zeros_u8(2, 2, 1).expect("valid matrix");
        let error = source
            .region(1, 1, 2, 1)
            .expect_err("invalid region must fail");
        assert_eq!(error, MatError::RegionOutOfBounds);
    }
}
