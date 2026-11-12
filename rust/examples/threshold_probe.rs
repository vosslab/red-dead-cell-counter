use std::env;
use std::fs;

use cell_detector::detect_core;
use image::{ImageBuffer, Luma};
use imageproc::filter::gaussian_blur_f32;

fn response_map(rgba: &[u8], width: u32, height: u32) -> Vec<f32> {
    let signal = ImageBuffer::from_fn(width, height, |x, y| {
        let offset = ((y * width + x) as usize) * 4;
        let red = rgba[offset] as f32 / 255.0;
        let other = rgba[offset + 1].max(rgba[offset + 2]) as f32 / 255.0;
        Luma([(red - other).max(0.0)])
    });
    let radius = 5.0_f32;
    let k = 4.0_f32;
    let sigma_one = radius * ((k * k - 1.0) / (2.0 * k * k * k.ln())).sqrt();
    let first = gaussian_blur_f32(&signal, sigma_one);
    let second = gaussian_blur_f32(&signal, sigma_one * k);
    first
        .pixels()
        .zip(second.pixels())
        .map(|(a, b)| a[0] - b[0])
        .collect()
}

fn main() {
    let mut arguments = env::args().skip(1);
    let input = arguments.next().expect("input rgba file");
    let output = arguments.next().expect("output response file");
    let detections = arguments.next().expect("output detections file");
    let width: u32 = arguments
        .next()
        .expect("width")
        .parse()
        .expect("width integer");
    let height: u32 = arguments
        .next()
        .expect("height")
        .parse()
        .expect("height integer");
    let rgba = fs::read(input).expect("read rgba");
    let points = detect_core(&rgba, width, height, 10.0, 4.0, 0.1).expect("detect");
    let response = response_map(&rgba, width, height);
    let bytes: Vec<u8> = response.into_iter().flat_map(f32::to_le_bytes).collect();
    fs::write(output, bytes).expect("write response");
    fs::write(
        detections,
        points
            .into_iter()
            .flat_map(f32::to_le_bytes)
            .collect::<Vec<u8>>(),
    )
    .expect("write detections");
}
