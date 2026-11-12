//! Native byte-for-byte probe for the browser blob-feature export.

use std::{env, fs};

use cell_detector::measure_blobs_core;

fn main() -> Result<(), String> {
    let arguments: Vec<String> = env::args().collect();
    if arguments.len() != 5 {
        return Err("usage: blob_features_probe MASK OUTPUT WIDTH HEIGHT".into());
    }
    let mask = fs::read(&arguments[1]).map_err(|error| format!("cannot read mask: {error}"))?;
    let width = arguments[3]
        .parse::<u32>()
        .map_err(|error| format!("invalid width: {error}"))?;
    let height = arguments[4]
        .parse::<u32>()
        .map_err(|error| format!("invalid height: {error}"))?;
    let values = measure_blobs_core(&mask, width, height)?;
    let bytes: Vec<u8> = values
        .iter()
        .flat_map(|value| value.to_le_bytes())
        .collect();
    fs::write(&arguments[2], bytes).map_err(|error| format!("cannot write output: {error}"))
}
