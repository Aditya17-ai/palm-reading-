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
        Traces the 4 primary palmistry lines along real crease ridges using
        anatomically anchored, slope-regularized dynamic programming and directional
        ridge tracking. Accurately identifies biological start/end points and natural curves.
        """
        w, h = self.w, self.h
        norm = ridge_map.astype(np.float32)

        # -------------------------------------------------------------
        # 1. HEART LINE: Distal Transverse Crease
        # Starts on percussion edge (pinky side) -> sweeps toward index/middle finger
        # -------------------------------------------------------------
        def _trace_heart():
            y_min = int(0.16 * h)
            y_max = int(0.42 * h)
            step = 2

            if thumb_side == "left":
                # Pinky is on right (x ≈ 0.85*w -> 0.22*w)
                margin_x_start = int(0.70 * w)
                margin_x_end = int(0.86 * w)
                strip = norm[y_min:y_max, margin_x_start:margin_x_end]
                if strip.max() > 18:
                    py, px = np.unravel_index(np.argmax(strip), strip.shape)
                    start_x = margin_x_start + px
                    start_y = y_min + py
                else:
                    start_x = int(0.80 * w)
                    start_y = int(0.26 * h)

                xs = list(range(start_x, int(0.20 * w), -step))
            else:
                # Pinky is on left (x ≈ 0.15*w -> 0.78*w)
                margin_x_start = int(0.14 * w)
                margin_x_end = int(0.30 * w)
                strip = norm[y_min:y_max, margin_x_start:margin_x_end]
                if strip.max() > 18:
                    py, px = np.unravel_index(np.argmax(strip), strip.shape)
                    start_x = margin_x_start + px
                    start_y = y_min + py
                else:
                    start_x = int(0.20 * w)
                    start_y = int(0.26 * h)

                xs = list(range(start_x, int(0.80 * w), step))

            if len(xs) < 4:
                return []

            cur_x, cur_y = xs[0], start_y
            raw_pts = [[cur_x, cur_y]]

            for next_x in xs[1:]:
                search_ys = range(max(y_min, cur_y - 5), min(y_max, cur_y + 6))
                if not search_ys:
                    break
                weights = [norm[sy, next_x] - abs(sy - cur_y) * 2.8 for sy in search_ys]
                best_y = search_ys[int(np.argmax(weights))]
                cur_y = best_y
                raw_pts.append([next_x, cur_y])

            # Trim trailing blank skin where crease has ended
            while len(raw_pts) > 20 and norm[raw_pts[-1][1], raw_pts[-1][0]] < 14:
                raw_pts.pop()

            return smooth_points(raw_pts, 5)

        # -------------------------------------------------------------
        # 2. HEAD LINE: Proximal Transverse Crease
        # Starts on radial edge (thumb-index cleft) -> sweeps across mid palm
        # -------------------------------------------------------------
        def _trace_head():
            y_min = int(0.30 * h)
            y_max = int(0.68 * h)
            step = 2

            if thumb_side == "left":
                # Thumb on left (x ≈ 0.20*w -> 0.82*w)
                margin_x_start = int(0.18 * w)
                margin_x_end = int(0.32 * w)
                strip = norm[y_min:int(0.48 * h), margin_x_start:margin_x_end]
                if strip.max() > 18:
                    py, px = np.unravel_index(np.argmax(strip), strip.shape)
                    start_x = margin_x_start + px
                    start_y = y_min + py
                else:
                    start_x = int(0.22 * w)
                    start_y = int(0.38 * h)

                xs = list(range(start_x, int(0.82 * w), step))
            else:
                # Thumb on right (x ≈ 0.80*w -> 0.18*w)
                margin_x_start = int(0.68 * w)
                margin_x_end = int(0.82 * w)
                strip = norm[y_min:int(0.48 * h), margin_x_start:margin_x_end]
                if strip.max() > 18:
                    py, px = np.unravel_index(np.argmax(strip), strip.shape)
                    start_x = margin_x_start + px
                    start_y = y_min + py
                else:
                    start_x = int(0.78 * w)
                    start_y = int(0.38 * h)

                xs = list(range(start_x, int(0.18 * w), -step))

            if len(xs) < 4:
                return []

            # Global DP across mid-palm band to naturally adapt to straight vs dipping slope
            H_band = y_max - y_min
            W_col = len(xs)
            cost_grid = - (norm[y_min:y_max, xs] / 255.0) ** 1.5 * 10.0
            dp = np.zeros((H_band, W_col), dtype=np.float32)
            dp[:, 0] = cost_grid[:, 0]
            # Initialize with anchor bias near start_y
            anchor_r = np.clip(start_y - y_min, 0, H_band - 1)
            dp[:, 0] += (np.abs(np.arange(H_band) - anchor_r) ** 1.3) * 0.5
            backtrack = np.zeros((H_band, W_col), dtype=np.int32)

            for c in range(1, W_col):
                col_cost = cost_grid[:, c]
                for r in range(H_band):
                    best_pr = r
                    best_val = 1e9
                    for dr in range(-4, 5):
                        pr = r + dr
                        if 0 <= pr < H_band:
                            t_cost = dp[pr, c - 1] + (abs(dr) ** 1.4) * 0.35
                            if t_cost < best_val:
                                best_val = t_cost
                                best_pr = pr
                    dp[r, c] = best_val + col_cost[r]
                    backtrack[r, c] = best_pr

            best_end_r = int(np.argmin(dp[:, -1]))
            traced_ys = [best_end_r + y_min]
            for c in range(W_col - 1, 0, -1):
                best_end_r = backtrack[best_end_r, c]
                traced_ys.append(best_end_r + y_min)
            traced_ys = traced_ys[::-1]

            raw_pts = [[xs[i], traced_ys[i]] for i in range(W_col)]
            # Trim where line fades out into blank skin
            while len(raw_pts) > 20 and norm[raw_pts[-1][1], raw_pts[-1][0]] < 14:
                raw_pts.pop()

            return smooth_points(raw_pts, 5)

        # -------------------------------------------------------------
        # 3. LIFE LINE: Thenar Crease
        # Starts on radial edge (thumb-index cleft) -> sweeps down around Venus toward wrist
        # -------------------------------------------------------------
        def _trace_life():
            step = 2
            if thumb_side == "left":
                # Thumb on left
                x_search_min = int(0.18 * w)
                x_search_max = int(0.28 * w)
                y_search_min = int(0.36 * h)
                y_search_max = int(0.48 * h)

                strip = norm[y_search_min:y_search_max, x_search_min:x_search_max]
                if strip.max() > 18:
                    py, px = np.unravel_index(np.argmax(strip), strip.shape)
                    start_x = x_search_min + px
                    start_y = y_search_min + py
                else:
                    start_x = int(0.24 * w)
                    start_y = int(0.40 * h)

                cur_x, cur_y = start_x, start_y
                raw_pts = [[cur_x, cur_y]]

                for next_y in range(start_y + step, int(0.92 * h), step):
                    search_xs = range(max(int(0.14 * w), cur_x - 6), min(int(0.55 * w), cur_x + 8))
                    if not search_xs:
                        break
                    weights = [norm[next_y, sx] - abs(sx - cur_x) * 2.4 for sx in search_xs]
                    best_x = search_xs[int(np.argmax(weights))]
                    cur_x = best_x
                    raw_pts.append([cur_x, next_y])
            else:
                # Thumb on right
                x_search_min = int(0.72 * w)
                x_search_max = int(0.82 * w)
                y_search_min = int(0.36 * h)
                y_search_max = int(0.48 * h)

                strip = norm[y_search_min:y_search_max, x_search_min:x_search_max]
                if strip.max() > 18:
                    py, px = np.unravel_index(np.argmax(strip), strip.shape)
                    start_x = x_search_min + px
                    start_y = y_search_min + py
                else:
                    start_x = int(0.76 * w)
                    start_y = int(0.40 * h)

                cur_x, cur_y = start_x, start_y
                raw_pts = [[cur_x, cur_y]]

                for next_y in range(start_y + step, int(0.92 * h), step):
                    search_xs = range(max(int(0.45 * w), cur_x - 8), min(int(0.86 * w), cur_x + 6))
                    if not search_xs:
                        break
                    weights = [norm[next_y, sx] - abs(sx - cur_x) * 2.4 for sx in search_xs]
                    best_x = search_xs[int(np.argmax(weights))]
                    cur_x = best_x
                    raw_pts.append([cur_x, next_y])

            # Trim where life line fades near wrist
            while len(raw_pts) > 25 and norm[raw_pts[-1][1], raw_pts[-1][0]] < 14:
                raw_pts.pop()

            return smooth_points(raw_pts, 5)

        # -------------------------------------------------------------
        # 4. FATE LINE: Line of Saturn / Destiny
        # Central longitudinal ascent toward Mount of Saturn (middle finger base)
        # -------------------------------------------------------------
        def _trace_fate():
            step = 2
            x_min = int(0.40 * w)
            x_max = int(0.60 * w)
            y_start_min = int(0.78 * h)
            y_start_max = int(0.92 * h)

            strip = norm[y_start_min:y_start_max, x_min:x_max]
            if strip.max() > 18:
                py, px = np.unravel_index(np.argmax(strip), strip.shape)
                start_x = x_min + px
                start_y = y_start_min + py
            else:
                start_x = int(0.50 * w)
                start_y = int(0.85 * h)

            cur_x, cur_y = start_x, start_y
            raw_pts = [[cur_x, cur_y]]

            for next_y in range(start_y - step, int(0.22 * h), -step):
                search_xs = range(max(x_min, cur_x - 5), min(x_max, cur_x + 6))
                if not search_xs:
                    break
                weights = [norm[next_y, sx] - abs(sx - cur_x) * 2.8 for sx in search_xs]
                best_x = search_xs[int(np.argmax(weights))]
                cur_x = best_x
                raw_pts.append([cur_x, next_y])

            while len(raw_pts) > 25 and norm[raw_pts[-1][1], raw_pts[-1][0]] < 14:
                raw_pts.pop()

            return smooth_points(raw_pts, 5)

        heart_pts = _trace_heart()
        head_pts = _trace_head()
        life_pts = _trace_life()
        fate_pts = _trace_fate()

        lines_dict = {
            "Heart": heart_pts,
            "Head": head_pts,
            "Life": life_pts,
            "Fate": fate_pts,
        }

        detected_lines = {}
        for name, pts in lines_dict.items():
            if len(pts) < 2:
                continue
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
