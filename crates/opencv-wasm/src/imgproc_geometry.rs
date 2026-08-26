//! Safe contour-geometry kernels used by the WebAssembly matrix adapter.
//!
//! The kernels operate on finite, decoded points. They intentionally cover the useful 2D contour
//! subset and do not implement `OpenCV`'s general curve-array input machinery.

use std::{error::Error, fmt};

/// A finite point in a two-dimensional contour.
#[derive(Debug, Clone, Copy, PartialEq)]
pub(crate) struct Point {
    pub(crate) x: f64,
    pub(crate) y: f64,
}

/// Integer rectangle containing every contour point.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) struct BoundingRect {
    pub(crate) x: i32,
    pub(crate) y: i32,
    pub(crate) width: i32,
    pub(crate) height: i32,
}

/// Failures shared by contour-geometry kernels.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum GeometryError {
    EmptyContour,
    NonFinitePoint { index: usize },
    NumericOverflow,
    BoundingRectOutOfRange,
}

impl fmt::Display for GeometryError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::EmptyContour => formatter.write_str("contour must contain at least one point"),
            Self::NonFinitePoint { index } => {
                write!(
                    formatter,
                    "contour point {index} contains a non-finite coordinate"
                )
            }
            Self::NumericOverflow => {
                formatter.write_str("geometry result exceeds finite floating-point range")
            }
            Self::BoundingRectOutOfRange => {
                formatter.write_str("contour bounding rectangle exceeds signed 32-bit range")
            }
        }
    }
}

impl Error for GeometryError {}

/// Computes the polyline length, optionally adding the final-to-first segment.
pub(crate) fn arc_length(points: &[Point], closed: bool) -> Result<f64, GeometryError> {
    validate_points(points)?;
    if points.len() == 1 {
        return Ok(0.0);
    }

    let mut length = 0.0;
    for pair in points.windows(2) {
        length += distance(pair[0], pair[1]);
    }
    if closed {
        length += distance(points[points.len() - 1], points[0]);
    }
    finite_result(length)
}

/// Computes polygon area with the shoelace formula.
///
/// When `oriented` is true, counter-clockwise points in Cartesian coordinates have positive area.
/// Otherwise the absolute area is returned.
pub(crate) fn contour_area(points: &[Point], oriented: bool) -> Result<f64, GeometryError> {
    validate_points(points)?;
    if points.len() < 3 {
        return Ok(0.0);
    }

    let mut twice_area = 0.0;
    for index in 0..points.len() {
        let current = points[index];
        let next = points[(index + 1) % points.len()];
        twice_area += current.x * next.y - next.x * current.y;
    }
    let area = twice_area * 0.5;
    finite_result(if oriented { area } else { area.abs() })
}

/// Returns the smallest inclusive integer rectangle containing the contour.
///
/// Floating coordinates are floored, matching pixel-cell containment. Width and height include the
/// greatest integer coordinate, so a single integer point has a 1-by-1 rectangle.
pub(crate) fn bounding_rect(points: &[Point]) -> Result<BoundingRect, GeometryError> {
    validate_points(points)?;
    let mut minimum_x = f64::INFINITY;
    let mut minimum_y = f64::INFINITY;
    let mut maximum_x = f64::NEG_INFINITY;
    let mut maximum_y = f64::NEG_INFINITY;
    for point in points {
        minimum_x = minimum_x.min(point.x);
        minimum_y = minimum_y.min(point.y);
        maximum_x = maximum_x.max(point.x);
        maximum_y = maximum_y.max(point.y);
    }

    let x = floored_i32(minimum_x)?;
    let y = floored_i32(minimum_y)?;
    let maximum_x = floored_i32(maximum_x)?;
    let maximum_y = floored_i32(maximum_y)?;
    let width = i64::from(maximum_x)
        .checked_sub(i64::from(x))
        .and_then(|value| value.checked_add(1))
        .ok_or(GeometryError::BoundingRectOutOfRange)?;
    let height = i64::from(maximum_y)
        .checked_sub(i64::from(y))
        .and_then(|value| value.checked_add(1))
        .ok_or(GeometryError::BoundingRectOutOfRange)?;
    Ok(BoundingRect {
        x,
        y,
        width: i32::try_from(width).map_err(|_| GeometryError::BoundingRectOutOfRange)?,
        height: i32::try_from(height).map_err(|_| GeometryError::BoundingRectOutOfRange)?,
    })
}

/// Reports whether a polygon has a consistent nonzero turn direction.
pub(crate) fn is_contour_convex(points: &[Point]) -> Result<bool, GeometryError> {
    validate_points(points)?;
    if points.len() < 3 {
        return Ok(false);
    }

    let mut direction = 0_i8;
    for index in 0..points.len() {
        let first = points[index];
        let second = points[(index + 1) % points.len()];
        let third = points[(index + 2) % points.len()];
        let cross = cross_product(first, second, third);
        if !cross.is_finite() {
            return Err(GeometryError::NumericOverflow);
        }
        let turn = if cross > 0.0 {
            1
        } else if cross < 0.0 {
            -1
        } else {
            return Ok(false);
        };
        if direction != 0 && direction != turn {
            return Ok(false);
        }
        direction = turn;
    }
    Ok(true)
}

/// Classifies a point against a polygon or returns its signed nearest-edge distance.
///
/// Positive results are inside, negative results are outside, and zero is on the boundary.
pub(crate) fn point_polygon_test(
    points: &[Point],
    query: Point,
    measure_distance: bool,
) -> Result<f64, GeometryError> {
    validate_points(points)?;
    if !query.x.is_finite() || !query.y.is_finite() {
        return Ok(if measure_distance {
            -f64::from(f32::MAX).sqrt()
        } else {
            -1.0
        });
    }

    let mut inside = false;
    let mut nearest_squared = f64::INFINITY;
    for index in 0..points.len() {
        let first = points[(index + points.len() - 1) % points.len()];
        let second = points[index];
        let squared = point_segment_distance_squared(query, first, second);
        if !squared.is_finite() {
            return Err(GeometryError::NumericOverflow);
        }
        nearest_squared = nearest_squared.min(squared);
        if squared == 0.0 {
            return Ok(if measure_distance && !inside {
                -0.0
            } else {
                0.0
            });
        }

        let crosses_y = (first.y > query.y) != (second.y > query.y);
        if crosses_y {
            let intersection_x =
                first.x + (query.y - first.y) * (second.x - first.x) / (second.y - first.y);
            if !intersection_x.is_finite() {
                return Err(GeometryError::NumericOverflow);
            }
            if query.x < intersection_x {
                inside = !inside;
            }
        }
    }

    if !measure_distance {
        return Ok(if inside { 1.0 } else { -1.0 });
    }
    let distance = nearest_squared.sqrt();
    finite_result(if inside { distance } else { -distance })
}

fn validate_points(points: &[Point]) -> Result<(), GeometryError> {
    if points.is_empty() {
        return Err(GeometryError::EmptyContour);
    }
    for (index, point) in points.iter().enumerate() {
        if !point.x.is_finite() || !point.y.is_finite() {
            return Err(GeometryError::NonFinitePoint { index });
        }
    }
    Ok(())
}

fn distance(first: Point, second: Point) -> f64 {
    (second.x - first.x).hypot(second.y - first.y)
}

fn cross_product(first: Point, second: Point, third: Point) -> f64 {
    (second.x - first.x) * (third.y - second.y) - (second.y - first.y) * (third.x - second.x)
}

fn point_segment_distance_squared(point: Point, first: Point, second: Point) -> f64 {
    let dx = second.x - first.x;
    let dy = second.y - first.y;
    let length_squared = dx * dx + dy * dy;
    if length_squared == 0.0 {
        let x = point.x - first.x;
        let y = point.y - first.y;
        return x * x + y * y;
    }
    let projection = ((point.x - first.x) * dx + (point.y - first.y) * dy) / length_squared;
    let clamped = projection.clamp(0.0, 1.0);
    let nearest_x = first.x + clamped * dx;
    let nearest_y = first.y + clamped * dy;
    let x = point.x - nearest_x;
    let y = point.y - nearest_y;
    x * x + y * y
}

fn finite_result(value: f64) -> Result<f64, GeometryError> {
    if value.is_finite() {
        Ok(value)
    } else {
        Err(GeometryError::NumericOverflow)
    }
}

#[allow(clippy::cast_possible_truncation)]
fn floored_i32(value: f64) -> Result<i32, GeometryError> {
    let value = value.floor();
    if value < f64::from(i32::MIN) || value > f64::from(i32::MAX) {
        Err(GeometryError::BoundingRectOutOfRange)
    } else {
        Ok(value as i32)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const RECTANGLE: [Point; 4] = [
        Point { x: 0.0, y: 0.0 },
        Point { x: 4.0, y: 0.0 },
        Point { x: 4.0, y: 3.0 },
        Point { x: 0.0, y: 3.0 },
    ];

    #[test]
    fn arc_length_distinguishes_open_and_closed_curves() {
        assert_eq!(arc_length(&RECTANGLE, false), Ok(11.0));
        assert_eq!(arc_length(&RECTANGLE, true), Ok(14.0));
        assert_eq!(arc_length(&RECTANGLE[..1], true), Ok(0.0));
    }

    #[test]
    fn contour_area_preserves_orientation_only_when_requested() {
        assert_eq!(contour_area(&RECTANGLE, true), Ok(12.0));
        let reversed: Vec<_> = RECTANGLE.iter().copied().rev().collect();
        assert_eq!(contour_area(&reversed, true), Ok(-12.0));
        assert_eq!(contour_area(&reversed, false), Ok(12.0));
        assert_eq!(contour_area(&RECTANGLE[..2], false), Ok(0.0));
    }

    #[test]
    fn bounding_rectangle_contains_fractional_and_negative_points() {
        let points = [
            Point { x: -0.2, y: 1.9 },
            Point { x: 2.8, y: -1.1 },
            Point { x: 0.0, y: 3.0 },
        ];
        assert_eq!(
            bounding_rect(&points),
            Ok(BoundingRect {
                x: -1,
                y: -2,
                width: 4,
                height: 6,
            })
        );
    }

    #[test]
    fn convexity_requires_every_turn_to_be_strict_and_consistent() {
        let with_collinear = [
            Point { x: 0.0, y: 0.0 },
            Point { x: 2.0, y: 0.0 },
            Point { x: 4.0, y: 0.0 },
            Point { x: 4.0, y: 3.0 },
            Point { x: 0.0, y: 3.0 },
        ];
        let concave = [
            Point { x: 0.0, y: 0.0 },
            Point { x: 4.0, y: 0.0 },
            Point { x: 2.0, y: 1.0 },
            Point { x: 4.0, y: 3.0 },
            Point { x: 0.0, y: 3.0 },
        ];
        let duplicate = [
            RECTANGLE[0],
            RECTANGLE[1],
            RECTANGLE[1],
            RECTANGLE[2],
            RECTANGLE[3],
        ];
        let repeated_close = [
            RECTANGLE[0],
            RECTANGLE[1],
            RECTANGLE[2],
            RECTANGLE[3],
            RECTANGLE[0],
        ];
        let clockwise: Vec<_> = RECTANGLE.iter().copied().rev().collect();

        assert_eq!(is_contour_convex(&RECTANGLE), Ok(true));
        assert_eq!(is_contour_convex(&clockwise), Ok(true));
        assert_eq!(is_contour_convex(&with_collinear), Ok(false));
        assert_eq!(is_contour_convex(&duplicate), Ok(false));
        assert_eq!(is_contour_convex(&repeated_close), Ok(false));
        assert_eq!(is_contour_convex(&concave), Ok(false));
        assert_eq!(is_contour_convex(&with_collinear[..2]), Ok(false));
    }

    #[test]
    fn point_polygon_test_classifies_inside_outside_and_boundary() {
        assert_eq!(
            point_polygon_test(&RECTANGLE, Point { x: 2.0, y: 1.0 }, false),
            Ok(1.0)
        );
        assert_eq!(
            point_polygon_test(&RECTANGLE, Point { x: 5.0, y: 1.0 }, false),
            Ok(-1.0)
        );
        assert_eq!(
            point_polygon_test(&RECTANGLE, Point { x: 4.0, y: 1.0 }, false),
            Ok(-0.0)
        );
    }

    #[test]
    fn point_polygon_test_accepts_points_and_segments() {
        let point = [Point { x: 0.0, y: 0.0 }];
        let segment = [Point { x: 0.0, y: 0.0 }, Point { x: 4.0, y: 0.0 }];

        assert_eq!(
            point_polygon_test(&point, Point { x: 2.0, y: 1.0 }, false),
            Ok(-1.0)
        );
        assert_eq!(
            point_polygon_test(&point, Point { x: 2.0, y: 1.0 }, true),
            Ok(-5.0_f64.sqrt())
        );
        assert_eq!(
            point_polygon_test(&segment, Point { x: 2.0, y: 0.0 }, false),
            Ok(0.0)
        );
        let measured_boundary =
            point_polygon_test(&segment, Point { x: 2.0, y: 0.0 }, true).unwrap();
        assert_eq!(measured_boundary.to_bits(), (-0.0_f64).to_bits());
        assert_eq!(
            point_polygon_test(&segment, Point { x: 2.0, y: 1.0 }, true),
            Ok(-1.0)
        );
    }

    #[test]
    fn point_polygon_test_returns_signed_nearest_distance() {
        assert_eq!(
            point_polygon_test(&RECTANGLE, Point { x: 2.0, y: 1.0 }, true),
            Ok(1.0)
        );
        assert_eq!(
            point_polygon_test(&RECTANGLE, Point { x: 5.0, y: 1.0 }, true),
            Ok(-1.0)
        );
        assert_eq!(
            point_polygon_test(&RECTANGLE, Point { x: 4.0, y: 1.0 }, true),
            Ok(0.0)
        );

        let concave = [
            Point { x: 0.0, y: 0.0 },
            Point { x: 4.0, y: 0.0 },
            Point { x: 4.0, y: 4.0 },
            Point { x: 2.0, y: 2.0 },
            Point { x: 0.0, y: 4.0 },
        ];
        let notch_boundary = point_polygon_test(&concave, Point { x: 3.0, y: 3.0 }, true).unwrap();
        assert_eq!(notch_boundary.to_bits(), 0.0_f64.to_bits());

        let clockwise = [RECTANGLE[0], RECTANGLE[3], RECTANGLE[2], RECTANGLE[1]];
        for points in [&RECTANGLE[..], &clockwise[..]] {
            for query in [
                Point { x: 2.0, y: 0.0 },
                Point { x: 4.0, y: 1.5 },
                Point { x: 2.0, y: 3.0 },
                Point { x: 0.0, y: 1.5 },
            ] {
                let boundary = point_polygon_test(points, query, true).unwrap();
                assert_eq!(boundary.to_bits(), (-0.0_f64).to_bits());
            }
        }
    }

    #[test]
    fn invalid_values_and_empty_input_fail_explicitly() {
        assert_eq!(arc_length(&[], false), Err(GeometryError::EmptyContour));
        assert_eq!(
            contour_area(
                &[Point {
                    x: f64::NAN,
                    y: 0.0
                }],
                false
            ),
            Err(GeometryError::NonFinitePoint { index: 0 })
        );
        assert_eq!(
            point_polygon_test(
                &RECTANGLE,
                Point {
                    x: f64::INFINITY,
                    y: 0.0
                },
                false
            ),
            Ok(-1.0)
        );
        assert_eq!(
            point_polygon_test(
                &RECTANGLE,
                Point {
                    x: f64::INFINITY,
                    y: 0.0
                },
                true
            ),
            Ok(-f64::from(f32::MAX).sqrt())
        );
    }
}
