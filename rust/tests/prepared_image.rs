use cell_detector::{PreparedImage, detect_core};

fn fixture() -> Vec<u8> {
    let (width, height) = (48, 40);
    let mut rgba = vec![0; width * height * 4];
    for (center_x, center_y, red) in [(10_i32, 10_i32, 255), (27, 18, 190), (38, 30, 128)] {
        for y in -3_i32..=3 {
            for x in -3_i32..=3 {
                if x * x + y * y > 9 {
                    continue;
                }
                let index = ((center_y + y) as usize * width + (center_x + x) as usize) * 4;
                rgba[index] = red;
            }
        }
    }
    rgba
}

#[test]
fn prepared_image_matches_independent_detection_across_settings() {
    let rgba = fixture();
    let mut prepared = PreparedImage::from_rgba(&rgba, 48, 40).unwrap();
    for (diameter, k, threshold) in [
        (8.0, 3.0, 0.00002),
        (8.0, 3.0, 0.01),
        (8.0, 3.0, 0.1),
        (12.0, 4.5, 0.01),
        (8.0, 3.0, 0.01),
    ] {
        assert_eq!(
            prepared.detect_core(diameter, k, threshold).unwrap(),
            detect_core(&rgba, 48, 40, diameter, k, threshold).unwrap()
        );
    }
}

#[test]
fn prepared_image_validates_the_creation_and_detection_boundaries() {
    assert!(PreparedImage::from_rgba(&[0; 3], 1, 1).is_err());
    assert!(PreparedImage::from_rgba(&[], 0, 1).is_err());

    let rgba = fixture();
    let mut prepared = PreparedImage::from_rgba(&rgba, 48, 40).unwrap();
    assert!(prepared.detect_core(8.0, 3.0, 0.00001).is_err());
    assert_eq!(
        prepared.detect_core(8.0, 3.0, 0.01).unwrap(),
        detect_core(&rgba, 48, 40, 8.0, 3.0, 0.01).unwrap()
    );
}
