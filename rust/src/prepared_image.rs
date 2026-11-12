use image::{ImageBuffer, Luma};
use wasm_bindgen::prelude::*;

use crate::{dog_response, find_centers, red_signal, validate_image, validate_settings};

/// One validated image, owned by Rust for the lifetime of a comparison worker.
#[wasm_bindgen]
pub struct PreparedImage {
    signal: ImageBuffer<Luma<f32>, Vec<f32>>,
    response: Vec<f32>,
    scales: Option<(f32, f32)>,
}

impl PreparedImage {
    pub fn from_rgba(rgba: &[u8], width: u32, height: u32) -> Result<Self, String> {
        validate_image(rgba, width, height)?;
        Ok(Self {
            signal: red_signal(rgba, width, height),
            response: Vec::new(),
            scales: None,
        })
    }

    pub fn detect_core(
        &mut self,
        diameter: f32,
        k: f32,
        threshold: f32,
    ) -> Result<Vec<f32>, String> {
        validate_settings(diameter, k, threshold)?;
        if self.scales != Some((diameter, k)) {
            // Release the previous response before allocating the next blur's buffers.
            self.response = Vec::new();
            self.scales = None;
            self.response = dog_response(&self.signal, diameter, k)?;
            self.scales = Some((diameter, k));
        }
        Ok(find_centers(
            &self.response,
            self.signal.width(),
            self.signal.height(),
            diameter,
            threshold,
        ))
    }
}

#[wasm_bindgen]
impl PreparedImage {
    #[wasm_bindgen(constructor)]
    pub fn new(rgba: &[u8], width: u32, height: u32) -> Result<PreparedImage, JsValue> {
        Self::from_rgba(rgba, width, height).map_err(|error| JsValue::from_str(&error))
    }

    pub fn detect(&mut self, diameter: f32, k: f32, threshold: f32) -> Result<Vec<f32>, JsValue> {
        self.detect_core(diameter, k, threshold)
            .map_err(|error| JsValue::from_str(&error))
    }
}
