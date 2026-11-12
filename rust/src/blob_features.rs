//! Binary-mask connected components and simple, intensity-independent geometry.
//!
//! Every nonzero mask byte is foreground.  Components use 8-connectivity; the
//! perimeter deliberately follows Appion's raster convention rather than a
//! contour approximation.

use crate::MAX_PIXELS;

const STRIDE: usize = 8;

#[derive(Debug)]
struct BlobStats {
    first_x: u32,
    first_y: u32,
    area: u32,
    mean_x: f64,
    mean_y: f64,
    m2_xx: f64,
    m2_xy: f64,
    m2_yy: f64,
    perimeter: f64,
}

impl BlobStats {
    fn new(first_x: u32, first_y: u32) -> Self {
        Self {
            first_x,
            first_y,
            area: 0,
            mean_x: 0.0,
            mean_y: 0.0,
            m2_xx: 0.0,
            m2_xy: 0.0,
            m2_yy: 0.0,
            perimeter: 0.0,
        }
    }

    fn add_pixel(&mut self, x: u32, y: u32, mask: &[u8], width: u32, height: u32) {
        let point_x = f64::from(x);
        let point_y = f64::from(y);
        let next_area = self.area + 1;
        let count = f64::from(next_area);
        let delta_x = point_x - self.mean_x;
        let delta_y = point_y - self.mean_y;
        self.mean_x += delta_x / count;
        self.mean_y += delta_y / count;
        self.m2_xx += delta_x * (point_x - self.mean_x);
        self.m2_xy += delta_x * (point_y - self.mean_y);
        self.m2_yy += delta_y * (point_y - self.mean_y);
        self.area = next_area;

        let orthogonal_foreground = orthogonal_foreground_count(mask, width, height, x, y);
        let exposed_sides = 4 - orthogonal_foreground;
        self.perimeter += if exposed_sides == 2 {
            std::f64::consts::SQRT_2
        } else {
            exposed_sides as f64
        };
    }

    fn append_to(self, result: &mut Vec<f64>) {
        let area = f64::from(self.area);
        let equivalent_diameter = 2.0 * (area / std::f64::consts::PI).sqrt();
        let roundness = 4.0 * std::f64::consts::PI * area / self.perimeter.powi(2);
        let covariance_xx = self.m2_xx / area;
        let covariance_xy = self.m2_xy / area;
        let covariance_yy = self.m2_yy / area;
        let trace_half = (covariance_xx + covariance_yy) / 2.0;
        let difference_half = (covariance_xx - covariance_yy) / 2.0;
        let spread =
            (difference_half.mul_add(difference_half, covariance_xy * covariance_xy)).sqrt();
        let lambda_max = trace_half + spread;
        let lambda_min = trace_half - spread;
        let inertia_ratio = if lambda_min > 0.0 && lambda_max.is_finite() {
            lambda_max / lambda_min
        } else {
            f64::NAN
        };

        result.extend_from_slice(&[
            f64::from(self.first_x),
            f64::from(self.first_y),
            area,
            self.mean_x,
            self.mean_y,
            equivalent_diameter,
            roundness,
            inertia_ratio,
        ]);
    }
}

fn validate_mask(mask: &[u8], width: u32, height: u32) -> Result<usize, String> {
    let pixels = (width as usize)
        .checked_mul(height as usize)
        .ok_or("mask dimensions overflow")?;
    if pixels == 0 || pixels > MAX_PIXELS {
        return Err("mask dimensions must contain 1 to 40,000,000 pixels".into());
    }
    if mask.len() != pixels {
        return Err("mask length does not match mask dimensions".into());
    }
    Ok(pixels)
}

fn is_foreground(mask: &[u8], width: u32, x: u32, y: u32) -> bool {
    mask[(y as usize) * (width as usize) + (x as usize)] != 0
}

fn orthogonal_foreground_count(mask: &[u8], width: u32, height: u32, x: u32, y: u32) -> usize {
    usize::from(x > 0 && is_foreground(mask, width, x - 1, y))
        + usize::from(x + 1 < width && is_foreground(mask, width, x + 1, y))
        + usize::from(y > 0 && is_foreground(mask, width, x, y - 1))
        + usize::from(y + 1 < height && is_foreground(mask, width, x, y + 1))
}

fn visit_component(
    mask: &[u8],
    width: u32,
    height: u32,
    start: usize,
    visited: &mut [bool],
    pending: &mut Vec<usize>,
) -> BlobStats {
    let first_x = (start % width as usize) as u32;
    let first_y = (start / width as usize) as u32;
    let mut stats = BlobStats::new(first_x, first_y);
    pending.push(start);
    visited[start] = true;
    while let Some(index) = pending.pop() {
        let x = (index % width as usize) as u32;
        let y = (index / width as usize) as u32;
        stats.add_pixel(x, y, mask, width, height);
        for offset_y in y.saturating_sub(1)..=(y + 1).min(height - 1) {
            for offset_x in x.saturating_sub(1)..=(x + 1).min(width - 1) {
                let neighbor = (offset_y as usize) * width as usize + offset_x as usize;
                if !visited[neighbor] && mask[neighbor] != 0 {
                    visited[neighbor] = true;
                    pending.push(neighbor);
                }
            }
        }
    }
    stats
}

/// Measure 8-connected foreground blobs in a binary mask.
///
/// The returned flat vector is eight `f64` values per blob, ordered by each
/// component's first row-major foreground pixel: `[first_x, first_y, area_px,
/// centroid_x, centroid_y, equivalent_diameter_px, roundness, inertia_ratio]`.
/// Coordinates are in original pixel units.  Floating-point geometry is
/// expected to agree within normal `f64` tolerance; a one-pixel blob has a
/// `NaN` inertia ratio because its covariance has no positive minor axis.
pub fn measure_blobs_core(mask: &[u8], width: u32, height: u32) -> Result<Vec<f64>, String> {
    let pixels = validate_mask(mask, width, height)?;
    let mut visited = vec![false; pixels];
    let mut result = Vec::new();
    let mut pending = Vec::new();
    for index in 0..pixels {
        if mask[index] != 0 && !visited[index] {
            visit_component(mask, width, height, index, &mut visited, &mut pending)
                .append_to(&mut result);
        }
    }
    debug_assert_eq!(result.len() % STRIDE, 0);
    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn blob(result: &[f64], index: usize) -> &[f64] {
        &result[index * STRIDE..(index + 1) * STRIDE]
    }

    #[test]
    fn joins_different_nonzero_bytes_diagonally() {
        let values = measure_blobs_core(&[1, 0, 0, 255], 2, 2).unwrap();
        assert_eq!(values.len(), STRIDE);
        assert_eq!(values[2], 2.0);
        assert_eq!(&values[..2], &[0.0, 0.0]);
        assert!(values[7].is_nan());
    }

    #[test]
    fn separates_and_orders_components() {
        let values = measure_blobs_core(&[0, 9, 0, 0, 0, 0, 7, 0, 0], 3, 3).unwrap();
        assert_eq!(values.len(), STRIDE * 2);
        assert_eq!(&blob(&values, 0)[..3], &[1.0, 0.0, 1.0]);
        assert_eq!(&blob(&values, 1)[..3], &[0.0, 2.0, 1.0]);
    }

    #[test]
    fn compact_shape_is_rounder_and_less_anisotropic_than_rectangle() {
        let compact = measure_blobs_core(&[1; 9], 3, 3).unwrap();
        let rectangle = measure_blobs_core(&[1; 27], 9, 3).unwrap();
        assert!(compact[6] > rectangle[6]);
        assert!((compact[7] - 1.0).abs() < 1e-12);
        assert!(rectangle[7].is_finite());
        assert!(rectangle[7] > compact[7]);
    }

    #[test]
    fn translation_preserves_shape_measurements() {
        let at_origin = measure_blobs_core(&[1, 1, 0, 1, 0, 0, 0, 0, 0], 3, 3).unwrap();
        let translated = measure_blobs_core(&[0, 0, 0, 0, 1, 1, 0, 1, 0], 3, 3).unwrap();
        assert_eq!(at_origin[2], translated[2]);
        assert!((at_origin[5] - translated[5]).abs() < 1e-12);
        assert!((at_origin[6] - translated[6]).abs() < 1e-12);
        assert!((at_origin[7] - translated[7]).abs() < 1e-12);
    }

    #[test]
    fn rejects_invalid_masks_and_accepts_dimension_limit() {
        assert!(measure_blobs_core(&[], 0, 1).is_err());
        assert!(measure_blobs_core(&[0], 2, 1).is_err());
        assert_eq!(
            validate_mask(&[], 40_000_000, 1).unwrap_err(),
            "mask length does not match mask dimensions"
        );
        assert!(validate_mask(&[], 40_000_001, 1).is_err());
    }
}
