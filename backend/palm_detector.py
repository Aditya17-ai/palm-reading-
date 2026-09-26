"""
Palm Detector & Preprocessing Module
Performs hand segmentation, palm center localization via distance transform,
Region of Interest (ROI) cropping, orientation alignment, handedness detection,
and real-time palm crease line tracking.
"""

import cv2
import numpy as np
from typing import Tuple, Dict, Any, Optional, List


def smooth_points(pts: List[List[int]], window_size: int = 5) -> List[List[int]]:
    """Applies a moving average filter to smooth detected crease trajectories."""
    if len(pts) <= window_size:
        return pts
    arr = np.array(pts, dtype=np.float32)
    smoothed = []
    half = window_size // 2
    for i in range(len(arr)):
        i_min = max(0, i - half)
        i_max = min(len(arr), i + half + 1)
        smoothed.append([
            int(round(float(np.mean(arr[i_min:i_max, 0])))),
            int(round(float(np.mean(arr[i_min:i_max, 1]))))
        ])
    return smoothed


class PalmDetector:
    def __init__(self):
        # Target normalized palm size for deep processing
        self.target_size = (512, 512)

        # Canonical colors for Chirological visualization (BGR)
        self.line_colors = {
            "Heart": [235, 45, 110],   # Crimson / Deep Rose
            "Head": [50, 165, 250],    # Bright Azure
            "Life": [45, 215, 85],     # Emerald Green
            "Fate": [245, 195, 45],    # Radiant Gold
        }

    def segment_hand(
        self, image: np.ndarray, target_center: Optional[Tuple[int, int]] = None
    ) -> Tuple[np.ndarray, Optional[np.ndarray]]:
        """
        Segments the hand from background using a combination of YCrCb and HSV skin masks
        with morphological cleanup. When target_center is provided, contours closest
        to the target are preferred over background objects or faces.
        """
        # Convert color spaces
        ycrcb = cv2.cvtColor(image, cv2.COLOR_BGR2YCrCb)
        hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)

        # Skin color boundaries in YCrCb and HSV (broad to handle diverse skin tones)
        mask_ycrcb = cv2.inRange(ycrcb, np.array([0, 133, 77]), np.array([255, 175, 127]))
        mask_hsv = cv2.inRange(hsv, np.array([0, 20, 50]), np.array([30, 255, 255]))
        mask_hsv_alt = cv2.inRange(hsv, np.array([165, 20, 50]), np.array([180, 255, 255]))

        skin_mask = cv2.bitwise_or(mask_ycrcb, cv2.bitwise_or(mask_hsv, mask_hsv_alt))

        # Morphological operations to remove noise and fill holes
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
        skin_mask = cv2.morphologyEx(skin_mask, cv2.MORPH_OPEN, kernel, iterations=2)
        skin_mask = cv2.morphologyEx(skin_mask, cv2.MORPH_CLOSE, kernel, iterations=3)
        skin_mask = cv2.GaussianBlur(skin_mask, (5, 5), 0)
        _, skin_mask = cv2.threshold(skin_mask, 127, 255, cv2.THRESH_BINARY)

        # Find contours
        contours, _ = cv2.findContours(skin_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if not contours:
            # Fallback: Otsu thresholding on grayscale
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            blurred = cv2.GaussianBlur(gray, (7, 7), 0)
            _, skin_mask = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
            contours, _ = cv2.findContours(skin_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            if not contours:
                return skin_mask, None

        img_area = image.shape[0] * image.shape[1]
        valid_contours = [c for c in contours if cv2.contourArea(c) >= 0.02 * img_area]

        if not valid_contours:
            largest = max(contours, key=cv2.contourArea)
            if cv2.contourArea(largest) >= 0.015 * img_area:
                valid_contours = [largest]
            else:
                return skin_mask, None

        # If target_center is provided, prioritize contour overlapping or nearest to target
        if target_center and len(valid_contours) > 1:
            tx, ty = target_center
            def contour_priority(c):
                area = cv2.contourArea(c)
                M = cv2.moments(c)
                if M["m00"] > 0:
                    cx = M["m10"] / M["m00"]
                    cy = M["m01"] / M["m00"]
                    dist = float(np.hypot(cx - tx, cy - ty))
                    return area / (1.0 + (dist / 120.0) ** 2)
                return area
            chosen_contour = max(valid_contours, key=contour_priority)
        else:
            chosen_contour = max(valid_contours, key=cv2.contourArea)

        # Create cleaned hand mask
        cleaned_mask = np.zeros_like(skin_mask)
        cv2.drawContours(cleaned_mask, [chosen_contour], -1, 255, thickness=cv2.FILLED)
        return cleaned_mask, chosen_contour

    def find_palm_center_and_radius(self, hand_mask: np.ndarray) -> Tuple[Tuple[int, int], float]:
        """
        Uses Distance Transform to find the center of the maximum inscribed circle,
        which corresponds precisely to the palm center.
        """
        dist_transform = cv2.distanceTransform(hand_mask, cv2.DIST_L2, 5)
        min_val, max_val, min_loc, max_loc = cv2.minMaxLoc(dist_transform)
        center = max_loc
        radius = float(max_val)
        return center, radius

    def detect_thumb_side(
        self, contour: np.ndarray, cx: int, cy: int, radius: float
    ) -> str:
        """
        Determines whether the thumb is on the 'left' or 'right' side of the palm
        by analyzing the horizontal extent of the hand contour around the thenar zone.
        """
        pts = contour.squeeze()
        if pts.ndim != 2 or len(pts) < 10:
            return "left"

        y_band = (pts[:, 1] >= cy - radius * 0.4) & (pts[:, 1] <= cy + radius * 0.8)
        band_pts = pts[y_band]
        if len(band_pts) == 0:
            return "left"

        min_x = np.min(band_pts[:, 0])
        max_x = np.max(band_pts[:, 0])
        left_ext = cx - min_x
        right_ext = max_x - cx

        # If left extent is noticeably larger, thumb is on left; else right
        if left_ext >= right_ext:
            return "left"
        return "right"

    def detect_hand_orientation(self, contour: np.ndarray) -> float:
        """
        Calculates the primary axis orientation angle (in degrees) using image moments.
        """
        moments = cv2.moments(contour)
        if moments["m00"] == 0:
            return 0.0

        mu20 = moments["mu20"] / moments["m00"]
        mu02 = moments["mu02"] / moments["m00"]
        mu11 = moments["mu11"] / moments["m00"]

        angle_rad = 0.5 * np.arctan2(2 * mu11, mu20 - mu02)
        angle_deg = np.degrees(angle_rad)
        return float(angle_deg)

    def extract_palm_roi(
        self, image: np.ndarray, center: Tuple[int, int], radius: float
    ) -> Tuple[np.ndarray, Dict[str, Any]]:
        """
        Crops and normalizes the palm Region of Interest (ROI) around the palm center.
        """
        h, w = image.shape[:2]
        cx, cy = center

        roi_half_size = int(max(radius * 1.35, 80))

        x1 = max(0, cx - roi_half_size)
        y1 = max(0, cy - roi_half_size)
        x2 = min(w, cx + roi_half_size)
        y2 = min(h, cy + roi_half_size)

        cropped = image[y1:y2, x1:x2]
        if cropped.size == 0:
            cropped = image

        normalized = cv2.resize(cropped, self.target_size, interpolation=cv2.INTER_LANCZOS4)

        roi_info = {
            "bbox": (x1, y1, x2 - x1, y2 - y1),
            "orig_center": center,
            "orig_radius": radius,
            "scale_x": self.target_size[0] / max(1, (x2 - x1)),
            "scale_y": self.target_size[1] / max(1, (y2 - y1)),
        }
        return normalized, roi_info

    def locate_palm_mounts(
        self, roi_size: Tuple[int, int] = (512, 512), thumb_side: str = "left"
    ) -> Dict[str, Dict[str, Any]]:
        """
        Locates the classical Chirological Palm Mounts within the ROI, adjusting for
        left vs. right thumb orientation.
        """
        w, h = roi_size
        if thumb_side == "left":
            mounts = {
                "Jupiter": {
                    "name": "Mount of Jupiter",
                    "meaning": "Leadership, ambition, spirituality, and wisdom",
                    "pos": (int(w * 0.28), int(h * 0.20)),
                    "radius": int(w * 0.08),
                    "element": "Ambition",
                },
                "Saturn": {
                    "name": "Mount of Saturn",
                    "meaning": "Discipline, balance, responsibility, and destiny",
                    "pos": (int(w * 0.46), int(h * 0.18)),
                    "radius": int(w * 0.08),
                    "element": "Focus",
                },
                "Apollo": {
                    "name": "Mount of Sun / Apollo",
                    "meaning": "Creativity, self-expression, success, and optimism",
                    "pos": (int(w * 0.64), int(h * 0.20)),
                    "radius": int(w * 0.08),
                    "element": "Vitality",
                },
                "Mercury": {
                    "name": "Mount of Mercury",
                    "meaning": "Communication, commerce, adaptability, and wit",
                    "pos": (int(w * 0.82), int(h * 0.26)),
                    "radius": int(w * 0.07),
                    "element": "Intellect",
                },
                "Mars_Inner": {
                    "name": "Inner Mars",
                    "meaning": "Physical courage, determination, and persistence",
                    "pos": (int(w * 0.22), int(h * 0.42)),
                    "radius": int(w * 0.07),
                    "element": "Courage",
                },
                "Mars_Outer": {
                    "name": "Outer Mars",
                    "meaning": "Moral courage, resilience, and calm under pressure",
                    "pos": (int(w * 0.80), int(h * 0.50)),
                    "radius": int(w * 0.07),
                    "element": "Resilience",
                },
                "Venus": {
                    "name": "Mount of Venus",
                    "meaning": "Love, vitality, sensuality, empathy, and artistic passion",
                    "pos": (int(w * 0.25), int(h * 0.72)),
                    "radius": int(w * 0.13),
                    "element": "Love & Passion",
                },
                "Luna": {
                    "name": "Mount of Luna / Moon",
                    "meaning": "Intuition, imagination, subconscious depth, and wanderlust",
                    "pos": (int(w * 0.78), int(h * 0.74)),
                    "radius": int(w * 0.12),
                    "element": "Intuition",
                },
            }
        else:
            # Mirrored mounts when thumb is on the right
            mounts = {
                "Jupiter": {
                    "name": "Mount of Jupiter",
                    "meaning": "Leadership, ambition, spirituality, and wisdom",
                    "pos": (int(w * 0.72), int(h * 0.20)),
                    "radius": int(w * 0.08),
                    "element": "Ambition",
                },
                "Saturn": {
                    "name": "Mount of Saturn",
                    "meaning": "Discipline, balance, responsibility, and destiny",
                    "pos": (int(w * 0.54), int(h * 0.18)),
                    "radius": int(w * 0.08),
                    "element": "Focus",
                },
                "Apollo": {
                    "name": "Mount of Sun / Apollo",
                    "meaning": "Creativity, self-expression, success, and optimism",
                    "pos": (int(w * 0.36), int(h * 0.20)),
                    "radius": int(w * 0.08),
                    "element": "Vitality",
                },
                "Mercury": {
                    "name": "Mount of Mercury",
                    "meaning": "Communication, commerce, adaptability, and wit",
                    "pos": (int(w * 0.18), int(h * 0.26)),
                    "radius": int(w * 0.07),
                    "element": "Intellect",
                },
                "Mars_Inner": {
                    "name": "Inner Mars",
                    "meaning": "Physical courage, determination, and persistence",
                    "pos": (int(w * 0.78), int(h * 0.42)),
                    "radius": int(w * 0.07),
                    "element": "Courage",
                },
                "Mars_Outer": {
                    "name": "Outer Mars",
                    "meaning": "Moral courage, resilience, and calm under pressure",
                    "pos": (int(w * 0.20), int(h * 0.50)),
                    "radius": int(w * 0.07),
                    "element": "Resilience",
                },
                "Venus": {
                    "name": "Mount of Venus",
                    "meaning": "Love, vitality, sensuality, empathy, and artistic passion",
                    "pos": (int(w * 0.75), int(h * 0.72)),
                    "radius": int(w * 0.13),
                    "element": "Love & Passion",
                },
                "Luna": {
                    "name": "Mount of Luna / Moon",
                    "meaning": "Intuition, imagination, subconscious depth, and wanderlust",
                    "pos": (int(w * 0.22), int(h * 0.74)),
                    "radius": int(w * 0.12),
                    "element": "Intuition",
                },
            }
        return mounts

    def classify_hand_shape(
        self, contour: np.ndarray, palm_radius: float, image_shape: Tuple[int, int]
    ) -> Dict[str, Any]:
        """
        Determines Hand Element Type (Earth, Air, Fire, Water) based on palm proportion
        and finger extension.
        """
        x, y, w, h = cv2.boundingRect(contour)
        aspect_ratio = float(w) / max(1, float(h))

        hull = cv2.convexHull(contour)
        contour_area = cv2.contourArea(contour)
        hull_area = cv2.contourArea(hull)
        solidity = contour_area / max(1.0, hull_area)

        if aspect_ratio >= 0.75:
            if solidity > 0.75:
                hand_type = "Earth"
                desc = "Earth Hand: Square, firm palm with grounded energy. Practicality, reliability, craftsmanship, and grounded wisdom."
                strengths = ["Pragmatic problem solver", "Strong stamina", "Dependable anchor for loved ones"]
            else:
                hand_type = "Air"
                desc = "Air Hand: Balanced palm with expressive fingers. Curiosity, eloquence, analytical brilliance, and continuous learning."
                strengths = ["Intellectual agility", "Gifted communicator", "Inventive visionary"]
        else:
            if solidity > 0.70:
                hand_type = "Fire"
                desc = "Fire Hand: Long, vibrant palm with dynamic posture. Boundless passion, charisma, adventurous spirit, and natural leadership."
                strengths = ["Charismatic motivator", "Fearless pioneer", "High creative drive"]
            else:
                hand_type = "Water"
                desc = "Water Hand: Graceful, slender palm with deep emotional currents. Profound intuition, empathetic perception, and artistic sensibility."
                strengths = ["Deep emotional intelligence", "Poetic imagination", "Natural healer & empath"]

        return {
            "type": hand_type,
            "description": desc,
            "aspect_ratio": round(aspect_ratio, 2),
            "solidity": round(solidity, 2),
            "strengths": strengths,
        }

    def extract_crease_lines(
        self,
        roi: np.ndarray,
        thumb_side: str = "left",
        eroded_mask: Optional[np.ndarray] = None,
        fast_mode: bool = True
    ) -> Dict[str, Dict[str, Any]]:
        """
        Extracts the 4 primary palm lines (Heart, Head, Life, Fate) directly from the
        actual skin creases in the ROI using multi-scale Black-Hat filtering and
        vectorized dynamic programming ridge tracking.
        """
        h, w = roi.shape[:2]
        if h == 0 or w == 0:
            return {}

        # 1. Crease enhancement via CLAHE and Morphological Black-Hat
        gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
        cl = cv2.createCLAHE(clipLimit=2.8, tileGridSize=(8, 8)).apply(gray)

        # Multi-scale Black-Hat filter
        k1 = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (13, 13))
        k2 = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
        bh1 = cv2.morphologyEx(cl, cv2.MORPH_BLACKHAT, k1)
        bh2 = cv2.morphologyEx(cl, cv2.MORPH_BLACKHAT, k2)
        crease_intensity = cv2.addWeighted(bh1, 0.65, bh2, 0.35, 0)

        # Mask out outer hand boundary if mask is provided
        if eroded_mask is not None:
            if eroded_mask.shape[:2] != (h, w):
                eroded_mask = cv2.resize(eroded_mask, (w, h), interpolation=cv2.INTER_NEAREST)
            crease_intensity = cv2.bitwise_and(crease_intensity, crease_intensity, mask=eroded_mask)

        norm_map = cv2.normalize(crease_intensity, None, 0, 255, cv2.NORM_MINMAX).astype(np.float32)

        # Step size for DP tracking
        step = 4 if fast_mode else 2

        # 2. Vectorized DP helpers for horizontal & vertical paths
        def dp_trace_horizontal(xs: List[int], y_min: int, y_max: int, penalty: float = 1.6) -> List[List[int]]:
            if len(xs) < 2:
                return []
            y_min = max(0, min(h - 2, y_min))
            y_max = max(y_min + 2, min(h, y_max))
            H_band = y_max - y_min
            valid_xs = [x for x in xs if 0 <= x < w]
            if len(valid_xs) < 2:
                return []

            cost_grid = -norm_map[y_min:y_max, valid_xs]
            dp = np.zeros_like(cost_grid)
            dp[:, 0] = cost_grid[:, 0]
            backtrack = np.zeros_like(cost_grid, dtype=np.int32)

            for c in range(1, len(valid_xs)):
                prev = dp[:, c - 1]
                s0 = prev
                s_m1 = np.pad(prev[:-1], (1, 0), constant_values=1e6) + penalty
                s_p1 = np.pad(prev[1:], (0, 1), constant_values=1e6) + penalty
                s_m2 = np.pad(prev[:-2], (2, 0), constant_values=1e6) + penalty * 2.2
                s_p2 = np.pad(prev[2:], (0, 2), constant_values=1e6) + penalty * 2.2
                stacked = np.stack([s_m2, s_m1, s0, s_p1, s_p2], axis=0)
                best_shift_idx = np.argmin(stacked, axis=0)
                dp[:, c] = np.take_along_axis(stacked, best_shift_idx[None, :], axis=0).squeeze() + cost_grid[:, c]
                backtrack[:, c] = np.clip(np.arange(H_band) + (best_shift_idx - 2), 0, H_band - 1)

            best_r = int(np.argmin(dp[:, -1]))
            pts = []
            for c in range(len(valid_xs) - 1, -1, -1):
                pts.append([int(valid_xs[c]), int(best_r + y_min)])
                best_r = int(backtrack[best_r, c])
            return pts[::-1]

        def dp_trace_vertical(ys: List[int], x_min: int, x_max: int, penalty: float = 1.8) -> List[List[int]]:
            if len(ys) < 2:
                return []
            x_min = max(0, min(w - 2, x_min))
            x_max = max(x_min + 2, min(w, x_max))
            W_band = x_max - x_min
            valid_ys = [y for y in ys if 0 <= y < h]
            if len(valid_ys) < 2:
                return []

            cost_grid = -norm_map[valid_ys, x_min:x_max].T
            dp = np.zeros_like(cost_grid)
            dp[:, 0] = cost_grid[:, 0]
            backtrack = np.zeros_like(cost_grid, dtype=np.int32)

            for c in range(1, len(valid_ys)):
                prev = dp[:, c - 1]
                s0 = prev
                s_m1 = np.pad(prev[:-1], (1, 0), constant_values=1e6) + penalty
                s_p1 = np.pad(prev[1:], (0, 1), constant_values=1e6) + penalty
                s_m2 = np.pad(prev[:-2], (2, 0), constant_values=1e6) + penalty * 2.2
                s_p2 = np.pad(prev[2:], (0, 2), constant_values=1e6) + penalty * 2.2
                stacked = np.stack([s_m2, s_m1, s0, s_p1, s_p2], axis=0)
                best_shift_idx = np.argmin(stacked, axis=0)
                dp[:, c] = np.take_along_axis(stacked, best_shift_idx[None, :], axis=0).squeeze() + cost_grid[:, c]
                backtrack[:, c] = np.clip(np.arange(W_band) + (best_shift_idx - 2), 0, W_band - 1)

            best_c = int(np.argmin(dp[:, -1]))
            pts = []
            for c in range(len(valid_ys) - 1, -1, -1):
                pts.append([int(best_c + x_min), int(valid_ys[c])])
                best_c = int(backtrack[best_c, c])
            return pts[::-1]

        # 3. Trace Heart Line
        if thumb_side == "left":
            xs_heart = list(range(int(0.85 * w), int(0.24 * w), -step))
            heart_pts = dp_trace_horizontal(xs_heart, int(0.18 * h), int(0.42 * h), penalty=1.6)
        else:
            xs_heart = list(range(int(0.15 * w), int(0.76 * w), step))
            heart_pts = dp_trace_horizontal(xs_heart, int(0.18 * h), int(0.42 * h), penalty=1.6)

        # 4. Trace Head Line
        if thumb_side == "left":
            xs_head = list(range(int(0.22 * w), int(0.80 * w), step))
            head_pts = dp_trace_horizontal(xs_head, int(0.35 * h), int(0.65 * h), penalty=1.8)
        else:
            xs_head = list(range(int(0.78 * w), int(0.20 * w), -step))
            head_pts = dp_trace_horizontal(xs_head, int(0.35 * h), int(0.65 * h), penalty=1.8)

        # 5. Trace Life Line (Arc around Mount of Venus)
        if thumb_side == "left":
            vx, vy = int(0.25 * w), int(0.72 * h)
            vr = int(0.18 * w)
            angles = np.linspace(-np.pi * 0.45, np.pi * 0.40, 36)
        else:
            vx, vy = int(0.75 * w), int(0.72 * h)
            vr = int(0.18 * w)
            angles = np.linspace(-np.pi * 0.55, -np.pi * 1.40, 36)

        life_pts = []
        radii = np.linspace(vr * 0.55, vr * 1.55, 26)
        for theta in angles:
            best_r = radii[0]
            best_val = -1.0
            for r in radii:
                px = int(vx + r * np.cos(theta))
                py = int(vy + r * np.sin(theta))
                if 0 <= px < w and 0 <= py < h:
                    val = float(norm_map[py, px])
                    if val > best_val:
                        best_val = val
                        best_r = r
            fx = int(np.clip(vx + best_r * np.cos(theta), 0, w - 1))
            fy = int(np.clip(vy + best_r * np.sin(theta), 0, h - 1))
            life_pts.append([fx, fy])

        # 6. Trace Fate Line (Ascending vertical trajectory)
        ys_fate = list(range(int(0.86 * h), int(0.28 * h), -step))
        fate_pts = dp_trace_vertical(ys_fate, int(0.40 * w), int(0.60 * w), penalty=2.0)

        # Smooth lines
        heart_pts = smooth_points(heart_pts, 5)
        head_pts = smooth_points(head_pts, 5)
        life_pts = smooth_points(life_pts, 5)
        fate_pts = smooth_points(fate_pts, 5)

        lines_dict = {
            "Heart": heart_pts,
            "Head": head_pts,
            "Life": life_pts,
            "Fate": fate_pts,
        }

        # Calculate metrics for each line
        result_lines = {}
        for name, pts in lines_dict.items():
            if len(pts) < 2:
                continue
            pts_arr = np.array(pts, dtype=np.float32)
            diffs = np.diff(pts_arr, axis=0)
            total_len = float(np.sum(np.sqrt((diffs ** 2).sum(axis=1))))
            start_p = pts[0]
            end_p = pts[-1]
            euclid = float(np.linalg.norm(pts_arr[-1] - pts_arr[0]))
            curvature = round(total_len / max(1.0, euclid), 2)

            # Average depth score along ridge map
            depths = [norm_map[int(np.clip(p[1], 0, h - 1)), int(np.clip(p[0], 0, w - 1))] for p in pts]
            avg_depth = float(np.mean(depths)) if depths else 0.0
            depth_score = int(np.clip((avg_depth / 255.0) * 100, 10, 99))

            if depth_score >= 65:
                clarity = "Deep & Pronounced"
            elif depth_score >= 45:
                clarity = "Clear & Well-Defined"
            elif depth_score >= 30:
                clarity = "Moderate"
            else:
                clarity = "Delicate / Subtle"

            dx = end_p[0] - start_p[0]
            dy = end_p[1] - start_p[1]
            angle = round(float(np.degrees(np.arctan2(dy, dx))), 1)

            metrics = {
                "length": round(total_len, 1),
                "normalized_length": round(min(100.0, (total_len / (w * 0.9)) * 100), 1),
                "curvature": curvature,
                "depth_score": depth_score,
                "clarity": clarity,
                "angle": angle,
                "start_point": start_p,
                "end_point": end_p
            }

            result_lines[name] = {
                "detected": True,
                "points": pts,
                "metrics": metrics,
                "color": tuple(self.line_colors.get(name, [255, 255, 255])),
                "color_rgb": [
                    self.line_colors[name][2],
                    self.line_colors[name][1],
                    self.line_colors[name][0]
                ] if name in self.line_colors else [255, 255, 255]
            }

        return result_lines

    def process(self, image: np.ndarray) -> Dict[str, Any]:
        """
        Main pipeline: Takes raw input image, segments hand, extracts normalized palm ROI,
        locates mounts, detects handedness, and classifies hand type.
        """
        orig_h, orig_w = image.shape[:2]
        hand_mask, hand_contour = self.segment_hand(image)

        if hand_contour is None:
            cx, cy = orig_w // 2, orig_h // 2
            radius = min(orig_w, orig_h) * 0.35
            center = (int(cx), int(cy))
            thumb_side = "left"
            hand_type_info = {
                "type": "Air",
                "description": "Balanced palm structure with analytical clarity.",
                "aspect_ratio": 1.0,
                "solidity": 0.8,
                "strengths": ["Clear focus", "Sharp intellect", "Balanced intuition"],
            }
        else:
            center, radius = self.find_palm_center_and_radius(hand_mask)
            hand_type_info = self.classify_hand_shape(hand_contour, radius, (orig_h, orig_w))
            thumb_side = self.detect_thumb_side(hand_contour, center[0], center[1], radius)

        roi, roi_info = self.extract_palm_roi(image, center, radius)

        # Crop hand mask to identical ROI coordinates
        x1, y1, rw, rh = roi_info["bbox"]
        if hand_mask is not None and rw > 0 and rh > 0:
            mask_crop = hand_mask[y1:y1 + rh, x1:x1 + rw]
            mask_roi = cv2.resize(mask_crop, self.target_size, interpolation=cv2.INTER_NEAREST)
        else:
            mask_roi = np.full(self.target_size, 255, dtype=np.uint8)

        mounts = self.locate_palm_mounts(self.target_size, thumb_side=thumb_side)

        return {
            "roi": roi,
            "roi_info": roi_info,
            "roi_hand_mask": mask_roi,
            "hand_type": hand_type_info,
            "mounts": mounts,
            "hand_mask": hand_mask,
            "thumb_side": thumb_side,
        }

    def detect_live(
        self,
        image: np.ndarray,
        target_center: Optional[Tuple[int, int]] = None,
        target_radius: Optional[float] = None,
    ) -> Dict[str, Any]:
        """
        Ultra-fast real-time detection pipeline for live camera streams (30+ FPS).
        Extracts real palm creases, alignment score, mounts, and archetype classification.
        """
        if image is None or image.size == 0:
            return {
                "detected": False,
                "status": "no_hand",
                "guide_feedback": "No video feed received",
                "alignment_score": 0,
                "is_aligned": False,
                "center": None,
                "radius": 0,
                "bbox": None,
                "frame_size": {"width": 0, "height": 0},
                "thumb_side": "left",
                "hand_contour": [],
                "hand_type": None,
                "mounts": {},
                "lines": {},
                "scores": None,
            }

        orig_h, orig_w = image.shape[:2]

        # 1. Downscale for sub-12ms processing if needed
        max_dim = 360.0
        scale = max_dim / max(orig_h, orig_w) if max(orig_h, orig_w) > max_dim else 1.0
        if scale < 1.0:
            small_w = int(orig_w * scale)
            small_h = int(orig_h * scale)
            small = cv2.resize(image, (small_w, small_h), interpolation=cv2.INTER_LINEAR)
        else:
            small = image
            scale = 1.0

        # Target center in scaled space
        tgt_cx = int(target_center[0] * scale) if target_center else small.shape[1] // 2
        tgt_cy = int(target_center[1] * scale) if target_center else int(small.shape[0] * 0.50)
        tgt_r = float(target_radius * scale) if target_radius else float(min(small.shape[1], small.shape[0]) * 0.22)

        # 2. Hand segmentation on downscaled image
        hand_mask, hand_contour = self.segment_hand(small, target_center=(tgt_cx, tgt_cy))

        orig_tgt_cx = int(tgt_cx / scale)
        orig_tgt_cy = int(tgt_cy / scale)
        orig_tgt_r = int(tgt_r / scale)

        if hand_contour is None:
            return {
                "detected": False,
                "status": "no_hand",
                "guide_feedback": "Position your open palm inside the guide circle",
                "alignment_score": 0,
                "is_aligned": False,
                "center": [orig_tgt_cx, orig_tgt_cy],
                "radius": 0,
                "bbox": None,
                "frame_size": {"width": orig_w, "height": orig_h},
                "thumb_side": "left",
                "hand_contour": [],
                "hand_type": None,
                "mounts": {},
                "lines": {},
                "scores": None,
                "target": {"center": [orig_tgt_cx, orig_tgt_cy], "radius": orig_tgt_r},
            }

        # 3. Palm center & radius in scaled space
        small_center, small_radius = self.find_palm_center_and_radius(hand_mask)
        cx = int(small_center[0] / scale)
        cy = int(small_center[1] / scale)
        radius = float(small_radius / scale)

        # 4. Handedness detection
        thumb_side = self.detect_thumb_side(hand_contour, small_center[0], small_center[1], small_radius)

        # 5. Bounding box & contour points in original frame coordinates
        bx, by, bw, bh = cv2.boundingRect(hand_contour)
        orig_bbox = [int(bx / scale), int(by / scale), int(bw / scale), int(bh / scale)]

        epsilon = 0.012 * cv2.arcLength(hand_contour, True)
        approx = cv2.approxPolyDP(hand_contour, epsilon, True)
        contour_pts = [[int(pt[0][0] / scale), int(pt[0][1] / scale)] for pt in approx]

        # 6. Hand archetype classification
        hand_type_info = self.classify_hand_shape(hand_contour, small_radius, (small.shape[0], small.shape[1]))

        # 7. Alignment calculation
        d_center = float(np.hypot(cx - orig_tgt_cx, cy - orig_tgt_cy))
        r_ratio = radius / max(1.0, orig_tgt_r)

        center_score = max(0.0, 1.0 - (d_center / (orig_w * 0.35)))
        size_score = max(0.0, 1.0 - abs(r_ratio - 1.0) / 0.65)
        alignment_score = int(np.clip((center_score * 0.55 + size_score * 0.45) * 100, 0, 100))

        if radius < orig_tgt_r * 0.65:
            status = "too_far"
            feedback = "Bring your palm closer to the camera"
        elif radius > orig_tgt_r * 1.65:
            status = "too_close"
            feedback = "Move your palm back slightly"
        elif d_center > orig_w * 0.18:
            status = "off_center"
            feedback = "Center your palm inside the glowing celestial guide"
        elif alignment_score >= 68:
            status = "aligned"
            feedback = "Palm Centered! Hold steady for reading"
        else:
            status = "adjusting"
            feedback = "Aligning palm center..."

        is_aligned = alignment_score >= 68 and 0.70 <= r_ratio <= 1.45

        # 8. Crop palm ROI on downscaled image for real-time crease extraction
        roi_half_small = int(max(small_radius * 1.35, 45))
        sx1 = max(0, small_center[0] - roi_half_small)
        sy1 = max(0, small_center[1] - roi_half_small)
        sx2 = min(small.shape[1], small_center[0] + roi_half_small)
        sy2 = min(small.shape[0], small_center[1] + roi_half_small)
        roi_w_small = max(1, sx2 - sx1)
        roi_h_small = max(1, sy2 - sy1)

        small_roi = small[sy1:sy2, sx1:sx2]
        small_mask_roi = hand_mask[sy1:sy2, sx1:sx2]
        # Erode mask to avoid hand boundary artifacts
        erode_k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
        eroded_roi_mask = cv2.erode(small_mask_roi, erode_k, iterations=1)

        # 9. Extract real palm creases from live frame
        extracted = self.extract_crease_lines(
            small_roi,
            thumb_side=thumb_side,
            eroded_mask=eroded_roi_mask,
            fast_mode=True
        )

        # 10. Map mounts and lines to original frame coordinates
        raw_mounts = self.locate_palm_mounts((roi_w_small, roi_h_small), thumb_side=thumb_side)
        mounts_live = {}
        for k, v in raw_mounts.items():
            mx_frame = int((sx1 + v["pos"][0]) / scale)
            my_frame = int((sy1 + v["pos"][1]) / scale)
            mr_frame = int(max(8, (v["radius"] / scale)))
            mounts_live[k] = {
                "name": v["name"],
                "meaning": v["meaning"],
                "pos": [mx_frame, my_frame],
                "radius": mr_frame,
                "element": v["element"],
            }

        live_lines = {}
        for line_name, ldata in extracted.items():
            frame_pts = []
            for pt in ldata["points"]:
                fx = int((sx1 + pt[0]) / scale)
                fy = int((sy1 + pt[1]) / scale)
                frame_pts.append([fx, fy])

            live_lines[line_name] = {
                "detected": True,
                "points": frame_pts,
                "metrics": ldata["metrics"],
                "color_rgb": ldata["color_rgb"],
            }

        # 11. Real-time Chirological scores preview
        base_harmony = int(np.clip(55 + (hand_type_info["solidity"] * 30) + (alignment_score * 0.15), 50, 98))
        vitality_score = int(np.clip(60 + (hand_type_info["aspect_ratio"] * 25), 50, 96))
        intellect_score = int(np.clip(58 + (1.0 - abs(hand_type_info["aspect_ratio"] - 1.0)) * 35, 52, 98))
        emotion_score = int(np.clip(62 + (1.0 - hand_type_info["solidity"]) * 40, 50, 95))
        destiny_score = int(np.clip(base_harmony - 4, 48, 94))

        scores_preview = {
            "overall_harmony": base_harmony,
            "vitality": vitality_score,
            "intellect": intellect_score,
            "heart_harmony": emotion_score,
            "destiny": destiny_score,
        }

        return {
            "detected": True,
            "status": status,
            "guide_feedback": feedback,
            "alignment_score": alignment_score,
            "is_aligned": is_aligned,
            "center": [cx, cy],
            "radius": round(radius, 1),
            "bbox": orig_bbox,
            "frame_size": {"width": orig_w, "height": orig_h},
            "thumb_side": thumb_side,
            "hand_contour": contour_pts,
            "hand_type": hand_type_info,
            "mounts": mounts_live,
            "lines": live_lines,
            "scores": scores_preview,
            "target": {"center": [orig_tgt_cx, orig_tgt_cy], "radius": orig_tgt_r},
        }

    def draw_live_overlay(
        self,
        image: np.ndarray,
        live_data: Dict[str, Any],
        show_lines: bool = True,
        show_mounts: bool = True,
        show_hud: bool = True,
        fps: float = 0.0,
    ) -> np.ndarray:
        """
        Draws celestial augmented-reality visualization directly onto an OpenCV frame
        for the desktop live camera viewer and OpenCV previews.
        """
        overlay = image.copy()
        h, w = image.shape[:2]

        tgt = live_data.get("target") or {"center": [w // 2, int(h * 0.50)], "radius": int(min(w, h) * 0.22)}
        tgt_cx, tgt_cy = tgt["center"]
        tgt_r = tgt["radius"]

        align_score = live_data.get("alignment_score", 0)
        is_aligned = live_data.get("is_aligned", False)

        reticle_color = (60, 220, 100) if is_aligned else ((50, 180, 255) if align_score > 40 else (200, 100, 120))

        # 1. Target Alignment Reticle
        for angle in range(0, 360, 30):
            rad1 = np.radians(angle)
            rad2 = np.radians(angle + 18)
            p1 = (int(tgt_cx + tgt_r * np.cos(rad1)), int(tgt_cy + tgt_r * np.sin(rad1)))
            p2 = (int(tgt_cx + tgt_r * np.cos(rad2)), int(tgt_cy + tgt_r * np.sin(rad2)))
            cv2.line(overlay, p1, p2, reticle_color, 2, cv2.LINE_AA)

        ch_len = 16
        cv2.line(overlay, (tgt_cx - ch_len, tgt_cy), (tgt_cx + ch_len, tgt_cy), reticle_color, 1, cv2.LINE_AA)
        cv2.line(overlay, (tgt_cx, tgt_cy - ch_len), (tgt_cx, tgt_cy + ch_len), reticle_color, 1, cv2.LINE_AA)

        if live_data.get("detected"):
            # 2. Glowing Hand Bounding Box (Corner brackets)
            bbox = live_data.get("bbox")
            if bbox:
                bx, by, bw, bh = bbox
                corner_len = min(24, bw // 4, bh // 4)
                c_color = (255, 200, 50)
                # Corners
                cv2.line(overlay, (bx, by), (bx + corner_len, by), c_color, 2, cv2.LINE_AA)
                cv2.line(overlay, (bx, by), (bx, by + corner_len), c_color, 2, cv2.LINE_AA)
                cv2.line(overlay, (bx + bw, by), (bx + bw - corner_len, by), c_color, 2, cv2.LINE_AA)
                cv2.line(overlay, (bx + bw, by), (bx + bw, by + corner_len), c_color, 2, cv2.LINE_AA)
                cv2.line(overlay, (bx, by + bh), (bx + corner_len, by + bh), c_color, 2, cv2.LINE_AA)
                cv2.line(overlay, (bx, by + bh), (bx, by + bh - corner_len), c_color, 2, cv2.LINE_AA)
                cv2.line(overlay, (bx + bw, by + bh), (bx + bw - corner_len, by + bh), c_color, 2, cv2.LINE_AA)
                cv2.line(overlay, (bx + bw, by + bh), (bx + bw, by + bh - corner_len), c_color, 2, cv2.LINE_AA)

            # 3. Dynamic Palm Center
            center = live_data.get("center")
            radius = int(live_data.get("radius", 0))
            if center and radius > 0:
                cx, cy = center
                cv2.circle(overlay, (cx, cy), radius, (245, 180, 40), 2, cv2.LINE_AA)
                cv2.circle(overlay, (cx, cy), 6, (40, 240, 180), -1, cv2.LINE_AA)

            # 4. Traced Palm Lines with Real Crease Tracking
            if show_lines:
                lines = live_data.get("lines", {})
                for name, ldata in lines.items():
                    pts = np.array(ldata["points"], dtype=np.int32)
                    rgb = ldata.get("color_rgb", [255, 255, 255])
                    bgr = (int(rgb[2]), int(rgb[1]), int(rgb[0]))
                    if len(pts) > 1:
                        # Soft outer glow
                        cv2.polylines(overlay, [pts], False, bgr, 4, cv2.LINE_AA)
                        # Core highlight stroke
                        bright = (min(255, bgr[0] + 50), min(255, bgr[1] + 50), min(255, bgr[2] + 50))
                        cv2.polylines(overlay, [pts], False, bright, 2, cv2.LINE_AA)

                        # Line name label tag
                        start_pt = tuple(pts[0])
                        cv2.circle(overlay, start_pt, 5, bright, -1, cv2.LINE_AA)
                        tag_pos = (start_pt[0] + 6, start_pt[1] - 4)
                        cv2.putText(overlay, f"{name} Line", tag_pos,
                                    cv2.FONT_HERSHEY_SIMPLEX, 0.40, bright, 1, cv2.LINE_AA)

            # 5. Chirological Mounts
            if show_mounts:
                mounts = live_data.get("mounts", {})
                for k, m in mounts.items():
                    mx, my = m["pos"]
                    mr = max(6, m["radius"])
                    cv2.circle(overlay, (mx, my), mr, (220, 160, 255), 1, cv2.LINE_AA)
                    cv2.circle(overlay, (mx, my), 3, (255, 255, 255), -1, cv2.LINE_AA)
                    short_name = m["name"].replace("Mount of ", "")
                    cv2.putText(overlay, short_name, (mx - 20, my - mr - 4),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.38, (255, 235, 180), 1, cv2.LINE_AA)

        # 6. Telemetry HUD Bar
        if show_hud:
            cv2.rectangle(overlay, (0, 0), (w, 56), (15, 10, 25), -1)
            cv2.line(overlay, (0, 56), (w, 56), (100, 60, 180), 1)

            ht = live_data.get("hand_type")
            ht_name = ht["type"].upper() if ht else "SCANNING..."
            ts = live_data.get("thumb_side", "left").upper()
            cv2.putText(overlay, f"PALMISTRA AI // {ht_name} HAND ({ts} THUMB)", (18, 26),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.58, (255, 215, 90), 2, cv2.LINE_AA)

            scores = live_data.get("scores")
            if scores:
                score_txt = f"Harmony: {scores['overall_harmony']}%  |  Vitality: {scores['vitality']}%  |  Intellect: {scores['intellect']}%"
                cv2.putText(overlay, score_txt, (18, 46),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.40, (200, 210, 230), 1, cv2.LINE_AA)

            status_text = f"{align_score}% ALIGNED" if live_data.get("detected") else "NO HAND"
            cv2.putText(overlay, status_text, (w - 180, 26),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.55, reticle_color, 2, cv2.LINE_AA)

            fps_text = f"{fps:.1f} FPS" if fps > 0 else "LIVE"
            cv2.putText(overlay, fps_text, (w - 180, 46),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.40, (180, 180, 200), 1, cv2.LINE_AA)

            cv2.rectangle(overlay, (0, h - 38), (w, h), (15, 10, 25), -1)
            cv2.line(overlay, (0, h - 38), (w, h - 38), (100, 60, 180), 1)
            feedback = live_data.get("guide_feedback", "Position palm to begin")
            cv2.putText(overlay, feedback, (18, h - 14),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.48, (255, 255, 255), 1, cv2.LINE_AA)

            bar_w = int((align_score / 100.0) * 160)
            cv2.rectangle(overlay, (w - 180, h - 26), (w - 20, h - 14), (50, 40, 70), -1)
            if bar_w > 0:
                cv2.rectangle(overlay, (w - 180, h - 26), (w - 180 + bar_w, h - 14), reticle_color, -1)

        return cv2.addWeighted(overlay, 0.92, image, 0.08, 0)
