"""Portable, experimental blob decisions from a native DoG map and baseline picks."""

# Standard Library
import math

# PIP3 modules
import numpy
import scipy.ndimage

# Local repo modules
import measure_blob_areas


POLICIES = ("P", "L", "LS", "LSC", "LSI", "LSCI")
CONNECTIVITY = numpy.ones((3, 3), dtype=numpy.uint8)


#============================================
def rounded_cutoff(value: float) -> float:
	"""Use the detector's five-decimal setting before float32 comparison."""
	cutoff = round(float(value), 5)
	if not math.isfinite(cutoff) or cutoff <= 0.00001:
		raise ValueError("cutoff must be finite and greater than 0.00001 after rounding")
	return cutoff


#============================================
def geometry(mask: numpy.ndarray) -> dict:
	"""Measure a nonempty binary blob using the existing Appion-style helper."""
	compactness, inertia = measure_blob_areas.shape(mask)
	if inertia is not None and not math.isfinite(inertia):
		inertia = None
	result = {
		"area_px": int(mask.sum()),
		"compactness": compactness,
		"inertia_ratio": inertia,
		"inertia_eligible": inertia is not None,
	}
	return result


#============================================
class PreparedBlobs:
	"""Reuse per-image parent geometry and local threshold trees across policies."""

	def __init__(self, response: numpy.ndarray, centers: numpy.ndarray,
		threshold: float, diameter: float) -> None:
		self.response = response
		self.baseline_centers = centers.copy()
		self.threshold = threshold
		self.diameter = diameter
		self.labels, count = scipy.ndimage.label(
			response >= numpy.float32(threshold), structure=CONNECTIVITY,
		)
		self.center_labels = self.labels[centers[:, 1], centers[:, 0]]
		if numpy.any(self.center_labels == 0):
			raise ValueError("baseline centers must belong to the baseline threshold mask")
		counts = numpy.bincount(self.center_labels, minlength=count + 1)
		self.parents = []
		self._slices = scipy.ndimage.find_objects(self.labels)
		for parent_id, bounds in enumerate(self._slices, 1):
			rows, columns = bounds
			parent = {
				"parent_id": parent_id,
				"bounds": [columns.start, rows.start, columns.stop, rows.stop],
				**geometry(self.labels[bounds] == parent_id),
				"before_count": int(counts[parent_id]),
			}
			self.parents.append(parent)
		reference = [parent["area_px"] for parent in self.parents if parent["before_count"] == 1]
		self.reference_area = float(numpy.median(reference)) if reference else None
		self.area_min = self.reference_area * 0.5 if reference else None
		self.area_max = self.reference_area * 2.0 if reference else None
		self._high = {}
		self._low = {}

	def _high_levels(self, parent: dict) -> list[dict]:
		"""Label only inside the original parent; cache its bounded threshold tree."""
		parent_id = parent["parent_id"]
		if parent_id in self._high:
			return self._high[parent_id]
		bounds = self._slices[parent_id - 1]
		parent_mask = self.labels[bounds] == parent_id
		response = self.response[bounds]
		cutoffs = sorted({rounded_cutoff(self.threshold * factor)
			for factor in (1.25, 1.5, 2.0, 3.0, 4.0)})
		levels = []
		for cutoff in cutoffs:
			labels, count = scipy.ndimage.label(
				parent_mask & (response >= numpy.float32(cutoff)), structure=CONNECTIVITY,
			)
			children = []
			for child_id, child_bounds in enumerate(scipy.ndimage.find_objects(labels), 1):
				child_mask = labels[child_bounds] == child_id
				children.append({"child_id": child_id, **geometry(child_mask)})
			levels.append({"threshold": cutoff, "labels": labels,
				"count": count, "children": children})
		self._high[parent_id] = levels
		return levels

	def _low_level(self, cutoff: float) -> dict:
		"""Associate globally grown components with all original baseline parents."""
		if cutoff in self._low:
			return self._low[cutoff]
		labels, count = scipy.ndimage.label(
			self.response >= numpy.float32(cutoff), structure=CONNECTIVITY,
		)
		areas = numpy.bincount(labels.ravel(), minlength=count + 1)
		original = self.labels > 0
		low_ids = labels[original]
		parent_ids = self.labels[original]
		minimum = numpy.full(count + 1, len(self.parents) + 1, dtype=numpy.int32)
		maximum = numpy.zeros(count + 1, dtype=numpy.int32)
		numpy.minimum.at(minimum, low_ids, parent_ids)
		numpy.maximum.at(maximum, low_ids, parent_ids)
		result = {"labels": labels, "areas": areas, "minimum": minimum, "maximum": maximum,
			"bounds": scipy.ndimage.find_objects(labels)}
		self._low[cutoff] = result
		return result

	def _small(self, parent: dict, decision: dict) -> tuple[dict | None, bool]:
		"""Grow a uniquely owned small parent, or reject only persistent smallness."""
		parent_id = parent["parent_id"]
		rows, columns = self._slices[parent_id - 1]
		first_y, first_x = numpy.argwhere(self.labels[rows, columns] == parent_id)[0]
		y, x = int(first_y) + rows.start, int(first_x) + columns.start
		examined = []
		cutoffs = sorted({round(self.threshold * factor, 5) for factor in (0.75, 0.5)},
			reverse=True)
		cutoffs = [cutoff for cutoff in cutoffs if 0.00001 < cutoff < self.threshold]
		decision["thresholds_examined"] = examined
		for cutoff in cutoffs:
			level = self._low_level(cutoff)
			label = int(level["labels"][y, x])
			area = int(level["areas"][label])
			examined.append(cutoff)
			decision["thresholds_examined"] = examined.copy()
			if level["minimum"][label] != parent_id or level["maximum"][label] != parent_id:
				decision.update(action="unresolved", reason="small_parent_merge")
				return None, False
			if area > self.area_max:
				decision.update(action="unresolved", reason="small_parent_overshoot")
				return None, False
			if area >= self.area_min:
				decision.update(action="grown", reason="unique_expected_area", threshold=cutoff)
				bounds = level["bounds"][label - 1]
				return {"bounds": bounds, "mask": level["labels"][bounds] == label}, False
		if len(cutoffs) < 2:
			decision.update(action="unresolved", reason="threshold_floor")
			return None, False
		decision.update(action="rejected", reason="persistently_small", after_count=0)
		return None, True

	def _acceptable(self, children: list[dict], compactness: bool, inertia: bool) -> bool:
		"""Require plausible first-level areas and every enabled shape measurement."""
		if not children:
			return False
		for child in children:
			if not self.area_min <= child["area_px"] <= self.area_max:
				return False
			if compactness and child["compactness"] < 0.8:
				return False
			if inertia and (not child["inertia_eligible"] or child["inertia_ratio"] > 2.0):
				return False
		return True

	def _persistent(self, current: dict, following: dict) -> bool:
		"""Match each next-level child to exactly one surviving current child."""
		if current["count"] != following["count"] or current["count"] == 0:
			return False
		owners = []
		for child_id in range(1, following["count"] + 1):
			parents = numpy.unique(current["labels"][following["labels"] == child_id])
			if len(parents) != 1 or parents[0] == 0:
				return False
			owners.append(int(parents[0]))
		return len(set(owners)) == current["count"]

	def _replace(self, parent: dict, decision: dict,
		compactness: bool, inertia: bool) -> tuple[numpy.ndarray | None, list[list[int]]]:
		"""Select the lowest plausible level with one-to-one next-level containment."""
		levels = self._high_levels(parent)
		bounds = self._slices[parent["parent_id"] - 1]
		response = self.response[bounds]
		for index, level in enumerate(levels[:-1]):
			decision["thresholds_examined"] = [item["threshold"] for item in levels[:index + 2]]
			if not self._acceptable(level["children"], compactness, inertia):
				continue
			if not self._persistent(level, levels[index + 1]):
				continue
			centers = []
			for child_id in range(1, level["count"] + 1):
				indices = numpy.flatnonzero(level["labels"] == child_id)
				best = indices[numpy.argmax(response.ravel()[indices])]
				y, x = numpy.unravel_index(best, response.shape)
				centers.append([int(x) + bounds[1].start, int(y) + bounds[0].start])
			decision.update(action="replaced", reason="plausible_persistent_children",
				after_count=len(centers), threshold=level["threshold"])
			return level["labels"] > 0, centers
		decision.update(action="unresolved", reason="no_plausible_persistent_level")
		return None, []

	def analyze(self, policy: str) -> dict:
		"""Apply one frozen policy without filenames, references, or changing A0."""
		if policy not in POLICIES:
			raise ValueError(f"unknown blob policy: {policy}")
		mask = self.labels > 0
		keep = numpy.ones(len(self.baseline_centers), dtype=bool)
		added = []
		decisions = []
		for parent in self.parents:
			parent_id = parent["parent_id"]
			decision = {**parent, "after_count": parent["before_count"], "action": "retained",
				"threshold": self.threshold, "reason": "baseline_policy"}
			decisions.append(decision)
			if policy == "P":
				continue
			if self.reference_area is None:
				decision["reason"] = "insufficient_size_reference"
				continue
			bounds = self._slices[parent_id - 1]
			if parent["area_px"] < self.area_min and "S" in policy:
				grown, reject = self._small(parent, decision)
				if grown is not None:
					mask[grown["bounds"]] |= grown["mask"]
				if reject:
					mask[bounds] &= self.labels[bounds] != parent_id
					keep[self.center_labels == parent_id] = False
				continue
			large = parent["area_px"] > self.area_max
			bad_compactness = "C" in policy and parent["compactness"] < 0.8
			bad_inertia = ("I" in policy and parent["inertia_eligible"]
				and parent["inertia_ratio"] > 2.0)
			if not (large or bad_compactness or bad_inertia):
				decision["reason"] = "small_policy_disabled" if parent["area_px"] < self.area_min else "normal_parent"
				continue
			decision["trigger"] = "large" if large else "shape"
			replacement, centers = self._replace(parent, decision, "C" in policy, "I" in policy)
			if replacement is not None:
				mask[bounds] &= self.labels[bounds] != parent_id
				mask[bounds] |= replacement
				keep[self.center_labels == parent_id] = False
				added.extend(centers)
		centers = self.baseline_centers[keep]
		if added:
			centers = numpy.concatenate((centers, numpy.asarray(added, dtype=numpy.int32)))
		result = {"centers": centers, "mask": mask.astype(numpy.uint8) * 255,
			"decisions": decisions, "reference_area": self.reference_area,
			"area_min": self.area_min, "area_max": self.area_max}
		return result


#============================================
def prepare_response(response: numpy.ndarray, baseline_centers: numpy.ndarray,
	threshold: float, diameter: float = 10.0) -> PreparedBlobs:
	"""Freeze baseline components and their one-pick median area for one response."""
	response = numpy.asarray(response, dtype=numpy.float32)
	centers = numpy.asarray(baseline_centers)
	if response.ndim != 2 or response.size == 0 or not numpy.all(numpy.isfinite(response)):
		raise ValueError("response must be a nonempty finite 2D array")
	if centers.ndim != 2 or centers.shape[1] != 2 or not numpy.issubdtype(centers.dtype, numpy.integer):
		raise ValueError("baseline centers must be an (N, 2) integer xy array")
	if (numpy.any(centers < 0) or numpy.any(centers[:, 0] >= response.shape[1])
		or numpy.any(centers[:, 1] >= response.shape[0])):
		raise ValueError("baseline centers must be inside the response")
	diameter = round(float(diameter), 2)
	if not math.isfinite(diameter) or diameter <= 0:
		raise ValueError("diameter must be finite and positive")
	prepared = PreparedBlobs(response, centers.astype(numpy.int32), rounded_cutoff(threshold), diameter)
	return prepared
