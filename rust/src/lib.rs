use std::cmp::Ordering;
use std::collections::HashMap;

use image::{ImageBuffer, Luma};
use imageproc::filter::gaussian_blur_f32;
use wasm_bindgen::prelude::*;

const MAX_PIXELS: usize = 40_000_000;

#[derive(Clone, Copy)]
struct Candidate {
    x: u32,
    y: u32,
    score: f32,
}

fn validate(
    rgba: &[u8],
    width: u32,
    height: u32,
    diameter: f32,
    k: f32,
    threshold: f32,
) -> Result<usize, String> {
    let pixels = (width as usize)
        .checked_mul(height as usize)
        .ok_or("image dimensions overflow")?;
    if pixels == 0 || pixels > MAX_PIXELS {
        return Err("image dimensions must contain 1 to 40,000,000 pixels".into());
    }
    if rgba.len() != pixels.checked_mul(4).ok_or("image buffer size overflow")? {
        return Err("RGBA buffer length does not match image dimensions".into());
    }
    if !diameter.is_finite() || !(2.0..=200.0).contains(&diameter) {
        return Err("diameter must be a finite value from 2 to 200 pixels".into());
    }
    if !k.is_finite() || !(1.1..=8.0).contains(&k) {
        return Err("k must be a finite value from 1.1 to 8".into());
    }
    if !threshold.is_finite() || threshold <= 0.00001 {
        return Err("threshold must be finite and greater than 0.00001".into());
    }
    Ok(pixels)
}

fn target_sigmas(radius: f32, k: f32) -> (f32, f32) {
    let sigma_one = radius * ((k * k - 1.0) / (2.0 * k * k * k.ln())).sqrt();
    (sigma_one, k * sigma_one)
}

fn has_no_stronger_neighbor(
    response: &[f32],
    width: u32,
    height: u32,
    x: u32,
    y: u32,
    score: f32,
) -> bool {
    for neighbor_y in y.saturating_sub(1)..=(y + 1).min(height - 1) {
        for neighbor_x in x.saturating_sub(1)..=(x + 1).min(width - 1) {
            if neighbor_x == x && neighbor_y == y {
                continue;
            }
            let neighbor = response[(neighbor_y * width + neighbor_x) as usize];
            if neighbor > score || (neighbor == score && (neighbor_y, neighbor_x) < (y, x)) {
                return false;
            }
        }
    }
    true
}

/// Find bright red blobs and return their original-pixel centers as x/y pairs.
pub fn detect_core(
    rgba: &[u8],
    width: u32,
    height: u32,
    diameter: f32,
    k: f32,
    threshold: f32,
) -> Result<Vec<f32>, String> {
    let pixels = validate(rgba, width, height, diameter, k, threshold)?;
    let signal = ImageBuffer::from_fn(width, height, |x, y| {
        let offset = ((y * width + x) as usize) * 4;
        let red = rgba[offset] as f32 / 255.0;
        let other = rgba[offset + 1].max(rgba[offset + 2]) as f32 / 255.0;
        Luma([(red - other).max(0.0)])
    });
    let (sigma_one, sigma_two) = target_sigmas(diameter / 2.0, k);
    let first = gaussian_blur_f32(&signal, sigma_one);
    let second = gaussian_blur_f32(&signal, sigma_two);
    let mut response = Vec::with_capacity(pixels);
    for (a, b) in first.pixels().zip(second.pixels()) {
        response.push(a[0] - b[0]);
    }

    let mut candidates = Vec::new();
    for y in 0..height {
        for x in 0..width {
            let score = response[(y * width + x) as usize];
            if score >= threshold && has_no_stronger_neighbor(&response, width, height, x, y, score)
            {
                candidates.push(Candidate { x, y, score });
            }
        }
    }
    candidates.sort_by(|left, right| {
        right
            .score
            .partial_cmp(&left.score)
            .unwrap_or(Ordering::Equal)
            .then_with(|| left.y.cmp(&right.y))
            .then_with(|| left.x.cmp(&right.x))
    });

    let cell = diameter.ceil().max(1.0) as i32;
    let minimum_distance = diameter / 2.0;
    let minimum_distance_squared = minimum_distance * minimum_distance;
    let mut accepted: Vec<Candidate> = Vec::new();
    let mut grid: HashMap<(i32, i32), Vec<usize>> = HashMap::new();
    for candidate in candidates {
        let bucket = (candidate.x as i32 / cell, candidate.y as i32 / cell);
        let mut overlaps = false;
        for grid_y in bucket.1 - 1..=bucket.1 + 1 {
            for grid_x in bucket.0 - 1..=bucket.0 + 1 {
                if let Some(indices) = grid.get(&(grid_x, grid_y)) {
                    for &index in indices {
                        let kept = accepted[index];
                        let dx = candidate.x as f32 - kept.x as f32;
                        let dy = candidate.y as f32 - kept.y as f32;
                        if dx * dx + dy * dy < minimum_distance_squared {
                            overlaps = true;
                            break;
                        }
                    }
                }
                if overlaps {
                    break;
                }
            }
            if overlaps {
                break;
            }
        }
        if !overlaps {
            let index = accepted.len();
            accepted.push(candidate);
            grid.entry(bucket).or_default().push(index);
        }
    }
    let mut output = Vec::with_capacity(accepted.len() * 2);
    for point in accepted {
        output.extend([point.x as f32, point.y as f32]);
    }
    Ok(output)
}

#[wasm_bindgen]
pub fn detect(
    rgba: &[u8],
    width: u32,
    height: u32,
    diameter: f32,
    k: f32,
    threshold: f32,
) -> Result<Vec<f32>, JsValue> {
    detect_core(rgba, width, height, diameter, k, threshold)
        .map_err(|error| JsValue::from_str(&error))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn pixel_image(width: u32, height: u32, points: &[(u32, u32)]) -> Vec<u8> {
        let mut image = vec![0; (width * height * 4) as usize];
        for &(x, y) in points {
            for dy in -3i32..=3 {
                for dx in -3i32..=3 {
                    let xx = x as i32 + dx;
                    let yy = y as i32 + dy;
                    if xx >= 0
                        && yy >= 0
                        && xx < width as i32
                        && yy < height as i32
                        && dx * dx + dy * dy <= 9
                    {
                        image[((yy as u32 * width + xx as u32) * 4) as usize] = 255;
                    }
                }
            }
        }
        image
    }

    #[test]
    fn finds_separated_red_blobs() {
        let image = pixel_image(80, 80, &[(20, 20), (60, 60)]);
        assert_eq!(
            detect_core(&image, 80, 80, 8.0, 3.0, 0.01).unwrap().len(),
            4
        );
    }

    #[test]
    fn blank_image_has_no_detections() {
        assert!(
            detect_core(&vec![0; 80 * 80 * 4], 80, 80, 8.0, 3.0, 0.01)
                .unwrap()
                .is_empty()
        );
    }

    #[test]
    fn rejects_invalid_input() {
        assert!(detect_core(&[0; 3], 1, 1, 8.0, 3.0, 0.01).is_err());
        assert!(detect_core(&[0; 4], 1, 1, 1.0, 3.0, 0.01).is_err());
        for threshold in [-0.1, 0.0, 0.00001, f32::NAN] {
            assert!(detect_core(&[0; 4], 1, 1, 8.0, 3.0, threshold).is_err());
        }
        assert!(detect_core(&[0; 4], 1, 1, 8.0, 3.0, 0.00002).is_ok());
    }
}
