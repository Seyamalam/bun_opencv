//! Dense single-channel matrix algebra over compact scalar storage.

use std::{error::Error, fmt};

/// Validation and factorization failures reported by dense algebra kernels.
#[derive(Debug, Clone, PartialEq)]
pub(crate) enum AlgebraError {
    EmptyMatrix,
    SizeOverflow,
    IncorrectElementCount { expected: usize, actual: usize },
    InvalidTolerance,
    NonFiniteInput,
    NumericalFailure,
    UnderdeterminedSystem { rows: usize, columns: usize },
}

impl fmt::Display for AlgebraError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::EmptyMatrix => formatter.write_str("matrix dimensions must be greater than zero"),
            Self::SizeOverflow => formatter.write_str("matrix dimensions exceed the WASM limit"),
            Self::IncorrectElementCount { expected, actual } => write!(
                formatter,
                "matrix contains {actual} scalar elements; expected {expected}"
            ),
            Self::InvalidTolerance => {
                formatter.write_str("factorization tolerance must be finite and nonnegative")
            }
            Self::NonFiniteInput => {
                formatter.write_str("matrix algebra requires finite scalar values")
            }
            Self::NumericalFailure => {
                formatter.write_str("matrix factorization produced a non-finite intermediate value")
            }
            Self::UnderdeterminedSystem { rows, columns } => write!(
                formatter,
                "QR solve requires rows greater than or equal to columns; received {rows}x{columns}"
            ),
        }
    }
}

impl Error for AlgebraError {}

/// Computes an F64 square matrix determinant with depth-specific OpenCV-compatible arithmetic.
pub(crate) fn determinant(values: &[f64], order: usize) -> Result<f64, AlgebraError> {
    validate_shape(values.len(), order, order)?;
    match order {
        1 => Ok(values[0]),
        2 => Ok(values[0] * values[3] - values[1] * values[2]),
        3 => Ok(determinant_3x3(
            values[0], values[1], values[2], values[3], values[4], values[5], values[6], values[7],
            values[8],
        )),
        _ => Ok(determinant_f64_elimination(values, order)),
    }
}

/// Computes an F32 square matrix determinant while retaining F32 elimination rounding.
pub(crate) fn determinant_f32(values: &[f32], order: usize) -> Result<f64, AlgebraError> {
    validate_shape(values.len(), order, order)?;
    match order {
        1 => Ok(f64::from(values[0])),
        2 => Ok(determinant_2x2_f32(values)),
        3 => Ok(determinant_3x3(
            f64::from(values[0]),
            f64::from(values[1]),
            f64::from(values[2]),
            f64::from(values[3]),
            f64::from(values[4]),
            f64::from(values[5]),
            f64::from(values[6]),
            f64::from(values[7]),
            f64::from(values[8]),
        )),
        _ => Ok(determinant_f32_elimination(values, order)),
    }
}

fn determinant_2x2_f32(values: &[f32]) -> f64 {
    f64::from(values[0]) * f64::from(values[3]) - f64::from(values[1]) * f64::from(values[2])
}

#[allow(clippy::too_many_arguments)]
fn determinant_3x3(
    a00: f64,
    a01: f64,
    a02: f64,
    a10: f64,
    a11: f64,
    a12: f64,
    a20: f64,
    a21: f64,
    a22: f64,
) -> f64 {
    a00 * (a11 * a22 - a12 * a21) - a01 * (a10 * a22 - a12 * a20) + a02 * (a10 * a21 - a11 * a20)
}

fn determinant_f64_elimination(values: &[f64], order: usize) -> f64 {
    let mut matrix = values.to_vec();
    let mut sign = 1.0;
    let mut product = 1.0;
    let cutoff = 100.0 * f64::EPSILON;
    for column in 0..order {
        let pivot_row = pivot_row_f64(&matrix, order, column);
        let candidate = matrix[pivot_row * order + column];
        if candidate.abs() < cutoff {
            return 0.0;
        }
        if pivot_row != column {
            swap_rows(&mut matrix, order, column, pivot_row);
            sign = -sign;
        }
        let pivot = matrix[column * order + column];
        product *= pivot;
        let reciprocal = -1.0 / pivot;
        for row in column + 1..order {
            let multiple = matrix[row * order + column] * reciprocal;
            for index in column + 1..order {
                matrix[row * order + index] += multiple * matrix[column * order + index];
            }
        }
    }
    sign * product
}

fn determinant_f32_elimination(values: &[f32], order: usize) -> f64 {
    let mut matrix = values.to_vec();
    let mut sign = 1.0;
    let mut product = 1.0;
    let cutoff = 10.0 * f32::EPSILON;
    for column in 0..order {
        let pivot_row = pivot_row_f32(&matrix, order, column);
        let candidate = matrix[pivot_row * order + column];
        if candidate.abs() < cutoff {
            return 0.0;
        }
        if pivot_row != column {
            swap_rows(&mut matrix, order, column, pivot_row);
            sign = -sign;
        }
        let pivot = matrix[column * order + column];
        product *= f64::from(pivot);
        let reciprocal = -1.0 / pivot;
        for row in column + 1..order {
            let multiple = matrix[row * order + column] * reciprocal;
            for index in column + 1..order {
                matrix[row * order + index] += multiple * matrix[column * order + index];
            }
        }
    }
    sign * product
}

fn pivot_row_f64(matrix: &[f64], order: usize, column: usize) -> usize {
    let mut pivot_row = column;
    let mut pivot_magnitude = matrix[column * order + column].abs();
    for row in column + 1..order {
        let magnitude = matrix[row * order + column].abs();
        if magnitude > pivot_magnitude {
            pivot_row = row;
            pivot_magnitude = magnitude;
        }
    }
    pivot_row
}

fn pivot_row_f32(matrix: &[f32], order: usize, column: usize) -> usize {
    let mut pivot_row = column;
    let mut pivot_magnitude = matrix[column * order + column].abs();
    for row in column + 1..order {
        let magnitude = matrix[row * order + column].abs();
        if magnitude > pivot_magnitude {
            pivot_row = row;
            pivot_magnitude = magnitude;
        }
    }
    pivot_row
}

fn swap_rows<T>(matrix: &mut [T], order: usize, first: usize, second: usize) {
    for column in 0..order {
        matrix.swap(first * order + column, second * order + column);
    }
}

/// Inverts a square matrix by solving one right-hand side per identity column.
///
/// The LU factorization uses partial pivoting. It treats a pivot as singular when its magnitude is
/// at most `f64::EPSILON * order * max(abs(input))`. This scale-relative rule avoids accepting
/// pivots that cannot carry useful `f64` precision without rejecting uniformly small matrices.
/// `None` reports a singular or numerically rank-deficient matrix.
pub(crate) fn invert(values: &[f64], order: usize) -> Result<Option<Vec<f64>>, AlgebraError> {
    let Some(lu) = LuFactorization::new(values, order, f64::EPSILON)? else {
        return Ok(None);
    };
    let mut output = vec![0.0; values.len()];
    let mut right_hand_side = vec![0.0; order];
    for column in 0..order {
        right_hand_side.fill(0.0);
        right_hand_side[column] = 1.0;
        let solution = lu.solve_vector(&right_hand_side)?;
        for (row, value) in solution.into_iter().enumerate() {
            output[row * order + column] = value;
        }
    }
    Ok(Some(output))
}

/// Solves `A * X = B` for a square `A` and one or more columns in `B`.
///
/// One partial-pivoted LU factorization serves every right-hand side. The singularity threshold is
/// the same scale-relative `f64` threshold used by [`invert`]. `None` means that `A` is singular or
/// numerically rank-deficient, and callers should leave an existing destination unchanged.
pub(crate) fn solve_lu(
    coefficients: &[f64],
    order: usize,
    right_hand_sides: &[f64],
    right_hand_side_columns: usize,
) -> Result<Option<Vec<f64>>, AlgebraError> {
    validate_shape(right_hand_sides.len(), order, right_hand_side_columns)?;
    validate_finite(right_hand_sides)?;
    let Some(lu) = LuFactorization::new(coefficients, order, f64::EPSILON)? else {
        return Ok(None);
    };
    let output_length = order
        .checked_mul(right_hand_side_columns)
        .ok_or(AlgebraError::SizeOverflow)?;
    let mut output = vec![0.0; output_length];
    let mut column = vec![0.0; order];
    for right_column in 0..right_hand_side_columns {
        for row in 0..order {
            column[row] = right_hand_sides[row * right_hand_side_columns + right_column];
        }
        let solution = lu.solve_vector(&column)?;
        for (row, value) in solution.into_iter().enumerate() {
            output[row * right_hand_side_columns + right_column] = value;
        }
    }
    Ok(Some(output))
}

/// Solves a square or overdetermined system with Householder QR decomposition.
///
/// For an overdetermined system this returns the least-squares solution. Householder reflectors
/// avoid forming `A^T A`, which would square the condition number. A diagonal at or below
/// `f64::EPSILON * max(rows, columns) * max(abs(A))` reports rank deficiency as `None`.
pub(crate) fn solve_qr(
    coefficients: &[f64],
    rows: usize,
    columns: usize,
    right_hand_sides: &[f64],
    right_hand_side_columns: usize,
) -> Result<Option<Vec<f64>>, AlgebraError> {
    validate_shape(coefficients.len(), rows, columns)?;
    validate_shape(right_hand_sides.len(), rows, right_hand_side_columns)?;
    validate_finite(coefficients)?;
    validate_finite(right_hand_sides)?;
    if rows < columns {
        return Err(AlgebraError::UnderdeterminedSystem { rows, columns });
    }

    let scale = coefficients
        .iter()
        .fold(0.0_f64, |largest, value| largest.max(value.abs()));
    if scale == 0.0 {
        return Ok(None);
    }
    let tolerance = scale * f64::EPSILON * dimension_as_f64(rows.max(columns));
    let mut factored = coefficients.to_vec();
    let mut transformed_rhs = right_hand_sides.to_vec();

    for column in 0..columns {
        let column_norm = (column..rows).fold(0.0_f64, |norm, row| {
            norm.hypot(factored[row * columns + column])
        });
        if column_norm <= tolerance {
            return Ok(None);
        }
        let diagonal_index = column * columns + column;
        let diagonal = factored[diagonal_index];
        let reflected_diagonal = if diagonal.is_sign_negative() {
            column_norm
        } else {
            -column_norm
        };
        let mut reflector: Vec<f64> = (column..rows)
            .map(|row| factored[row * columns + column])
            .collect();
        reflector[0] -= reflected_diagonal;
        let reflector_norm = reflector
            .iter()
            .fold(0.0_f64, |norm, value| norm.hypot(*value));
        if reflector_norm == 0.0 || !reflector_norm.is_finite() {
            return Err(AlgebraError::NumericalFailure);
        }
        for value in &mut reflector {
            *value /= reflector_norm;
        }

        for target_column in column..columns {
            let projection = (column..rows)
                .enumerate()
                .map(|(offset, row)| reflector[offset] * factored[row * columns + target_column])
                .sum::<f64>();
            for (offset, row) in (column..rows).enumerate() {
                let target = row * columns + target_column;
                factored[target] -= 2.0 * reflector[offset] * projection;
                if !factored[target].is_finite() {
                    return Err(AlgebraError::NumericalFailure);
                }
            }
        }
        for target_column in 0..right_hand_side_columns {
            let projection = (column..rows)
                .enumerate()
                .map(|(offset, row)| {
                    reflector[offset]
                        * transformed_rhs[row * right_hand_side_columns + target_column]
                })
                .sum::<f64>();
            for (offset, row) in (column..rows).enumerate() {
                let target = row * right_hand_side_columns + target_column;
                transformed_rhs[target] -= 2.0 * reflector[offset] * projection;
                if !transformed_rhs[target].is_finite() {
                    return Err(AlgebraError::NumericalFailure);
                }
            }
        }
        factored[diagonal_index] = reflected_diagonal;
        for row in column + 1..rows {
            factored[row * columns + column] = 0.0;
        }
    }

    let output_length = columns
        .checked_mul(right_hand_side_columns)
        .ok_or(AlgebraError::SizeOverflow)?;
    let mut output = vec![0.0; output_length];
    for right_column in 0..right_hand_side_columns {
        for row in (0..columns).rev() {
            let mut value = transformed_rhs[row * right_hand_side_columns + right_column];
            for column in row + 1..columns {
                value -= factored[row * columns + column]
                    * output[column * right_hand_side_columns + right_column];
            }
            value /= factored[row * columns + row];
            if !value.is_finite() {
                return Err(AlgebraError::NumericalFailure);
            }
            output[row * right_hand_side_columns + right_column] = value;
        }
    }
    Ok(Some(output))
}

/// Solves `A * X = B` for a symmetric positive-definite `A` with Cholesky decomposition.
///
/// Symmetry and positive definiteness use the same scale-relative tolerance as the other dense
/// decompositions. `None` means the input is not symmetric positive definite at that tolerance.
pub(crate) fn solve_cholesky(
    coefficients: &[f64],
    order: usize,
    right_hand_sides: &[f64],
    right_hand_side_columns: usize,
) -> Result<Option<Vec<f64>>, AlgebraError> {
    validate_shape(coefficients.len(), order, order)?;
    validate_shape(right_hand_sides.len(), order, right_hand_side_columns)?;
    validate_finite(coefficients)?;
    validate_finite(right_hand_sides)?;
    let scale = coefficients
        .iter()
        .fold(0.0_f64, |largest, value| largest.max(value.abs()));
    if scale == 0.0 {
        return Ok(None);
    }
    let tolerance = scale * f64::EPSILON * dimension_as_f64(order);
    for row in 0..order {
        for column in 0..row {
            if (coefficients[row * order + column] - coefficients[column * order + row]).abs()
                > tolerance
            {
                return Ok(None);
            }
        }
    }

    let mut lower = vec![0.0; coefficients.len()];
    for row in 0..order {
        for column in 0..=row {
            let mut value = coefficients[row * order + column];
            for index in 0..column {
                value -= lower[row * order + index] * lower[column * order + index];
            }
            if row == column {
                if value <= tolerance {
                    return Ok(None);
                }
                lower[row * order + column] = value.sqrt();
            } else {
                lower[row * order + column] = value / lower[column * order + column];
            }
            if !lower[row * order + column].is_finite() {
                return Err(AlgebraError::NumericalFailure);
            }
        }
    }

    let output_length = order
        .checked_mul(right_hand_side_columns)
        .ok_or(AlgebraError::SizeOverflow)?;
    let mut output = vec![0.0; output_length];
    let mut column = vec![0.0; order];
    for right_column in 0..right_hand_side_columns {
        for row in 0..order {
            let mut value = right_hand_sides[row * right_hand_side_columns + right_column];
            for index in 0..row {
                value -= lower[row * order + index] * column[index];
            }
            column[row] = value / lower[row * order + row];
        }
        for row in (0..order).rev() {
            let mut value = column[row];
            for index in row + 1..order {
                value -= lower[index * order + row]
                    * output[index * right_hand_side_columns + right_column];
            }
            value /= lower[row * order + row];
            if !value.is_finite() {
                return Err(AlgebraError::NumericalFailure);
            }
            output[row * right_hand_side_columns + right_column] = value;
        }
    }
    Ok(Some(output))
}

#[derive(Debug)]
struct LuFactorization {
    values: Vec<f64>,
    order: usize,
    permutation: Vec<usize>,
}

impl LuFactorization {
    fn new(
        values: &[f64],
        order: usize,
        relative_epsilon: f64,
    ) -> Result<Option<Self>, AlgebraError> {
        validate_shape(values.len(), order, order)?;
        validate_finite(values)?;
        if !relative_epsilon.is_finite() || relative_epsilon < 0.0 {
            return Err(AlgebraError::InvalidTolerance);
        }
        let scale = values
            .iter()
            .fold(0.0_f64, |largest, value| largest.max(value.abs()));
        if scale == 0.0 {
            return Ok(None);
        }
        let tolerance = scale * relative_epsilon * dimension_as_f64(order);
        let mut factored = values.to_vec();
        let mut permutation: Vec<usize> = (0..order).collect();

        for column in 0..order {
            let pivot_row = (column..order)
                .max_by(|&left, &right| {
                    factored[left * order + column]
                        .abs()
                        .total_cmp(&factored[right * order + column].abs())
                })
                .expect("a validated square matrix has a pivot candidate");
            if factored[pivot_row * order + column].abs() <= tolerance {
                return Ok(None);
            }
            if pivot_row != column {
                for index in 0..order {
                    factored.swap(column * order + index, pivot_row * order + index);
                }
                permutation.swap(column, pivot_row);
            }
            let pivot = factored[column * order + column];
            for row in column + 1..order {
                let factor_index = row * order + column;
                factored[factor_index] /= pivot;
                let factor = factored[factor_index];
                for index in column + 1..order {
                    let target = row * order + index;
                    factored[target] -= factor * factored[column * order + index];
                    if !factored[target].is_finite() {
                        return Err(AlgebraError::NumericalFailure);
                    }
                }
            }
        }
        Ok(Some(Self {
            values: factored,
            order,
            permutation,
        }))
    }

    fn solve_vector(&self, right_hand_side: &[f64]) -> Result<Vec<f64>, AlgebraError> {
        validate_shape(right_hand_side.len(), self.order, 1)?;
        validate_finite(right_hand_side)?;
        let mut solution: Vec<f64> = self
            .permutation
            .iter()
            .map(|&index| right_hand_side[index])
            .collect();

        for row in 0..self.order {
            for column in 0..row {
                solution[row] -= self.values[row * self.order + column] * solution[column];
            }
        }
        for row in (0..self.order).rev() {
            for column in row + 1..self.order {
                solution[row] -= self.values[row * self.order + column] * solution[column];
            }
            solution[row] /= self.values[row * self.order + row];
            if !solution[row].is_finite() {
                return Err(AlgebraError::NumericalFailure);
            }
        }
        Ok(solution)
    }
}

fn validate_finite(values: &[f64]) -> Result<(), AlgebraError> {
    if values.iter().all(|value| value.is_finite()) {
        Ok(())
    } else {
        Err(AlgebraError::NonFiniteInput)
    }
}

#[allow(clippy::cast_precision_loss)]
fn dimension_as_f64(value: usize) -> f64 {
    value as f64
}

fn validate_shape(actual: usize, rows: usize, columns: usize) -> Result<(), AlgebraError> {
    if rows == 0 || columns == 0 {
        return Err(AlgebraError::EmptyMatrix);
    }
    let expected = rows
        .checked_mul(columns)
        .ok_or(AlgebraError::SizeOverflow)?;
    if actual != expected {
        return Err(AlgebraError::IncorrectElementCount { expected, actual });
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn determinant_uses_partial_pivoting() {
        let matrix = [0.0, 2.0, 1.0, 1.0, 0.0, 3.0, 4.0, 5.0, 6.0];

        assert_eq!(determinant(&matrix, 3), Ok(17.0));
    }

    #[test]
    fn determinant_matches_direct_small_matrix_arithmetic() {
        assert_eq!(determinant(&[], 0), Err(AlgebraError::EmptyMatrix));

        let one = determinant(&[-0.0], 1).expect("valid 1x1 matrix");
        assert_eq!(one.to_bits(), (-0.0_f64).to_bits());

        let two = determinant(&[-0.0, 0.0, 0.0, 1.0], 2).expect("valid 2x2 matrix");
        assert_eq!(two.to_bits(), (-0.0_f64).to_bits());
        assert_eq!(determinant(&[1.0e-300, 0.0, 0.0, 1.0], 2), Ok(1.0e-300));

        let three = determinant(&[-0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0], 3)
            .expect("valid 3x3 matrix");
        assert_eq!(three.to_bits(), 0.0_f64.to_bits());

        let one_f32 = determinant_f32(&[-0.0], 1).expect("valid 1x1 matrix");
        assert_eq!(one_f32.to_bits(), (-0.0_f64).to_bits());
        let two_f32 = determinant_f32(&[-0.0, 0.0, 0.0, 1.0], 2).expect("valid 2x2 matrix");
        assert_eq!(two_f32.to_bits(), (-0.0_f64).to_bits());
        let three_f32 = determinant_f32(&[-0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0], 3)
            .expect("valid 3x3 matrix");
        assert_eq!(three_f32.to_bits(), 0.0_f64.to_bits());

        assert_eq!(
            determinant_f32(&[16_777_216.0, 16_777_215.0, 16_777_215.0, 16_777_214.0], 2),
            Ok(-1.0)
        );
    }

    #[test]
    fn determinant_f64_uses_the_opencv_absolute_pivot_cutoff_for_large_matrices() {
        let cutoff = 100.0 * f64::EPSILON;
        let diagonal = |pivot| {
            [
                pivot, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0,
            ]
        };

        let below = determinant(&diagonal(cutoff.next_down()), 4).expect("valid matrix");
        assert_eq!(below.to_bits(), 0.0_f64.to_bits());
        assert_eq!(determinant(&diagonal(cutoff), 4), Ok(cutoff));
        let negative_below = determinant(&diagonal(-cutoff.next_down()), 4).expect("valid matrix");
        assert_eq!(negative_below.to_bits(), 0.0_f64.to_bits());
        assert_eq!(determinant(&diagonal(-cutoff), 4), Ok(-cutoff));

        let swapped = [
            0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 2.0, 0.0, 0.0, 0.0, 0.0, 3.0,
        ];
        assert_eq!(determinant(&swapped, 4), Ok(-6.0));

        let singular = [
            1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 1.0,
        ];
        let value = determinant(&singular, 4).expect("valid matrix");
        assert_eq!(value.to_bits(), 0.0_f64.to_bits());
    }

    #[test]
    fn determinant_f32_keeps_float_elimination_rounding() {
        let cutoff = 10.0 * f32::EPSILON;
        let diagonal = |pivot| {
            [
                pivot, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0,
            ]
        };
        let below = determinant_f32(&diagonal(f32::from_bits(cutoff.to_bits() - 1)), 4)
            .expect("valid matrix");
        assert_eq!(below.to_bits(), 0.0_f64.to_bits());
        assert_eq!(determinant_f32(&diagonal(cutoff), 4), Ok(f64::from(cutoff)));
        let negative_below = determinant_f32(&diagonal(-f32::from_bits(cutoff.to_bits() - 1)), 4)
            .expect("valid matrix");
        assert_eq!(negative_below.to_bits(), 0.0_f64.to_bits());
        assert_eq!(
            determinant_f32(&diagonal(-cutoff), 4),
            Ok(-f64::from(cutoff))
        );

        let hilbert4 = [
            1.0_f32,
            1.0 / 2.0,
            1.0 / 3.0,
            1.0 / 4.0,
            1.0 / 2.0,
            1.0 / 3.0,
            1.0 / 4.0,
            1.0 / 5.0,
            1.0 / 3.0,
            1.0 / 4.0,
            1.0 / 5.0,
            1.0 / 6.0,
            1.0 / 4.0,
            1.0 / 5.0,
            1.0 / 6.0,
            1.0 / 7.0,
        ];
        assert_eq!(
            determinant_f32(&hilbert4, 4),
            Ok(1.653_435_457_709_787_2e-7)
        );

        let hilbert6 = std::array::from_fn::<_, 36, _>(|index| {
            let row = index / 6;
            let column = index % 6;
            let denominator = u8::try_from(row + column + 1).expect("Hilbert index fits in u8");
            1.0_f32 / f32::from(denominator)
        });
        let rounded_singular = determinant_f32(&hilbert6, 6).expect("valid matrix");
        assert_eq!(rounded_singular.to_bits(), 0.0_f64.to_bits());
    }

    #[test]
    fn inverse_solves_each_identity_column() {
        let inverse = invert(&[4.0, 7.0, 2.0, 6.0], 2)
            .expect("valid shape")
            .expect("invertible");
        let expected = [0.6, -0.7, -0.2, 0.4];

        for (actual, expected) in inverse.iter().zip(expected) {
            assert!(
                (actual - expected).abs() <= 1.0e-14,
                "{actual} != {expected}"
            );
        }
    }

    #[test]
    fn solve_lu_handles_multiple_right_hand_sides() {
        let coefficients = [3.0, 1.0, -1.0, 2.0, 4.0, 1.0, -1.0, 2.0, 5.0];
        let right_hand_sides = [1.0, 4.0, 19.0, 26.0, 30.0, 36.0];

        let solution = solve_lu(&coefficients, 3, &right_hand_sides, 2)
            .expect("valid shapes")
            .expect("nonsingular");
        let expected = [1.0, 2.0, 3.0, 4.0, 5.0, 6.0];
        for (actual, expected) in solution.iter().zip(expected) {
            assert!(
                (actual - expected).abs() <= 1.0e-13,
                "{actual} != {expected}"
            );
        }
    }

    #[test]
    fn solve_qr_finds_a_rectangular_least_squares_solution() {
        let coefficients = [1.0, 0.0, 1.0, 1.0, 1.0, 2.0];
        let right_hand_side = [1.0, 2.0, 2.0];

        let solution = solve_qr(&coefficients, 3, 2, &right_hand_side, 1)
            .expect("valid shapes")
            .expect("full column rank");
        assert!((solution[0] - 7.0 / 6.0).abs() <= 1.0e-14);
        assert!((solution[1] - 0.5).abs() <= 1.0e-14);
    }

    #[test]
    fn solve_cholesky_handles_spd_coefficients_and_multiple_rhs_columns() {
        let coefficients = [4.0, 2.0, 2.0, 3.0];
        let right_hand_sides = [6.0, 2.0, 5.0, 1.0];

        let solution = solve_cholesky(&coefficients, 2, &right_hand_sides, 2)
            .expect("valid shapes")
            .expect("positive definite");
        let expected = [1.0, 0.5, 1.0, 0.0];
        for (actual, expected) in solution.iter().zip(expected) {
            assert!(
                (actual - expected).abs() <= 1.0e-14,
                "{actual} != {expected}"
            );
        }
    }

    #[test]
    fn determinant_propagates_non_finite_values() {
        assert!(
            determinant(&[f64::NAN], 1)
                .expect("non-finite values are accepted")
                .is_nan()
        );
        assert_eq!(
            determinant(&[f64::MAX, 0.0, 0.0, 2.0], 2),
            Ok(f64::INFINITY)
        );
        assert!(
            determinant(&[f64::INFINITY, 0.0, 0.0, 0.0], 2)
                .expect("non-finite values are accepted")
                .is_nan()
        );

        let diagonal_infinity = [
            f64::INFINITY,
            0.0,
            0.0,
            0.0,
            0.0,
            1.0,
            0.0,
            0.0,
            0.0,
            0.0,
            1.0,
            0.0,
            0.0,
            0.0,
            0.0,
            1.0,
        ];
        assert_eq!(determinant(&diagonal_infinity, 4), Ok(f64::INFINITY));

        let mut diagonal_nan = diagonal_infinity;
        diagonal_nan[0] = f64::NAN;
        assert!(
            determinant(&diagonal_nan, 4)
                .expect("non-finite values are accepted")
                .is_nan()
        );

        let diagonal_infinity_f32 = [
            f32::INFINITY,
            0.0,
            0.0,
            0.0,
            0.0,
            1.0,
            0.0,
            0.0,
            0.0,
            0.0,
            1.0,
            0.0,
            0.0,
            0.0,
            0.0,
            1.0,
        ];
        assert_eq!(
            determinant_f32(&diagonal_infinity_f32, 4),
            Ok(f64::INFINITY)
        );
    }
}
