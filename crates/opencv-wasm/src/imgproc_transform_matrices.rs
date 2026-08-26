//! Small image-transform matrix construction kernels.

use std::{error::Error, fmt};

/// Failures reported while constructing an image-transform matrix.
#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) enum TransformMatrixError {
    NonFiniteInput,
    DegenerateGeometry,
    NumericalFailure,
}

impl fmt::Display for TransformMatrixError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::NonFiniteInput => {
                formatter.write_str("transform matrix inputs must contain only finite values")
            }
            Self::DegenerateGeometry => formatter
                .write_str("transform matrix cannot be determined from degenerate input geometry"),
            Self::NumericalFailure => formatter
                .write_str("transform matrix calculation produced a non-finite intermediate value"),
        }
    }
}

impl Error for TransformMatrixError {}

/// Builds a 2-by-3 matrix that rotates around `center` in degrees and applies `scale`.
pub(crate) fn rotation_matrix_2d(
    center: [f64; 2],
    angle_degrees: f64,
    scale: f64,
) -> Result<[f64; 6], TransformMatrixError> {
    validate_finite(center.into_iter().chain([angle_degrees, scale]))?;
    let angle_radians = angle_degrees.to_radians();
    let alpha = scale * angle_radians.cos();
    let beta = scale * angle_radians.sin();
    let [center_x, center_y] = center;
    let matrix = [
        alpha,
        beta,
        (1.0 - alpha).mul_add(center_x, -beta * center_y),
        -beta,
        alpha,
        beta.mul_add(center_x, (1.0 - alpha) * center_y),
    ];
    validate_result(&matrix)?;
    Ok(matrix)
}

/// Finds the 2-by-3 affine map between three point correspondences.
pub(crate) fn affine_transform(
    source: &[[f64; 2]; 3],
    destination: &[[f64; 2]; 3],
) -> Result<[f64; 6], TransformMatrixError> {
    validate_points(source)?;
    validate_points(destination)?;
    let coefficients = source.map(|[x, y]| [x, y, 1.0]);
    let destination_x = destination.map(|[x, _]| x);
    let destination_y = destination.map(|[_, y]| y);
    let first_row = solve_linear(coefficients, destination_x)?;
    let second_row = solve_linear(coefficients, destination_y)?;
    let result = [
        first_row[0],
        first_row[1],
        first_row[2],
        second_row[0],
        second_row[1],
        second_row[2],
    ];
    validate_result(&result)?;
    Ok(result)
}

/// Inverts a finite, nonsingular 2-by-3 affine matrix.
pub(crate) fn invert_affine_transform(
    transform: &[f64; 6],
) -> Result<[f64; 6], TransformMatrixError> {
    validate_finite(transform.iter().copied())?;
    let [a, b, translation_x, d, e, translation_y] = *transform;
    let scale = [a, b, d, e]
        .into_iter()
        .fold(0.0_f64, |largest, value| largest.max(value.abs()));
    if scale == 0.0 {
        return Err(TransformMatrixError::DegenerateGeometry);
    }
    let normalized_a = a / scale;
    let normalized_b = b / scale;
    let normalized_d = d / scale;
    let normalized_e = e / scale;
    let normalized_determinant = normalized_a.mul_add(normalized_e, -normalized_b * normalized_d);
    if normalized_determinant.abs() <= f64::EPSILON * 8.0 {
        return Err(TransformMatrixError::DegenerateGeometry);
    }
    let denominator = scale * normalized_determinant;
    let inverse_a = normalized_e / denominator;
    let inverse_b = -normalized_b / denominator;
    let inverse_d = -normalized_d / denominator;
    let inverse_e = normalized_a / denominator;
    let result = [
        inverse_a,
        inverse_b,
        (-inverse_a).mul_add(translation_x, -inverse_b * translation_y),
        inverse_d,
        inverse_e,
        (-inverse_d).mul_add(translation_x, -inverse_e * translation_y),
    ];
    validate_result(&result)?;
    Ok(result)
}

/// Finds a 3-by-3 projective map between four point correspondences.
///
/// This partial implementation fixes the lower-right coefficient to one and uses scaled partial
/// pivoting. It rejects correspondences that need a projective matrix with a zero lower-right
/// coefficient.
pub(crate) fn perspective_transform(
    source: &[[f64; 2]; 4],
    destination: &[[f64; 2]; 4],
) -> Result<[f64; 9], TransformMatrixError> {
    validate_points(source)?;
    validate_points(destination)?;
    let mut coefficients = [[0.0; 8]; 8];
    let mut right_hand_side = [0.0; 8];
    for (index, (&[source_x, source_y], &[destination_x, destination_y])) in
        source.iter().zip(destination).enumerate()
    {
        let x_row = index * 2;
        coefficients[x_row] = [
            source_x,
            source_y,
            1.0,
            0.0,
            0.0,
            0.0,
            -destination_x * source_x,
            -destination_x * source_y,
        ];
        right_hand_side[x_row] = destination_x;

        let y_row = x_row + 1;
        coefficients[y_row] = [
            0.0,
            0.0,
            0.0,
            source_x,
            source_y,
            1.0,
            -destination_y * source_x,
            -destination_y * source_y,
        ];
        right_hand_side[y_row] = destination_y;
    }
    let solution = solve_linear(coefficients, right_hand_side)?;
    let result = [
        solution[0],
        solution[1],
        solution[2],
        solution[3],
        solution[4],
        solution[5],
        solution[6],
        solution[7],
        1.0,
    ];
    validate_result(&result)?;
    Ok(result)
}

fn solve_linear<const ORDER: usize>(
    mut coefficients: [[f64; ORDER]; ORDER],
    mut right_hand_side: [f64; ORDER],
) -> Result<[f64; ORDER], TransformMatrixError> {
    let mut row_scales = coefficients.map(|row| {
        row.into_iter()
            .fold(0.0_f64, |largest, value| largest.max(value.abs()))
    });
    let tolerance = f64::EPSILON
        * f64::from(u32::try_from(ORDER).map_err(|_| TransformMatrixError::NumericalFailure)?)
        * 8.0;

    for column in 0..ORDER {
        let pivot_row = (column..ORDER)
            .filter(|&row| row_scales[row] > 0.0)
            .max_by(|&left, &right| {
                let left_ratio = coefficients[left][column].abs() / row_scales[left];
                let right_ratio = coefficients[right][column].abs() / row_scales[right];
                left_ratio.total_cmp(&right_ratio)
            })
            .ok_or(TransformMatrixError::DegenerateGeometry)?;
        if coefficients[pivot_row][column].abs() <= tolerance * row_scales[pivot_row] {
            return Err(TransformMatrixError::DegenerateGeometry);
        }
        if pivot_row != column {
            coefficients.swap(column, pivot_row);
            right_hand_side.swap(column, pivot_row);
            row_scales.swap(column, pivot_row);
        }

        let pivot = coefficients[column][column];
        let pivot_coefficients = coefficients[column];
        for row in column + 1..ORDER {
            let factor = coefficients[row][column] / pivot;
            coefficients[row][column] = 0.0;
            for (target, pivot_target) in coefficients[row][column + 1..]
                .iter_mut()
                .zip(&pivot_coefficients[column + 1..])
            {
                *target = factor.mul_add(-pivot_target, *target);
            }
            right_hand_side[row] = factor.mul_add(-right_hand_side[column], right_hand_side[row]);
        }
    }

    let mut solution = [0.0; ORDER];
    for row in (0..ORDER).rev() {
        let known = (row + 1..ORDER)
            .map(|column| coefficients[row][column] * solution[column])
            .sum::<f64>();
        solution[row] = (right_hand_side[row] - known) / coefficients[row][row];
    }
    validate_result(&solution)?;
    Ok(solution)
}

fn validate_points<const COUNT: usize>(
    points: &[[f64; 2]; COUNT],
) -> Result<(), TransformMatrixError> {
    validate_finite(points.iter().flatten().copied())
}

fn validate_finite(values: impl IntoIterator<Item = f64>) -> Result<(), TransformMatrixError> {
    if values.into_iter().all(f64::is_finite) {
        Ok(())
    } else {
        Err(TransformMatrixError::NonFiniteInput)
    }
}

fn validate_result(values: &[f64]) -> Result<(), TransformMatrixError> {
    if values.iter().all(|value| value.is_finite()) {
        Ok(())
    } else {
        Err(TransformMatrixError::NumericalFailure)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn assert_close(actual: &[f64], expected: &[f64], tolerance: f64) {
        assert_eq!(actual.len(), expected.len());
        for (index, (&actual, &expected)) in actual.iter().zip(expected).enumerate() {
            assert!(
                (actual - expected).abs() <= tolerance,
                "value {index} was {actual}, expected {expected}"
            );
        }
    }

    #[test]
    fn rotation_keeps_the_center_fixed_while_scaling() {
        let matrix = rotation_matrix_2d([10.0, 20.0], 90.0, 2.0).expect("finite rotation");
        assert_close(&matrix, &[0.0, 2.0, -30.0, -2.0, 0.0, 40.0], 1.0e-12);
    }

    #[test]
    fn three_point_correspondences_determine_an_affine_matrix() {
        let source = [[0.0, 0.0], [1.0, 0.0], [0.0, 1.0]];
        let destination = [[2.0, 3.0], [4.0, 4.0], [1.0, 6.0]];

        let matrix = affine_transform(&source, &destination).expect("independent points");

        assert_close(&matrix, &[2.0, -1.0, 2.0, 1.0, 3.0, 3.0], 1.0e-14);
    }

    #[test]
    fn affine_inverse_undoes_scale_and_translation() {
        let inverse = invert_affine_transform(&[2.0, 0.0, 4.0, 0.0, 3.0, -6.0])
            .expect("invertible affine matrix");

        assert_close(&inverse, &[0.5, 0.0, -2.0, 0.0, 1.0 / 3.0, 2.0], 1.0e-14);
    }

    #[test]
    fn four_point_correspondences_determine_a_projective_matrix() {
        let source = [[0.0, 0.0], [1.0, 0.0], [1.0, 1.0], [0.0, 1.0]];
        let destination = [[1.0, 2.0], [2.0, 7.0 / 6.0], [2.0, 19.0 / 7.0], [1.2, 4.0]];

        let matrix = perspective_transform(&source, &destination).expect("valid quadrilaterals");

        assert_close(
            &matrix,
            &[2.0, 0.5, 1.0, -0.25, 3.0, 2.0, 0.5, 0.25, 1.0],
            1.0e-13,
        );
    }

    #[test]
    fn invalid_numeric_inputs_and_degenerate_geometry_are_rejected() {
        assert_eq!(
            rotation_matrix_2d([f64::NAN, 0.0], 0.0, 1.0),
            Err(TransformMatrixError::NonFiniteInput)
        );
        assert_eq!(
            invert_affine_transform(&[1.0, 2.0, 0.0, 2.0, 4.0, 0.0]),
            Err(TransformMatrixError::DegenerateGeometry)
        );

        let source = [[0.0, 0.0], [1.0, 0.0], [2.0, 0.0], [3.0, 0.0]];
        let destination = [[0.0, 0.0], [1.0, 1.0], [2.0, 1.0], [3.0, 2.0]];
        assert_eq!(
            perspective_transform(&source, &destination),
            Err(TransformMatrixError::DegenerateGeometry)
        );
    }
}
