use cell_detector::detect_core;

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
    let points = detect_core(&fixture(), 80, 80, 8.0, 3.0, 0.01).expect("fixture is valid");
    println!(
        "{{\"width\":80,\"height\":80,\"diameter\":8,\"k\":3,\"threshold\":0.01,\"points\":{points:?}}}"
    );
}
