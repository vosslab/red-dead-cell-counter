use cell_detector::{PreparedImage, detect_core, preview_core};

fn fixture() -> Vec<u8> {
    let mut rgba = vec![0; 80 * 80 * 4];
    for (center_x, center_y) in [(20_i32, 20_i32), (60, 60)] {
        for y in -3_i32..=3 {
            for x in -3_i32..=3 {
                if x * x + y * y > 9 {
                    continue;
                }
                let pixel_x = center_x + x;
                let pixel_y = center_y + y;
                let index = ((pixel_y * 80 + pixel_x) * 4) as usize;
                rgba[index] = 255;
            }
        }
    }
    rgba
}

fn main() {
    let rgba = fixture();
    let points = detect_core(&rgba, 80, 80, 8.0, 3.0, 0.01).expect("fixture is valid");
    let mut prepared = PreparedImage::from_rgba(&rgba, 80, 80).expect("fixture is valid");
    assert_eq!(
        prepared
            .detect_core(8.0, 3.0, 0.01)
            .expect("prepared fixture is valid"),
        points
    );
    let views = preview_core(&rgba, 80, 80, 8.0, 3.0, 0.01).expect("fixture is valid");
    let checksum = |bytes: &[u8]| {
        bytes.iter().fold(2_166_136_261_u32, |hash, value| {
            (hash ^ u32::from(*value)).wrapping_mul(16_777_619)
        })
    };
    let dog_checksum = checksum(&views[..80 * 80]);
    let threshold_checksum = checksum(&views[80 * 80..]);
    println!(
        "{{\"width\":80,\"height\":80,\"diameter\":8,\"k\":3,\"threshold\":0.01,\"points\":{points:?},\"dog_checksum\":{dog_checksum},\"threshold_checksum\":{threshold_checksum}}}"
    );
}
