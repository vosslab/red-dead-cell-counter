use image::{ImageBuffer, Luma};
use wasm_bindgen::prelude::*;

use crate::{
    AutomaticDetection, ThresholdMethod, dog_response, find_centers, red_signal, validate_image,
    validate_settings,
};

/// One validated image, owned by Rust for the lifetime of a comparison worker.
#[wasm_bindgen]
pub struct PreparedImage {
    signal: ImageBuffer<Luma<f32>, Vec<f32>>,
    response: Vec<f32>,
    scales: Option<(f32, f32)>,
}

/// Owned automatic result; browser callers read its metadata and then free it.
#[wasm_bindgen]
pub struct AutomaticResult {
    detection: AutomaticDetection,
}

/// Owned detailed component measurements; browser callers read its arrays and free it.
#[wasm_bindgen(js_name = ObjectMeasurements)]
pub struct ObjectMeasurementsResult {
    measurements: crate::ObjectMeasurements,
}

#[wasm_bindgen(js_class = ObjectMeasurements)]
impl ObjectMeasurementsResult {
    pub fn features(&self) -> Vec<f64> {
        self.measurements.features.clone()
    }

    pub fn center_components(&self) -> Vec<u32> {
        self.measurements.center_components.clone()
    }
}

#[wasm_bindgen]
impl AutomaticResult {
    pub fn centers(&self) -> Vec<f32> {
        self.detection.centers.clone()
    }

    pub fn threshold(&self) -> f32 {
        self.detection.threshold
    }

    pub fn method(&self) -> String {
        self.detection.method.into()
    }

    pub fn version(&self) -> String {
        crate::AUTOMATIC_VERSION.into()
    }

    pub fn review_reasons(&self) -> Vec<String> {
        self.detection.review_reasons.clone()
    }

    pub fn no_signal(&self) -> bool {
        self.detection.no_signal
    }
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
        self.response_core(diameter, k)?;
        Ok(find_centers(
            &self.response,
            self.signal.width(),
            self.signal.height(),
            diameter,
            threshold,
        ))
    }

    /// Measure the final raw-response threshold mask, restoring its scales if trials changed them.
    pub fn object_measurements_core(
        &mut self,
        diameter: f32,
        k: f32,
        threshold: f32,
        centers: &[f32],
    ) -> Result<crate::ObjectMeasurements, String> {
        validate_settings(diameter, k, threshold)?;
        let (width, height) = self.signal.dimensions();
        let mask: Vec<u8> = self
            .response_core(diameter, k)?
            .iter()
            .map(|&response| u8::from(response >= threshold))
            .collect();
        crate::measure_objects_core(&mask, width, height, centers)
    }

    /// Borrow the same raw response used by manual detection, caching only its latest scales.
    pub fn response_core(&mut self, diameter: f32, k: f32) -> Result<&[f32], String> {
        validate_settings(diameter, k, 0.00002)?;
        if self.scales != Some((diameter, k)) {
            // Release the previous response before allocating the next blur's buffers.
            self.response = Vec::new();
            self.scales = None;
            self.response = dog_response(&self.signal, diameter, k)?;
            self.scales = Some((diameter, k));
        }
        Ok(&self.response)
    }

    /// Analyze one image independently with an image-derived raw-response cutoff.
    pub fn automatic_core(
        &mut self,
        method: ThresholdMethod,
        diameter: f32,
        k: f32,
    ) -> Result<AutomaticDetection, String> {
        let (width, height) = self.signal.dimensions();
        let response = self.response_core(diameter, k)?;
        Ok(crate::automatic_threshold::analyze(
            response, width, height, diameter, method,
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

    pub fn measure_objects(
        &mut self,
        diameter: f32,
        k: f32,
        threshold: f32,
        centers: &[f32],
    ) -> Result<ObjectMeasurementsResult, JsValue> {
        self.object_measurements_core(diameter, k, threshold, centers)
            .map(|measurements| ObjectMeasurementsResult { measurements })
            .map_err(|error| JsValue::from_str(&error))
    }

    /// The selected global rule fits an independent cutoff from this image only.
    pub fn automatic(&mut self, diameter: f32, k: f32) -> Result<AutomaticResult, JsValue> {
        self.automatic_core(ThresholdMethod::BinaryOtsu, diameter, k)
            .map(|detection| AutomaticResult { detection })
            .map_err(|error| JsValue::from_str(&error))
    }
}
