use std::{error::Error, fmt, sync::Arc};

use wasm_bindgen::prelude::*;

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) enum MatError {
    EmptyDimensions,
    EmptyChannels,
    BufferSizeOverflow,
    IncorrectBufferLength {
        expected: usize,
        actual: usize,
    },
    IncorrectDepth {
        expected: MatDepth,
        actual: MatDepth,
    },
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
            Self::IncorrectDepth { expected, actual } => {
                write!(
                    formatter,
                    "matrix depth is {actual:?}; expected {expected:?}"
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
    /// Signed 8-bit elements.
    I8 = 1,
    /// Unsigned 16-bit elements.
    U16 = 2,
    /// Signed 16-bit elements.
    I16 = 3,
    /// Signed 32-bit elements.
    I32 = 4,
    /// 32-bit floating-point elements.
    F32 = 5,
    /// 64-bit floating-point elements.
    F64 = 6,
}

impl MatDepth {
    pub(crate) const fn byte_width(self) -> usize {
        match self {
            Self::U8 | Self::I8 => 1,
            Self::U16 | Self::I16 => 2,
            Self::I32 | Self::F32 => 4,
            Self::F64 => 8,
        }
    }
}

trait MatElement: Copy {
    const DEPTH: MatDepth;

    fn append_ne_bytes(self, output: &mut Vec<u8>);
    fn from_ne_bytes(bytes: &[u8]) -> Self;
}

macro_rules! impl_mat_element {
    ($element:ty, $depth:ident, $width:literal) => {
        impl MatElement for $element {
            const DEPTH: MatDepth = MatDepth::$depth;

            fn append_ne_bytes(self, output: &mut Vec<u8>) {
                output.extend_from_slice(&self.to_ne_bytes());
            }

            fn from_ne_bytes(bytes: &[u8]) -> Self {
                let bytes: [u8; $width] = bytes
                    .try_into()
                    .expect("matrix byte chunks always match their scalar width");
                Self::from_ne_bytes(bytes)
            }
        }
    };
}

impl_mat_element!(u8, U8, 1);
impl_mat_element!(i8, I8, 1);
impl_mat_element!(u16, U16, 2);
impl_mat_element!(i16, I16, 2);
impl_mat_element!(i32, I32, 4);
impl_mat_element!(f32, F32, 4);
impl_mat_element!(f64, F64, 8);

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
        Self::from_typed_slice(data, rows, columns, channels)
    }

    fn from_i16_slice(
        data: &[i16],
        rows: u32,
        columns: u32,
        channels: u16,
    ) -> Result<Self, MatError> {
        Self::from_typed_slice(data, rows, columns, channels)
    }

    fn from_typed_slice<T: MatElement>(
        data: &[T],
        rows: u32,
        columns: u32,
        channels: u16,
    ) -> Result<Self, MatError> {
        let expected = checked_buffer_length(rows, columns, channels, T::DEPTH)?;
        let actual = data.len().saturating_mul(T::DEPTH.byte_width());
        if actual != expected {
            return Err(MatError::IncorrectBufferLength { expected, actual });
        }

        let mut bytes = Vec::with_capacity(expected);
        for &value in data {
            value.append_ne_bytes(&mut bytes);
        }

        Self::from_owned_bytes(bytes, rows, columns, channels, T::DEPTH)
    }

    fn zeros_u8(rows: u32, columns: u32, channels: u16) -> Result<Self, MatError> {
        Self::zeros(rows, columns, channels, MatDepth::U8)
    }

    fn zeros(rows: u32, columns: u32, channels: u16, depth: MatDepth) -> Result<Self, MatError> {
        let length = checked_buffer_length(rows, columns, channels, depth)?;
        let row_stride = checked_row_bytes(columns, channels, depth)?;
        Ok(Self {
            data: vec![0; length].into(),
            rows,
            columns,
            channels,
            depth,
            row_stride,
            offset: 0,
        })
    }

    pub(crate) fn from_owned_bytes(
        data: Vec<u8>,
        rows: u32,
        columns: u32,
        channels: u16,
        depth: MatDepth,
    ) -> Result<Self, MatError> {
        let expected = checked_buffer_length(rows, columns, channels, depth)?;
        if data.len() != expected {
            return Err(MatError::IncorrectBufferLength {
                expected,
                actual: data.len(),
            });
        }

        Ok(Self {
            data: data.into(),
            rows,
            columns,
            channels,
            depth,
            row_stride: checked_row_bytes(columns, channels, depth)?,
            offset: 0,
        })
    }

    fn logical_byte_length(&self) -> usize {
        self.rows as usize
            * self.columns as usize
            * usize::from(self.channels)
            * self.depth.byte_width()
    }

    fn row_bytes(&self) -> usize {
        self.columns as usize * usize::from(self.channels) * self.depth.byte_width()
    }

    pub(crate) fn compact_bytes(&self) -> Vec<u8> {
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

    fn compact_u8(&self) -> Vec<u8> {
        self.compact_bytes()
    }

    fn compact_i16(&self) -> Result<Vec<i16>, MatError> {
        self.compact_typed()
    }

    fn compact_typed<T: MatElement>(&self) -> Result<Vec<T>, MatError> {
        if self.depth != T::DEPTH {
            return Err(MatError::IncorrectDepth {
                expected: T::DEPTH,
                actual: self.depth,
            });
        }

        Ok(self
            .compact_bytes()
            .chunks_exact(T::DEPTH.byte_width())
            .map(T::from_ne_bytes)
            .collect())
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
        let column_offset = column as usize * usize::from(self.channels) * self.depth.byte_width();
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

    /// Copies signed 8-bit matrix elements into a compact JavaScript `Int8Array`.
    ///
    /// # Errors
    ///
    /// Returns an error when this matrix has a different element depth.
    #[wasm_bindgen(js_name = toInt8Array)]
    pub fn to_i8_array(&self) -> Result<Vec<i8>, JsError> {
        self.compact_typed().map_err(JsError::from)
    }

    /// Copies unsigned 16-bit matrix elements into a compact JavaScript `Uint16Array`.
    ///
    /// # Errors
    ///
    /// Returns an error when this matrix has a different element depth.
    #[wasm_bindgen(js_name = toUint16Array)]
    pub fn to_u16_array(&self) -> Result<Vec<u16>, JsError> {
        self.compact_typed().map_err(JsError::from)
    }

    /// Copies signed 16-bit matrix elements into a compact JavaScript `Int16Array`.
    ///
    /// # Errors
    ///
    /// Returns an error when this matrix has a different element depth.
    #[wasm_bindgen(js_name = toInt16Array)]
    pub fn to_i16_array(&self) -> Result<Vec<i16>, JsError> {
        self.compact_i16().map_err(JsError::from)
    }

    /// Copies signed 32-bit matrix elements into a compact JavaScript `Int32Array`.
    ///
    /// # Errors
    ///
    /// Returns an error when this matrix has a different element depth.
    #[wasm_bindgen(js_name = toInt32Array)]
    pub fn to_i32_array(&self) -> Result<Vec<i32>, JsError> {
        self.compact_typed().map_err(JsError::from)
    }

    /// Copies 32-bit floating-point matrix elements into a compact JavaScript `Float32Array`.
    ///
    /// # Errors
    ///
    /// Returns an error when this matrix has a different element depth.
    #[wasm_bindgen(js_name = toFloat32Array)]
    pub fn to_f32_array(&self) -> Result<Vec<f32>, JsError> {
        self.compact_typed().map_err(JsError::from)
    }

    /// Copies 64-bit floating-point matrix elements into a compact JavaScript `Float64Array`.
    ///
    /// # Errors
    ///
    /// Returns an error when this matrix has a different element depth.
    #[wasm_bindgen(js_name = toFloat64Array)]
    pub fn to_f64_array(&self) -> Result<Vec<f64>, JsError> {
        self.compact_typed().map_err(JsError::from)
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

/// Copies a signed 8-bit JavaScript buffer into Rust-owned matrix storage.
///
/// # Errors
///
/// Returns an error when shape metadata is invalid or does not match the supplied buffer.
#[wasm_bindgen(js_name = matFromI8)]
pub fn mat_from_i8(data: &[i8], rows: u32, columns: u32, channels: u16) -> Result<Mat, JsError> {
    Mat::from_typed_slice(data, rows, columns, channels).map_err(JsError::from)
}

/// Copies an unsigned 16-bit JavaScript buffer into Rust-owned matrix storage.
///
/// # Errors
///
/// Returns an error when shape metadata is invalid or does not match the supplied buffer.
#[wasm_bindgen(js_name = matFromU16)]
pub fn mat_from_u16(data: &[u16], rows: u32, columns: u32, channels: u16) -> Result<Mat, JsError> {
    Mat::from_typed_slice(data, rows, columns, channels).map_err(JsError::from)
}

/// Copies a signed 16-bit JavaScript buffer into Rust-owned matrix storage.
///
/// # Errors
///
/// Returns an error when shape metadata is invalid or does not match the supplied buffer.
#[wasm_bindgen(js_name = matFromI16)]
pub fn mat_from_i16(data: &[i16], rows: u32, columns: u32, channels: u16) -> Result<Mat, JsError> {
    Mat::from_i16_slice(data, rows, columns, channels).map_err(JsError::from)
}

/// Copies a signed 32-bit JavaScript buffer into Rust-owned matrix storage.
///
/// # Errors
///
/// Returns an error when shape metadata is invalid or does not match the supplied buffer.
#[wasm_bindgen(js_name = matFromI32)]
pub fn mat_from_i32(data: &[i32], rows: u32, columns: u32, channels: u16) -> Result<Mat, JsError> {
    Mat::from_typed_slice(data, rows, columns, channels).map_err(JsError::from)
}

/// Copies a 32-bit floating-point JavaScript buffer into Rust-owned matrix storage.
///
/// # Errors
///
/// Returns an error when shape metadata is invalid or does not match the supplied buffer.
#[wasm_bindgen(js_name = matFromF32)]
pub fn mat_from_f32(data: &[f32], rows: u32, columns: u32, channels: u16) -> Result<Mat, JsError> {
    Mat::from_typed_slice(data, rows, columns, channels).map_err(JsError::from)
}

/// Copies a 64-bit floating-point JavaScript buffer into Rust-owned matrix storage.
///
/// # Errors
///
/// Returns an error when shape metadata is invalid or does not match the supplied buffer.
#[wasm_bindgen(js_name = matFromF64)]
pub fn mat_from_f64(data: &[f64], rows: u32, columns: u32, channels: u16) -> Result<Mat, JsError> {
    Mat::from_typed_slice(data, rows, columns, channels).map_err(JsError::from)
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

/// Allocates a zero-filled signed 8-bit matrix in Rust-owned WASM memory.
///
/// # Errors
///
/// Returns an error when shape metadata is invalid or exceeds the WASM buffer limit.
#[wasm_bindgen(js_name = matZerosI8)]
pub fn mat_zeros_i8(rows: u32, columns: u32, channels: u16) -> Result<Mat, JsError> {
    Mat::zeros(rows, columns, channels, MatDepth::I8).map_err(JsError::from)
}

/// Allocates a zero-filled unsigned 16-bit matrix in Rust-owned WASM memory.
///
/// # Errors
///
/// Returns an error when shape metadata is invalid or exceeds the WASM buffer limit.
#[wasm_bindgen(js_name = matZerosU16)]
pub fn mat_zeros_u16(rows: u32, columns: u32, channels: u16) -> Result<Mat, JsError> {
    Mat::zeros(rows, columns, channels, MatDepth::U16).map_err(JsError::from)
}

/// Allocates a zero-filled signed 16-bit matrix in Rust-owned WASM memory.
///
/// # Errors
///
/// Returns an error when shape metadata is invalid or exceeds the WASM buffer limit.
#[wasm_bindgen(js_name = matZerosI16)]
pub fn mat_zeros_i16(rows: u32, columns: u32, channels: u16) -> Result<Mat, JsError> {
    Mat::zeros(rows, columns, channels, MatDepth::I16).map_err(JsError::from)
}

/// Allocates a zero-filled signed 32-bit matrix in Rust-owned WASM memory.
///
/// # Errors
///
/// Returns an error when shape metadata is invalid or exceeds the WASM buffer limit.
#[wasm_bindgen(js_name = matZerosI32)]
pub fn mat_zeros_i32(rows: u32, columns: u32, channels: u16) -> Result<Mat, JsError> {
    Mat::zeros(rows, columns, channels, MatDepth::I32).map_err(JsError::from)
}

/// Allocates a zero-filled 32-bit floating-point matrix in Rust-owned WASM memory.
///
/// # Errors
///
/// Returns an error when shape metadata is invalid or exceeds the WASM buffer limit.
#[wasm_bindgen(js_name = matZerosF32)]
pub fn mat_zeros_f32(rows: u32, columns: u32, channels: u16) -> Result<Mat, JsError> {
    Mat::zeros(rows, columns, channels, MatDepth::F32).map_err(JsError::from)
}

/// Allocates a zero-filled 64-bit floating-point matrix in Rust-owned WASM memory.
///
/// # Errors
///
/// Returns an error when shape metadata is invalid or exceeds the WASM buffer limit.
#[wasm_bindgen(js_name = matZerosF64)]
pub fn mat_zeros_f64(rows: u32, columns: u32, channels: u16) -> Result<Mat, JsError> {
    Mat::zeros(rows, columns, channels, MatDepth::F64).map_err(JsError::from)
}

fn checked_row_bytes(columns: u32, channels: u16, depth: MatDepth) -> Result<usize, MatError> {
    if columns == 0 {
        return Err(MatError::EmptyDimensions);
    }
    if channels == 0 {
        return Err(MatError::EmptyChannels);
    }

    let bytes = u64::from(columns) * u64::from(channels) * depth.byte_width() as u64;
    if bytes > u64::from(u32::MAX) {
        return Err(MatError::BufferSizeOverflow);
    }
    usize::try_from(bytes).map_err(|_| MatError::BufferSizeOverflow)
}

fn checked_buffer_length(
    rows: u32,
    columns: u32,
    channels: u16,
    depth: MatDepth,
) -> Result<usize, MatError> {
    if rows == 0 {
        return Err(MatError::EmptyDimensions);
    }
    let row_bytes = checked_row_bytes(columns, channels, depth)?;
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

    #[test]
    fn signed_16_bit_matrix_round_trips_through_a_strided_region() {
        let source = mat_from_i16(&[-300, -2, 7, 1_024, 32_000, -9], 2, 3, 1)
            .expect("valid signed 16-bit matrix");
        let region = source.roi(0, 1, 2, 2).expect("valid region");

        assert_eq!(source.depth(), MatDepth::I16);
        assert_eq!(source.row_stride(), 6);
        assert_eq!(source.byte_length(), 12);
        assert!(!region.is_continuous());
        assert_eq!(
            region.to_i16_array().expect("matching depth"),
            [-2, 7, 32_000, -9]
        );
    }

    #[test]
    fn every_scalar_depth_round_trips_exact_values() {
        let i8_matrix = mat_from_i8(&[-128, -1, 0, 127], 1, 4, 1).expect("valid i8 matrix");
        let u16_matrix = mat_from_u16(&[0, 256, 65_535], 1, 3, 1).expect("valid u16 matrix");
        let i32_matrix =
            mat_from_i32(&[i32::MIN, -1, i32::MAX], 1, 3, 1).expect("valid i32 matrix");
        let f32_matrix =
            mat_from_f32(&[-0.0, 0.5, f32::INFINITY], 1, 3, 1).expect("valid f32 matrix");
        let f64_matrix =
            mat_from_f64(&[f64::MIN, -1.25, f64::MAX], 1, 3, 1).expect("valid f64 matrix");

        assert_eq!(i8_matrix.depth(), MatDepth::I8);
        assert_eq!(u16_matrix.depth(), MatDepth::U16);
        assert_eq!(i32_matrix.depth(), MatDepth::I32);
        assert_eq!(f32_matrix.depth(), MatDepth::F32);
        assert_eq!(f64_matrix.depth(), MatDepth::F64);
        assert_eq!(
            i8_matrix.to_i8_array().expect("matching depth"),
            [-128, -1, 0, 127]
        );
        assert_eq!(
            u16_matrix.to_u16_array().expect("matching depth"),
            [0, 256, 65_535]
        );
        assert_eq!(
            i32_matrix.to_i32_array().expect("matching depth"),
            [i32::MIN, -1, i32::MAX]
        );
        assert_eq!(
            f32_matrix.to_f32_array().expect("matching depth"),
            [-0.0, 0.5, f32::INFINITY]
        );
        assert_eq!(
            f64_matrix.to_f64_array().expect("matching depth"),
            [f64::MIN, -1.25, f64::MAX]
        );
    }

    #[test]
    fn zero_factories_allocate_the_requested_typed_shape() {
        let matrices = [
            mat_zeros_i8(2, 3, 2).expect("i8 zeros"),
            mat_zeros_u16(2, 3, 2).expect("u16 zeros"),
            mat_zeros_i16(2, 3, 2).expect("i16 zeros"),
            mat_zeros_i32(2, 3, 2).expect("i32 zeros"),
            mat_zeros_f32(2, 3, 2).expect("f32 zeros"),
            mat_zeros_f64(2, 3, 2).expect("f64 zeros"),
        ];

        for matrix in matrices {
            assert_eq!(matrix.rows(), 2);
            assert_eq!(matrix.columns(), 3);
            assert_eq!(matrix.channels(), 2);
            assert_eq!(
                matrix.byte_length(),
                12 * u32::try_from(matrix.depth().byte_width()).expect("scalar width fits u32")
            );
            assert!(matrix.to_u8_array().iter().all(|&byte| byte == 0));
        }
    }
}
