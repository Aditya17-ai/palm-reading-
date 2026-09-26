"""
Palm Line Extractor & Crease Segmentation Module
Combines CLAHE, morphological multi-scale Black-Hat filtering, Frangi ridge enhancement,
and vectorized dynamic programming to extract the 4 primary palmistry lines:
Heart Line, Head Line, Life Line, and Fate Line.
"""

import cv2
import numpy as np
from skimage.filters import frangi, sato
from skimage.morphology import skeletonize
from typing import Dict, List, Tuple, Any, Optional


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


class LineExtractor:
    def __init__(self, target_size: Tuple[int, int] = (512, 512)):
        self.target_size = target_size
        self.w, self.h = target_size

        # Colors for visualization (BGR)
        self.colors = {
            "Heart": (230, 40, 110),   # Crimson / Deep Rose
            "Head": (50, 160, 250),    # Bright Azure Blue
            "Life": (40, 210, 80),     # Emerald Green
            "Fate": (240, 190, 40),    # Radiant Amber / Gold
            "Creases": (140, 140, 140) # Subtle silver for minor creases
        }

    def enhance_contrast(self, image: np.ndarray) -> np.ndarray:
        """
        Applies CLAHE (Contrast Limited Adaptive Histogram Equalization)
        to the L-channel of LAB space to highlight deep crease shadows.
        """
        lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
        l, a, b = cv2.split(lab)
        clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
        cl = clahe.apply(l)
        enhanced_lab = cv2.merge((cl, a, b))
        enhanced_bgr = cv2.cvtColor(enhanced_lab, cv2.COLOR_LAB2BGR)
        return enhanced_bgr

    def compute_ridge_filter(self, image: np.ndarray) -> np.ndarray:
        """
        Combines multi-scale morphological Black-Hat filtering with Frangi/Sato
        tubular filters to isolate real skin creases with high signal-to-noise ratio.
        """
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        clahe = cv2.createCLAHE(clipLimit=2.8, tileGridSize=(8, 8))
        cl = clahe.apply(gray)

        # Multi-scale Black-Hat captures skin crease valleys directly
        k1 = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (15, 15))
        k2 = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
        bh1 = cv2.morphologyEx(cl, cv2.MORPH_BLACKHAT, k1)
        bh2 = cv2.morphologyEx(cl, cv2.MORPH_BLACKHAT, k2)
        blackhat = cv2.addWeighted(bh1, 0.65, bh2, 0.35, 0)

        # Frangi filter on inverted grayscale
        inverted = 255 - cl
        inv_float = inverted.astype(np.float32) / 255.0

        frangi_resp = frangi(
            inv_float,
            sigmas=np.arange(1.5, 3.8, 1.0),
            black_ridges=False,
            alpha=0.5,
            beta=0.5,
            gamma=15
        )

        norm_frangi = cv2.normalize(frangi_resp, None, 0, 255, cv2.NORM_MINMAX).astype(np.uint8)

        # Blend Black-Hat and Frangi
        blended = cv2.addWeighted(blackhat, 0.70, norm_frangi, 0.30, 0)
        norm_resp = cv2.normalize(blended, None, 0, 255, cv2.NORM_MINMAX)

        smoothed = cv2.bilateralFilter(norm_resp, d=5, sigmaColor=40, sigmaSpace=40)
        return smoothed

    def extract_skeleton(self, ridge_map: np.ndarray, threshold: int = 40) -> np.ndarray:
        """
        Binarizes the ridge map and computes the 1-pixel wide morphological skeleton.
        """
        _, binary = cv2.threshold(ridge_map, threshold, 255, cv2.THRESH_BINARY)
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (2, 2))
        cleaned = cv2.morphologyEx(binary, cv2.MORPH_OPEN, kernel)
        skeleton = skeletonize(cleaned > 0)
        skeleton_uint8 = (skeleton * 255).astype(np.uint8)
        return skeleton_uint8

    def _calculate_line_metrics(
        self, points: np.ndarray, ridge_map: np.ndarray
    ) -> Dict[str, Any]:
        """
        Calculates length, curvature (tortuosity), clarity/depth score, and slope angle.
        """
        if len(points) < 2:
            return {
                "length": 0.0,
                "normalized_length": 0.0,
                "curvature": 1.0,
                "depth_score": 0,
                "clarity": "Faint",
                "angle": 0.0,
                "start_point": [0, 0],
                "end_point": [0, 0]
            }

        diffs = np.diff(points, axis=0)
        segment_lengths = np.sqrt((diffs ** 2).sum(axis=1))
        total_length = float(np.sum(segment_lengths))

        start_pt = points[0]
        end_pt = points[-1]
        euclidean_dist = float(np.linalg.norm(end_pt - start_pt))

        curvature = round(total_length / max(1.0, euclidean_dist), 2)

        intensities = [
            ridge_map[int(np.clip(p[1], 0, self.h - 1)), int(np.clip(p[0], 0, self.w - 1))]
            for p in points
        ]
        avg_depth = float(np.mean(intensities)) if intensities else 0.0
        depth_score = int(np.clip((avg_depth / 255.0) * 100, 10, 99))

        if depth_score >= 65:
            clarity = "Deep & Pronounced"
        elif depth_score >= 45:
            clarity = "Clear & Well-Defined"
        elif depth_score >= 30:
            clarity = "Moderate"
        else:
            clarity = "Delicate / Subtle"

        dx = end_pt[0] - start_pt[0]
        dy = end_pt[1] - start_pt[1]
        angle = round(float(np.degrees(np.arctan2(dy, dx))), 1)

        return {
            "length": round(total_length, 1),
            "normalized_length": round(min(100.0, (total_length / (self.w * 0.9)) * 100), 1),
            "curvature": curvature,
            "depth_score": depth_score,
            "clarity": clarity,
            "angle": angle,
            "start_point": [int(start_pt[0]), int(start_pt[1])],
            "end_point": [int(end_pt[0]), int(end_pt[1])]
        }

    def trace_anatomical_crease_lines(
        self,
        ridge_map: np.ndarray,
        mounts: Dict[str, Dict[str, Any]],
        thumb_side: str = "left"
    ) -> Dict[str, Dict[str, Any]]:
        """
        Traces the 4 primary palmistry lines along real crease ridges using vectorized
        dynamic programming constrained by chirological zones.
        """
        w, h = self.w, self.h
        norm_map = ridge_map.astype(np.float32)

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

        step = 4

        # 1. Heart Line
        if thumb_side == "left":
            xs_heart = list(range(int(0.85 * w), int(0.24 * w), -step))
            heart_pts = dp_trace_horizontal(xs_heart, int(0.18 * h), int(0.42 * h), penalty=1.6)
        else:
            xs_heart = list(range(int(0.15 * w), int(0.76 * w), step))
            heart_pts = dp_trace_horizontal(xs_heart, int(0.18 * h), int(0.42 * h), penalty=1.6)

        # 2. Head Line
        if thumb_side == "left":
            xs_head = list(range(int(0.22 * w), int(0.80 * w), step))
            head_pts = dp_trace_horizontal(xs_head, int(0.35 * h), int(0.65 * h), penalty=1.8)
        else:
            xs_head = list(range(int(0.78 * w), int(0.20 * w), -step))
            head_pts = dp_trace_horizontal(xs_head, int(0.35 * h), int(0.65 * h), penalty=1.8)

        # 3. Life Line (Arc around Mount of Venus)
        if "Venus" in mounts:
            vx, vy = mounts["Venus"]["pos"]
            vr = mounts["Venus"]["radius"] * 1.5
        else:
            vx = int(0.25 * w) if thumb_side == "left" else int(0.75 * w)
            vy = int(0.72 * h)
            vr = int(0.18 * w)

        if thumb_side == "left":
            angles = np.linspace(-np.pi * 0.45, np.pi * 0.40, 36)
        else:
            angles = np.linspace(-np.pi * 0.55, -np.pi * 1.40, 36)

        life_pts = []
        radii = np.linspace(vr * 0.55, vr * 1.55, 30)
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

        # 4. Fate Line (Vertical ascending trajectory)
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

        detected_lines = {}
        for name, pts in lines_dict.items():
            pts_arr = np.array(pts, dtype=np.float32)
            metrics = self._calculate_line_metrics(pts_arr, ridge_map)
            detected_lines[name] = {
                "detected": True,
                "points": pts,
                "metrics": metrics,
                "color": self.colors[name]
            }

        return detected_lines

    def generate_visualizations(
        self,
        roi: np.ndarray,
        ridge_map: np.ndarray,
        lines: Dict[str, Dict[str, Any]],
        mounts: Dict[str, Dict[str, Any]]
    ) -> Dict[str, np.ndarray]:
        """
        Creates rendering overlays:
        1. overlay: Original ROI with glowing multi-layer lines and mount markers.
        2. ridge_map: Colorized heatmap of the crease response.
        3. blueprint: Mystical celestial blueprint with lines and geometry.
        """
        overlay = roi.copy()

        # Draw soft mounts
        mounts_layer = np.zeros_like(roi)
        for m_key, m_val in mounts.items():
            cx, cy = m_val["pos"]
            r = m_val["radius"]
            cv2.circle(mounts_layer, (cx, cy), r, (180, 70, 160), -1)
            cv2.circle(mounts_layer, (cx, cy), r, (220, 120, 210), 1, cv2.LINE_AA)

        cv2.addWeighted(mounts_layer, 0.25, overlay, 0.75, 0, overlay)

        # Draw glowing lines
        glow_layer = np.zeros_like(roi)
        for line_name, line_info in lines.items():
            pts = np.array(line_info["points"], dtype=np.int32)
            if len(pts) > 1:
                color = line_info["color"]
                # Outer soft glow
                cv2.polylines(glow_layer, [pts], False, color, 8, cv2.LINE_AA)
                # Mid stroke
                cv2.polylines(overlay, [pts], False, color, 3, cv2.LINE_AA)
                # Core bright stroke
                bright_color = tuple(min(255, c + 60) for c in color)
                cv2.polylines(overlay, [pts], False, bright_color, 1, cv2.LINE_AA)

                # Start and end markers
                cv2.circle(overlay, tuple(pts[0]), 5, bright_color, -1, cv2.LINE_AA)
                cv2.circle(overlay, tuple(pts[-1]), 4, bright_color, -1, cv2.LINE_AA)

                # Line label tag on overlay
                start_p = tuple(pts[0])
                cv2.putText(overlay, f"{line_name} Line", (start_p[0] + 6, start_p[1] - 4),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.42, bright_color, 1, cv2.LINE_AA)

        cv2.addWeighted(glow_layer, 0.45, overlay, 0.85, 0, overlay)

        # 2. Ridge Heatmap
        ridge_color = cv2.applyColorMap(ridge_map, cv2.COLORMAP_INFERNO)

        # 3. Celestial Dark Lines Blueprint
        blueprint = np.zeros((self.h, self.w, 3), dtype=np.uint8)
        blueprint[:] = (18, 14, 12)  # Deep cosmic navy

        # Subtle celestial grid
        for g in range(0, self.w, 64):
            cv2.line(blueprint, (g, 0), (g, self.h), (35, 28, 25), 1)
            cv2.line(blueprint, (0, g), (self.w, g), (35, 28, 25), 1)

        for line_name, line_info in lines.items():
            pts = np.array(line_info["points"], dtype=np.int32)
            if len(pts) > 1:
                color = line_info["color"]
                cv2.polylines(blueprint, [pts], False, color, 4, cv2.LINE_AA)
                bright_color = tuple(min(255, c + 70) for c in color)
                cv2.polylines(blueprint, [pts], False, bright_color, 2, cv2.LINE_AA)
                cv2.circle(blueprint, tuple(pts[0]), 5, bright_color, -1, cv2.LINE_AA)
                cv2.circle(blueprint, tuple(pts[-1]), 4, bright_color, -1, cv2.LINE_AA)
                cv2.putText(blueprint, line_name, (pts[0][0] + 6, pts[0][1] - 4),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.40, bright_color, 1, cv2.LINE_AA)

        return {
            "overlay": overlay,
            "ridge_map": ridge_color,
            "blueprint": blueprint
        }

    def process(
        self,
        roi: np.ndarray,
        mounts: Dict[str, Dict[str, Any]],
        thumb_side: str = "left",
        hand_mask: Optional[np.ndarray] = None
    ) -> Dict[str, Any]:
        """
        Full line extraction execution pipeline.
        """
        enhanced = self.enhance_contrast(roi)
        ridge_map = self.compute_ridge_filter(enhanced)

        # If hand mask is available, erode it to mask out outer perimeter
        if hand_mask is not None:
            if hand_mask.shape[:2] != (self.h, self.w):
                hand_mask = cv2.resize(hand_mask, (self.w, self.h), interpolation=cv2.INTER_NEAREST)
            erode_k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (25, 25))
            eroded_mask = cv2.erode(hand_mask, erode_k, iterations=1)
            ridge_map = cv2.bitwise_and(ridge_map, ridge_map, mask=eroded_mask)

        skeleton = self.extract_skeleton(ridge_map)
        lines = self.trace_anatomical_crease_lines(ridge_map, mounts, thumb_side=thumb_side)
        visuals = self.generate_visualizations(roi, ridge_map, lines, mounts)

        return {
            "lines": lines,
            "visualizations": visuals,
            "ridge_raw": ridge_map,
            "skeleton_raw": skeleton
        }
