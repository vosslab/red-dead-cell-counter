use std::env;
use std::fs;

use cell_detector::PreparedImage;

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
    let mut prepared = PreparedImage::from_rgba(&rgba, width, height).expect("prepare image");
    let points = prepared.detect_core(10.0, 4.0, 0.1).expect("detect");
    let response = prepared.response_core(10.0, 4.0).expect("response");
    let bytes: Vec<u8> = response
        .iter()
        .flat_map(|value| value.to_le_bytes())
        .collect();
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
