use crate::find_centers;

const BINS: usize = 256;
const MINIMUM_THRESHOLD: f64 = 0.00002;
pub const AUTOMATIC_VERSION: &str = "automatic-dog-1";

#[derive(Clone, Copy, Debug)]
pub enum ThresholdMethod {
    BinaryOtsu,
    Li,
    MultiOtsu,
}

impl ThresholdMethod {
    pub fn name(self) -> &'static str {
        match self {
            Self::BinaryOtsu => "binary_otsu",
            Self::Li => "li",
            Self::MultiOtsu => "multi_otsu",
        }
    }
}

/// Original-pixel centers and the actual scalar cutoff, with observable diagnostic reasons.
pub struct AutomaticDetection {
    pub centers: Vec<f32>,
    pub threshold: f32,
    pub no_signal: bool,
    pub method: &'static str,
    pub review_reasons: Vec<String>,
    pub sensitivity_low_count: usize,
    pub sensitivity_high_count: usize,
}

struct Histogram {
    counts: [f64; BINS],
    minimum: f64,
    bin_width: f64,
}

impl Histogram {
    fn from_response(response: &[f32]) -> Result<Self, &'static str> {
        let (mut minimum, mut maximum) = (f64::INFINITY, f64::NEG_INFINITY);
        for &value in response {
            if !value.is_finite() {
                return Err("nonfinite_response");
            }
            if value > 0.0 {
                minimum = minimum.min(value as f64);
                maximum = maximum.max(value as f64);
            }
        }
        if !minimum.is_finite() {
            return Err("no_positive_response");
        }
        if maximum <= minimum {
            return Err("uniform_positive_response");
        }
        let mut histogram = Self {
            counts: [0.0; BINS],
            minimum,
            bin_width: (maximum - minimum) / BINS as f64,
        };
        for &value in response {
            if value > 0.0 {
                let bin = (((value as f64 - minimum) / histogram.bin_width) as usize).min(BINS - 1);
                histogram.counts[bin] += 1.0;
            }
        }
        Ok(histogram)
    }

    fn center(&self, bin: usize) -> f64 {
        self.minimum + (bin as f64 + 0.5) * self.bin_width
    }

    fn cumulative(&self) -> ([f64; BINS + 1], [f64; BINS + 1]) {
        let (mut counts, mut sums) = ([0.0; BINS + 1], [0.0; BINS + 1]);
        for bin in 0..BINS {
            counts[bin + 1] = counts[bin] + self.counts[bin];
            sums[bin + 1] = sums[bin] + self.counts[bin] * self.center(bin);
        }
        (counts, sums)
    }

    fn otsu(&self, three_classes: bool) -> Option<f64> {
        let (counts, sums) = self.cumulative();
        let class_score = |start: usize, end: usize| {
            let count = counts[end] - counts[start];
            let sum = sums[end] - sums[start];
            (count > 0.0).then_some(sum * sum / count)
        };
        let mut best = None;
        let mut best_score = f64::NEG_INFINITY;
        // Ascending splits and strict improvement keep the lowest split on exact ties.
        for first in 1..BINS {
            let Some(low_score) = class_score(0, first) else {
                continue;
            };
            if three_classes {
                for second in first + 1..BINS {
                    if let (Some(middle), Some(high)) =
                        (class_score(first, second), class_score(second, BINS))
                    {
                        let score = low_score + middle + high;
                        if score > best_score {
                            best_score = score;
                            best = Some(self.center(first - 1));
                        }
                    }
                }
            } else if let Some(high) = class_score(first, BINS) {
                let score = low_score + high;
                if score > best_score {
                    best_score = score;
                    best = Some(self.center(first - 1));
                }
            }
        }
        best
    }

    fn li(&self) -> Result<f64, &'static str> {
        let (counts, sums) = self.cumulative();
        let mut threshold = sums[BINS] / counts[BINS];
        for _ in 0..100 {
            let split = (0..BINS)
                .take_while(|&bin| self.center(bin) <= threshold)
                .count();
            let low_count = counts[split];
            let high_count = counts[BINS] - low_count;
            if low_count <= 0.0 || high_count <= 0.0 {
                return Err("li_empty_partition");
            }
            let low_mean = sums[split] / low_count;
            let high_mean = (sums[BINS] - sums[split]) / high_count;
            let next = (low_mean - high_mean) / (low_mean.ln() - high_mean.ln());
            if !next.is_finite() || next <= 0.0 {
                return Err("li_invalid_iteration");
            }
            let next_split = (0..BINS)
                .take_while(|&bin| self.center(bin) <= next)
                .count();
            if next_split == 0 || next_split == BINS {
                return Err("li_empty_partition");
            }
            if next_split == split || (next - threshold).abs() <= self.bin_width / 2.0 {
                return Ok(next);
            }
            threshold = next;
        }
        Err("li_iteration_limit")
    }
}

fn rounded_threshold(threshold: f64) -> f32 {
    ((threshold * 100_000.0).round() / 100_000.0).max(MINIMUM_THRESHOLD) as f32
}

pub(crate) fn analyze(
    response: &[f32],
    width: u32,
    height: u32,
    diameter: f32,
    requested: ThresholdMethod,
) -> AutomaticDetection {
    let mut result = AutomaticDetection {
        centers: Vec::new(),
        threshold: MINIMUM_THRESHOLD as f32,
        no_signal: false,
        method: requested.name(),
        review_reasons: vec!["provisional_calibration".into()],
        sensitivity_low_count: 0,
        sensitivity_high_count: 0,
    };
    let histogram = match Histogram::from_response(response) {
        Ok(histogram) => histogram,
        Err(reason) => {
            result.no_signal = true;
            let maximum = response
                .iter()
                .copied()
                .filter(|value| value.is_finite())
                .fold(0.0_f32, f32::max);
            result.threshold = (((maximum as f64 * 100_000.0).floor() + 1.0) / 100_000.0)
                .max(MINIMUM_THRESHOLD) as f32;
            result.review_reasons.push(reason.into());
            return result;
        }
    };
    let selected = match requested {
        ThresholdMethod::BinaryOtsu => histogram.otsu(false).ok_or("otsu_empty_partition"),
        ThresholdMethod::Li => histogram.li(),
        ThresholdMethod::MultiOtsu => histogram.otsu(true).ok_or("multi_otsu_empty_partition"),
    };
    let raw_threshold = match selected {
        Ok(threshold) => threshold,
        Err(reason) => {
            result.review_reasons.push(reason.into());
            if let Some(threshold) = histogram.otsu(false) {
                result.method = ThresholdMethod::BinaryOtsu.name();
                result
                    .review_reasons
                    .push("same_image_binary_otsu_fallback".into());
                threshold
            } else {
                result.review_reasons.push("otsu_empty_partition".into());
                return result;
            }
        }
    };
    let threshold = rounded_threshold(raw_threshold);
    if raw_threshold < MINIMUM_THRESHOLD {
        result
            .review_reasons
            .push("threshold_precision_limited".into());
    }
    result.threshold = threshold;
    result.centers = find_centers(response, width, height, diameter, threshold);
    result.sensitivity_low_count = find_centers(
        response,
        width,
        height,
        diameter,
        rounded_threshold(threshold as f64 * 0.9),
    )
    .len()
        / 2;
    result.sensitivity_high_count = find_centers(
        response,
        width,
        height,
        diameter,
        rounded_threshold(threshold as f64 * 1.1),
    )
    .len()
        / 2;
    let count = result.centers.len() / 2;
    if count == 0 {
        result.review_reasons.push("no_detections".into());
    }
    if result
        .sensitivity_low_count
        .abs_diff(count)
        .max(result.sensitivity_high_count.abs_diff(count)) as f64
        > count.max(1) as f64 * 0.1
    {
        result.review_reasons.push("threshold_sensitive".into());
    }
    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn selectors_split_modes_and_multi_otsu_uses_lower_split() {
        let response = [vec![0.01; 100], vec![0.1; 100], vec![0.4; 100]].concat();
        let histogram = Histogram::from_response(&response).unwrap();
        let binary = histogram.otsu(false).unwrap();
        let multi = histogram.otsu(true).unwrap();
        assert!(binary > 0.09 && binary < 0.11);
        assert!(multi > 0.01 && multi < 0.012);
        assert!(histogram.li().unwrap() > 0.01);
    }

    #[test]
    fn binary_otsu_keeps_lowest_split_on_equal_objective() {
        let mut histogram = Histogram {
            counts: [0.0; BINS],
            minimum: 0.5,
            bin_width: 1.0,
        };
        histogram.counts[..3].fill(1.0);
        assert_eq!(histogram.otsu(false), Some(1.0));
    }

    #[test]
    fn automatic_centers_are_the_manual_detector_at_the_reported_cutoff() {
        let mut rgba = vec![0; 48 * 48 * 4];
        for y in 20..27 {
            for x in 20..27 {
                rgba[(y * 48 + x) * 4] = 255;
            }
        }
        let mut prepared = crate::PreparedImage::from_rgba(&rgba, 48, 48).unwrap();
        let result = prepared
            .automatic_core(ThresholdMethod::BinaryOtsu, 10.0, 4.0)
            .unwrap();
        assert!(!result.no_signal);
        assert_eq!(
            result.centers,
            crate::detect_core(&rgba, 48, 48, 10.0, 4.0, result.threshold).unwrap()
        );
        assert_eq!(result.centers.len(), 2);
    }

    #[test]
    fn two_modes_fall_back_from_three_classes_on_same_histogram() {
        let response = [0.01, 0.4];
        let result = analyze(&response, 2, 1, 10.0, ThresholdMethod::MultiOtsu);
        assert_eq!(result.method, "binary_otsu");
        assert!(
            result
                .review_reasons
                .iter()
                .any(|reason| reason == "same_image_binary_otsu_fallback")
        );
        assert_eq!(
            result.threshold,
            analyze(&response, 2, 1, 10.0, ThresholdMethod::BinaryOtsu).threshold
        );
    }

    #[test]
    fn degenerate_and_precision_limited_responses_are_explicit() {
        for (response, reason) in [
            (vec![0.0; 4], "no_positive_response"),
            (vec![0.1; 4], "uniform_positive_response"),
            (vec![f32::NAN; 4], "nonfinite_response"),
        ] {
            let result = analyze(&response, 2, 2, 10.0, ThresholdMethod::Li);
            assert!(result.no_signal);
            assert!(result.threshold > 0.00001);
            assert!(find_centers(&response, 2, 2, 10.0, result.threshold).is_empty());
            assert!(result.centers.is_empty());
            assert_eq!(result.review_reasons, ["provisional_calibration", reason]);
        }
        let result = analyze(
            &[0.000001, 0.000002],
            2,
            1,
            10.0,
            ThresholdMethod::BinaryOtsu,
        );
        assert_eq!(result.threshold, 0.00002);
        assert!(result.centers.is_empty());
        assert!(
            result
                .review_reasons
                .iter()
                .any(|reason| reason == "threshold_precision_limited")
        );
    }
}
