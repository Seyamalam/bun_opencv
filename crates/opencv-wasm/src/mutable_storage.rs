use std::{cell::RefCell, error::Error, fmt, rc::Rc};

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) enum MutableStorageError {
    EmptyDimensions,
    SizeOverflow,
    IncorrectBufferLength { expected: usize, actual: usize },
    RegionOutOfBounds,
}

impl fmt::Display for MutableStorageError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::EmptyDimensions => formatter.write_str("storage dimensions must be nonzero"),
            Self::SizeOverflow => {
                formatter.write_str("storage dimensions exceed addressable memory")
            }
            Self::IncorrectBufferLength { expected, actual } => write!(
                formatter,
                "storage buffer has {actual} bytes; expected {expected} bytes"
            ),
            Self::RegionOutOfBounds => {
                formatter.write_str("storage region extends outside its parent")
            }
        }
    }
}

impl Error for MutableStorageError {}

/// Mutable byte storage shared by a matrix and each of its ROI views.
///
/// This module assumes the browser's normal single-JavaScript-agent execution model. `Rc` and
/// `RefCell` keep mutation safe without atomics or `unsafe` Rust. The type is intentionally neither
/// `Send` nor `Sync`; a future threaded WASM adapter can replace the private owner with synchronized
/// storage without changing this interface.
#[derive(Debug, Clone)]
pub(crate) struct MutableStorage {
    data: Rc<RefCell<Vec<u8>>>,
    rows: usize,
    row_bytes: usize,
    row_stride: usize,
    offset: usize,
}

impl MutableStorage {
    pub(crate) fn from_compact(
        data: Vec<u8>,
        rows: usize,
        row_bytes: usize,
    ) -> Result<Self, MutableStorageError> {
        let expected = checked_area(rows, row_bytes)?;
        if data.len() != expected {
            return Err(MutableStorageError::IncorrectBufferLength {
                expected,
                actual: data.len(),
            });
        }

        Ok(Self {
            data: Rc::new(RefCell::new(data)),
            rows,
            row_bytes,
            row_stride: row_bytes,
            offset: 0,
        })
    }

    pub(crate) fn region(
        &self,
        row: usize,
        byte_column: usize,
        rows: usize,
        row_bytes: usize,
    ) -> Result<Self, MutableStorageError> {
        checked_area(rows, row_bytes)?;
        let row_end = row
            .checked_add(rows)
            .ok_or(MutableStorageError::RegionOutOfBounds)?;
        let column_end = byte_column
            .checked_add(row_bytes)
            .ok_or(MutableStorageError::RegionOutOfBounds)?;
        if row_end > self.rows || column_end > self.row_bytes {
            return Err(MutableStorageError::RegionOutOfBounds);
        }

        let row_offset = row
            .checked_mul(self.row_stride)
            .ok_or(MutableStorageError::RegionOutOfBounds)?;
        let offset = self
            .offset
            .checked_add(row_offset)
            .and_then(|value| value.checked_add(byte_column))
            .ok_or(MutableStorageError::RegionOutOfBounds)?;

        Ok(Self {
            data: Rc::clone(&self.data),
            rows,
            row_bytes,
            row_stride: self.row_stride,
            offset,
        })
    }

    pub(crate) fn compact_bytes(&self) -> Vec<u8> {
        let data = self.data.borrow();
        if self.row_bytes == self.row_stride {
            let length = self
                .rows
                .checked_mul(self.row_bytes)
                .expect("validated storage dimensions remain valid");
            return data[self.offset..self.offset + length].to_vec();
        }

        let mut output = Vec::with_capacity(
            self.rows
                .checked_mul(self.row_bytes)
                .expect("validated storage dimensions remain valid"),
        );
        for row in 0..self.rows {
            let start = self.offset + row * self.row_stride;
            output.extend_from_slice(&data[start..start + self.row_bytes]);
        }
        output
    }

    pub(crate) const fn row_stride(&self) -> usize {
        self.row_stride
    }

    pub(crate) const fn is_continuous(&self) -> bool {
        self.rows <= 1 || self.row_bytes == self.row_stride
    }

    pub(crate) fn write_from_compact(&self, source: &[u8]) -> Result<(), MutableStorageError> {
        let expected = checked_area(self.rows, self.row_bytes)?;
        if source.len() != expected {
            return Err(MutableStorageError::IncorrectBufferLength {
                expected,
                actual: source.len(),
            });
        }

        let mut data = self.data.borrow_mut();
        for row in 0..self.rows {
            let source_start = row * self.row_bytes;
            let destination_start = self.offset + row * self.row_stride;
            data[destination_start..destination_start + self.row_bytes]
                .copy_from_slice(&source[source_start..source_start + self.row_bytes]);
        }
        Ok(())
    }
}

fn checked_area(rows: usize, row_bytes: usize) -> Result<usize, MutableStorageError> {
    if rows == 0 || row_bytes == 0 {
        return Err(MutableStorageError::EmptyDimensions);
    }
    rows.checked_mul(row_bytes)
        .ok_or(MutableStorageError::SizeOverflow)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn destination_write_updates_parent_and_overlapping_views() {
        let parent = MutableStorage::from_compact(
            vec![
                1, 2, 3, 4, // row 0
                5, 6, 7, 8, // row 1
                9, 10, 11, 12, // row 2
            ],
            3,
            4,
        )
        .expect("valid parent storage");
        let destination = parent.region(0, 1, 2, 2).expect("valid destination region");
        let overlapping = parent.region(1, 0, 2, 3).expect("valid overlapping region");

        destination
            .write_from_compact(&[20, 21, 22, 23])
            .expect("source matches destination shape");

        assert_eq!(
            parent.compact_bytes(),
            vec![1, 20, 21, 4, 5, 22, 23, 8, 9, 10, 11, 12]
        );
        assert_eq!(overlapping.compact_bytes(), vec![5, 22, 23, 9, 10, 11]);
    }

    #[test]
    fn rejected_write_leaves_destination_unchanged() {
        let destination = MutableStorage::from_compact(vec![1, 2, 3, 4], 2, 2)
            .expect("valid destination storage");

        let error = destination
            .write_from_compact(&[9, 8, 7])
            .expect_err("short sources must be rejected");

        assert_eq!(
            error,
            MutableStorageError::IncorrectBufferLength {
                expected: 4,
                actual: 3,
            }
        );
        assert_eq!(destination.compact_bytes(), vec![1, 2, 3, 4]);
    }

    #[test]
    fn nested_region_keeps_parent_stride_after_parent_is_dropped() {
        let nested = {
            let parent = MutableStorage::from_compact(
                vec![
                    1, 2, 3, 4, 5, // row 0
                    6, 7, 8, 9, 10, // row 1
                    11, 12, 13, 14, 15, // row 2
                ],
                3,
                5,
            )
            .expect("valid parent storage");
            parent
                .region(1, 1, 2, 4)
                .expect("valid first region")
                .region(0, 1, 2, 2)
                .expect("valid nested region")
        };

        nested
            .write_from_compact(&[80, 90, 120, 130])
            .expect("valid compact source");

        assert_eq!(nested.compact_bytes(), vec![80, 90, 120, 130]);
    }

    #[test]
    fn constructor_and_region_reject_invalid_geometry() {
        assert_eq!(
            MutableStorage::from_compact(Vec::new(), 0, 2).expect_err("zero rows must be rejected"),
            MutableStorageError::EmptyDimensions
        );

        let parent = MutableStorage::from_compact(vec![0; 12], 3, 4).expect("valid parent storage");
        assert_eq!(
            parent
                .region(2, 0, 2, 1)
                .expect_err("row range must stay inside parent"),
            MutableStorageError::RegionOutOfBounds
        );
        assert_eq!(
            parent
                .region(0, 3, 1, 2)
                .expect_err("byte range must stay inside parent"),
            MutableStorageError::RegionOutOfBounds
        );
        assert_eq!(
            parent
                .region(0, 0, usize::MAX, 1)
                .expect_err("overflowing row range must be rejected"),
            MutableStorageError::RegionOutOfBounds
        );
    }
}
