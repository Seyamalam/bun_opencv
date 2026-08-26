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

/// Computes a square matrix determinant with Gaussian elimination and partial pivoting.
///
/// The implementation works in `f64`. A row swap flips the determinant sign. Only an exactly
/// zero pivot returns zero, so a small but nonsingular determinant is not rounded away.
pub(crate) fn determinant(values: &[f64], order: usize) -> Result<f64, AlgebraError> {
    validate_shape(values.len(), order, order)?;
    validate_finite(values)?;

    let mut matrix = values.to_vec();
    let mut sign = 1.0;
    let mut product = 1.0;
    for column in 0..order {
        let pivot_row = (column..order)
            .max_by(|&left, &right| {
                matrix[left * order + column]
                    .abs()
                    .total_cmp(&matrix[right * order + column].abs())
            })
            .expect("a validated square matrix has a pivot candidate");
        let pivot = matrix[pivot_row * order + column];
        if pivot == 0.0 {
            return Ok(0.0);
        }
        if pivot_row != column {
            for index in 0..order {
                matrix.swap(column * order + index, pivot_row * order + index);
            }
            sign = -sign;
        }
        let pivot = matrix[column * order + column];
        product *= pivot;
        if !product.is_finite() {
            return Err(AlgebraError::NumericalFailure);
        }
        for row in column + 1..order {
            let factor = matrix[row * order + column] / pivot;
            for index in column + 1..order {
                matrix[row * order + index] -= factor * matrix[column * order + index];
                if !matrix[row * order + index].is_finite() {
                    return Err(AlgebraError::NumericalFailure);
                }
            }
        }
    }
    Ok(sign * product)
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
    fn determinant_rejects_non_finite_input_and_output() {
        assert_eq!(
            determinant(&[f64::NAN], 1),
            Err(AlgebraError::NonFiniteInput)
        );
        assert_eq!(
            determinant(&[f64::MAX, 0.0, 0.0, 2.0], 2),
            Err(AlgebraError::NumericalFailure)
        );
    }
}
