use std::cmp::Ordering;
use std::collections::HashMap;

use image::{ImageBuffer, Luma};
use imageproc::filter::gaussian_blur_f32;
use wasm_bindgen::prelude::*;

mod automatic_threshold;
mod blob_features;
mod prepared_image;
pub use automatic_threshold::{AUTOMATIC_VERSION, AutomaticDetection, ThresholdMethod};
pub use blob_features::measure_blobs_core;
pub use prepared_image::PreparedImage;

const MAX_PIXELS: usize = 40_000_000;

/// Measure binary-mask blobs for browser callers.
///
/// Zero bytes are background and every nonzero byte is foreground. See
/// [`measure_blobs_core`] for the eight-value record layout.
#[wasm_bindgen]
pub fn measure_blobs(mask: &[u8], width: u32, height: u32) -> Result<Vec<f64>, JsValue> {
    measure_blobs_core(mask, width, height).map_err(|error| JsValue::from_str(&error))
}

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
    let pixels = validate_image(rgba, width, height)?;
    validate_settings(diameter, k, threshold)?;
    Ok(pixels)
}

fn validate_image(rgba: &[u8], width: u32, height: u32) -> Result<usize, String> {
    // ASVS 2.2.1/1.4.2: bound dimensions and verify buffer length before allocation.
    let pixels = (width as usize)
        .checked_mul(height as usize)
        .ok_or("image dimensions overflow")?;
    if pixels == 0 || pixels > MAX_PIXELS {
        return Err("image dimensions must contain 1 to 40,000,000 pixels".into());
    }
    if rgba.len() != pixels.checked_mul(4).ok_or("image buffer size overflow")? {
        return Err("RGBA buffer length does not match image dimensions".into());
    }
    Ok(pixels)
}

fn validate_settings(diameter: f32, k: f32, threshold: f32) -> Result<(), String> {
    if !diameter.is_finite() || !(2.0..=200.0).contains(&diameter) {
        return Err("diameter must be a finite value from 2 to 200 pixels".into());
    }
    if !k.is_finite() || !(1.1..=8.0).contains(&k) {
        return Err("k must be a finite value from 1.1 to 8".into());
    }
    if !threshold.is_finite() || threshold <= 0.00001 {
        return Err("threshold must be finite and greater than 0.00001".into());
    }
    Ok(())
}

fn target_sigmas(radius: f32, k: f32) -> (f32, f32) {
    let sigma_one = radius * ((k * k - 1.0) / (2.0 * k * k * k.ln())).sqrt();
    (sigma_one, k * sigma_one)
}

fn red_signal(rgba: &[u8], width: u32, height: u32) -> ImageBuffer<Luma<f32>, Vec<f32>> {
    ImageBuffer::from_fn(width, height, |x, y| {
        let offset = ((y * width + x) as usize) * 4;
        let red = rgba[offset] as f32 / 255.0;
        let other = rgba[offset + 1].max(rgba[offset + 2]) as f32 / 255.0;
        Luma([(red - other).max(0.0)])
    })
}

fn dog_response(
    signal: &ImageBuffer<Luma<f32>, Vec<f32>>,
    diameter: f32,
    k: f32,
) -> Result<Vec<f32>, String> {
    let (sigma_one, sigma_two) = target_sigmas(diameter / 2.0, k);
    let first = gaussian_blur_f32(signal, sigma_one);
    let second = gaussian_blur_f32(signal, sigma_two);
    let response: Vec<f32> = first
        .pixels()
        .zip(second.pixels())
        .map(|(a, b)| a[0] - b[0])
        .collect();
    if response.len() != signal.as_raw().len() || response.iter().any(|value| !value.is_finite()) {
        return Err("DoG response is not finite".into());
    }
    Ok(response)
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
    validate(rgba, width, height, diameter, k, threshold)?;
    let signal = red_signal(rgba, width, height);
    let response = dog_response(&signal, diameter, k)?;
    Ok(find_centers(&response, width, height, diameter, threshold))
}

fn find_centers(
    response: &[f32],
    width: u32,
    height: u32,
    diameter: f32,
    threshold: f32,
) -> Vec<f32> {
    let mut candidates = Vec::new();
    for y in 0..height {
        for x in 0..width {
            let score = response[(y * width + x) as usize];
            if score >= threshold && has_no_stronger_neighbor(response, width, height, x, y, score)
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
    output
}

/// Return tightly packed DoG grayscale and original-threshold-mask preview planes.
pub fn preview_core(
    rgba: &[u8],
    width: u32,
    height: u32,
    diameter: f32,
    k: f32,
    threshold: f32,
) -> Result<Vec<u8>, String> {
    let pixels = validate(rgba, width, height, diameter, k, threshold)?;
    let signal = red_signal(rgba, width, height);
    let response = dog_response(&signal, diameter, k)?;
    let (minimum, maximum) = response.iter().copied().fold(
        (f32::INFINITY, f32::NEG_INFINITY),
        |(minimum, maximum), value| (minimum.min(value), maximum.max(value)),
    );
    let mut output = vec![0; pixels * 2];
    if maximum > minimum {
        let scale = 255.0 / (maximum - minimum);
        for (index, value) in response.iter().copied().enumerate() {
            output[index] = ((value - minimum) * scale).round() as u8;
            output[pixels + index] = if value >= threshold { 255 } else { 0 };
        }
    } else {
        for (index, value) in response.iter().copied().enumerate() {
            output[pixels + index] = if value >= threshold { 255 } else { 0 };
        }
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

#[wasm_bindgen]
pub fn preview(
    rgba: &[u8],
    width: u32,
    height: u32,
    diameter: f32,
    k: f32,
    threshold: f32,
) -> Result<Vec<u8>, JsValue> {
    preview_core(rgba, width, height, diameter, k, threshold)
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

    #[test]
    fn preview_preserves_raw_threshold_response() {
        let (width, height) = (32, 32);
        let image = pixel_image(width, height, &[(16, 16)]);
        let threshold = 0.01;
        let preview = preview_core(&image, width, height, 8.0, 3.0, threshold).unwrap();
        let pixels = (width * height) as usize;
        let signal = ImageBuffer::from_fn(width, height, |x, y| {
            let offset = ((y * width + x) as usize) * 4;
            let red = image[offset] as f32 / 255.0;
            let other = image[offset + 1].max(image[offset + 2]) as f32 / 255.0;
            Luma([(red - other).max(0.0)])
        });
        let (sigma_one, sigma_two) = target_sigmas(4.0, 3.0);
        let first = gaussian_blur_f32(&signal, sigma_one);
        let second = gaussian_blur_f32(&signal, sigma_two);
        let expected_mask: Vec<u8> = first
            .pixels()
            .zip(second.pixels())
            .map(|(a, b)| if a[0] - b[0] >= threshold { 255 } else { 0 })
            .collect();

        assert_eq!(preview.len(), pixels * 2);
        assert_eq!(&preview[pixels..], expected_mask.as_slice());
        assert!(preview[..pixels].iter().any(|&value| value > 0));
        assert!(expected_mask.contains(&0) && expected_mask.contains(&255));
    }

    #[test]
    fn preview_blank_and_invalid_inputs() {
        let blank = vec![0; 4 * 4 * 4];
        let preview = preview_core(&blank, 4, 4, 8.0, 3.0, 0.01).unwrap();
        assert!(preview.iter().all(|&value| value == 0));
        assert!(preview_core(&blank, 4, 4, 8.0, 3.0, 0.00001).is_err());
        assert!(preview_core(&blank, 0, 4, 8.0, 3.0, 0.01).is_err());
    }
}
