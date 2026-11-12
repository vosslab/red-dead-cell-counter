use std::{env, fs, time::Instant};

use cell_detector::{PreparedImage, ThresholdMethod};

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let mut arguments = env::args().skip(1);
    let input = arguments.next().ok_or("input RGBA path required")?;
    let width: u32 = arguments.next().ok_or("width required")?.parse()?;
    let height: u32 = arguments.next().ok_or("height required")?.parse()?;
    let rgba = fs::read(input)?;
    let start = Instant::now();
    let mut prepared = PreparedImage::from_rgba(&rgba, width, height)?;
    prepared.response_core(10.0, 4.0)?;
    println!(
        "{{\"response_ms\":{},\"results\":[",
        start.elapsed().as_secs_f64() * 1000.0
    );
    for method in [
        ThresholdMethod::BinaryOtsu,
        ThresholdMethod::Li,
        ThresholdMethod::MultiOtsu,
    ] {
        let start = Instant::now();
        let result = prepared.automatic_core(method, 10.0, 4.0)?;
        println!(
            "{{\"selector\":{:?},\"method\":{:?},\"threshold\":{:.5},\"no_signal\":{},\"review_reasons\":{:?},\"count\":{},\"sensitivity_low_count\":{},\"sensitivity_high_count\":{},\"analysis_ms\":{},\"centers\":{:?}}},",
            method.name(),
            result.method,
            result.threshold,
            result.no_signal,
            result.review_reasons,
            result.centers.len() / 2,
            result.sensitivity_low_count,
            result.sensitivity_high_count,
            start.elapsed().as_secs_f64() * 1000.0,
            result.centers,
        );
    }
    for (index, threshold) in [0.1, 0.12].into_iter().enumerate() {
        let start = Instant::now();
        let centers = prepared.detect_core(10.0, 4.0, threshold)?;
        println!(
            "{{\"selector\":\"fixed_{threshold:.5}\",\"threshold\":{threshold:.5},\"count\":{},\"analysis_ms\":{},\"centers\":{:?}}}{}",
            centers.len() / 2,
            start.elapsed().as_secs_f64() * 1000.0,
            centers,
            if index == 0 { "," } else { "" },
        );
    }
    println!("]}}");
    Ok(())
}
