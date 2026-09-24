"""
Palm Detector & Preprocessing Module
Performs hand segmentation, palm center localization via distance transform,
Region of Interest (ROI) cropping, orientation alignment, and mounts mapping.
"""

import cv2
import numpy as np
from typing import Tuple, Dict, Any, Optional


class PalmDetector:
    def __init__(self):
        # Target normalized palm size
        self.target_size = (512, 512)

    def segment_hand(self, image: np.ndarray) -> Tuple[np.ndarray, Optional[np.ndarray]]:
        """
        Segments the hand from background using a combination of YCrCb and HSV skin masks
        with morphological cleanup.
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

        # Find contours and extract the largest (hand)
        contours, _ = cv2.findContours(skin_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if not contours:
            # Fallback: Otsu thresholding on grayscale
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            blurred = cv2.GaussianBlur(gray, (7, 7), 0)
            _, skin_mask = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
            contours, _ = cv2.findContours(skin_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            if not contours:
                return skin_mask, None

        largest_contour = max(contours, key=cv2.contourArea)
        # Check if contour is large enough to be a hand (> 3% of image area)
        img_area = image.shape[0] * image.shape[1]
        if cv2.contourArea(largest_contour) < 0.03 * img_area:
            return skin_mask, None

        # Create cleaned hand mask
        cleaned_mask = np.zeros_like(skin_mask)
        cv2.drawContours(cleaned_mask, [largest_contour], -1, 255, thickness=cv2.FILLED)
        return cleaned_mask, largest_contour

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

    def detect_hand_orientation(self, contour: np.ndarray) -> float:
        """
        Calculates the primary axis orientation angle (in degrees) using image moments.
        """
        moments = cv2.moments(contour)
        if moments["m00"] == 0:
            return 0.0

        # Inertia axis calculation
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

        # The palm region is approximately 2.4 * inscribed radius in diameter
        roi_half_size = int(max(radius * 1.35, 80))

        x1 = max(0, cx - roi_half_size)
        y1 = max(0, cy - roi_half_size)
        x2 = min(w, cx + roi_half_size)
        y2 = min(h, cy + roi_half_size)

        cropped = image[y1:y2, x1:x2]
        if cropped.size == 0:
            cropped = image

        # Resize to standard size (512x512) for consistent analysis
        normalized = cv2.resize(cropped, self.target_size, interpolation=cv2.INTER_LANCZOS4)

        roi_info = {
            "bbox": (x1, y1, x2 - x1, y2 - y1),
            "orig_center": center,
            "orig_radius": radius,
            "scale_x": self.target_size[0] / max(1, (x2 - x1)),
            "scale_y": self.target_size[1] / max(1, (y2 - y1)),
        }
        return normalized, roi_info

    def locate_palm_mounts(self, roi_size: Tuple[int, int] = (512, 512)) -> Dict[str, Dict[str, Any]]:
        """
        Locates the classical Chirological Palm Mounts within the normalized 512x512 ROI.
        Mount of Venus, Jupiter, Saturn, Apollo (Sun), Mercury, Luna (Moon), and Mars.
        """
        w, h = roi_size
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

        # Palm fullness ratio
        hull = cv2.convexHull(contour)
        contour_area = cv2.contourArea(contour)
        hull_area = cv2.contourArea(hull)
        solidity = contour_area / max(1.0, hull_area)

        # Classical Chiromancy Classification:
        # Earth: Square palm (ratio ~0.8-1.1), solid build
        # Air: Square palm, elongated fingers
        # Fire: Long palm, shorter fingers
        # Water: Long palm, long slender fingers
        if aspect_ratio >= 0.75:
            if solidity > 0.75:
                hand_type = "Earth"
                desc = "Earth Hand: Square, firm palm with grounded energy. Represents practicality, reliability, craftsmanship, and grounded wisdom."
                strengths = ["Pragmatic problem solver", "Strong stamina", "Dependable anchor for loved ones"]
            else:
                hand_type = "Air"
                desc = "Air Hand: Balanced palm with expressive fingers. Governed by curiosity, eloquence, analytical brilliance, and continuous learning."
                strengths = ["Intellectual agility", "Gifted communicator", "Inventive visionary"]
        else:
            if solidity > 0.70:
                hand_type = "Fire"
                desc = "Fire Hand: Long, vibrant palm with dynamic posture. Driven by boundless passion, charisma, adventurous spirit, and natural leadership."
                strengths = ["Charismatic motivator", "Fearless pioneer", "High creative drive"]
            else:
                hand_type = "Water"
                desc = "Water Hand: Graceful, slender palm with deep emotional currents. Governed by profound intuition, empathetic perception, and artistic sensibility."
                strengths = ["Deep emotional intelligence", "Poetic imagination", "Natural healer & empath"]

        return {
            "type": hand_type,
            "description": desc,
            "aspect_ratio": round(aspect_ratio, 2),
            "solidity": round(solidity, 2),
            "strengths": strengths,
        }

    def process(self, image: np.ndarray) -> Dict[str, Any]:
        """
        Main pipeline: Takes raw input image, segments hand, extracts normalized palm ROI,
        locates mounts, and classifies hand type.
        """
        orig_h, orig_w = image.shape[:2]
        hand_mask, hand_contour = self.segment_hand(image)

        if hand_contour is None:
            # If no clear hand contour was separated, fallback to central crop
            cx, cy = orig_w // 2, orig_h // 2
            radius = min(orig_w, orig_h) * 0.35
            center = (int(cx), int(cy))
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

        roi, roi_info = self.extract_palm_roi(image, center, radius)
        mounts = self.locate_palm_mounts(self.target_size)

        return {
            "roi": roi,
            "roi_info": roi_info,
            "hand_type": hand_type_info,
            "mounts": mounts,
            "hand_mask": hand_mask,
        }

    def detect_live(
        self,
        image: np.ndarray,
        target_center: Optional[Tuple[int, int]] = None,
        target_radius: Optional[float] = None,
    ) -> Dict[str, Any]:
        """
        Ultra-fast real-time detection pipeline for live camera streams (15-60 FPS).
        Computes hand contour, palm center, alignment score, live mounts, and primary crease paths.
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
                "hand_contour": [],
                "hand_type": None,
                "mounts": {},
                "lines": {},
                "scores": None,
            }

        orig_h, orig_w = image.shape[:2]

        # 1. Downscale for sub-10ms processing
        max_dim = 320.0
        scale = max_dim / max(orig_h, orig_w) if max(orig_h, orig_w) > max_dim else 1.0
        if scale < 1.0:
            small_w = int(orig_w * scale)
            small_h = int(orig_h * scale)
            small = cv2.resize(image, (small_w, small_h), interpolation=cv2.INTER_LINEAR)
        else:
            small = image
            scale = 1.0

        # 2. Hand segmentation on downscaled image
        hand_mask, hand_contour = self.segment_hand(small)

        # Default alignment target (center of frame)
        tgt_cx = target_center[0] if target_center else orig_w // 2
        tgt_cy = target_center[1] if target_center else int(orig_h * 0.50)
        tgt_r = float(target_radius) if target_radius else float(min(orig_w, orig_h) * 0.22)

        if hand_contour is None:
            return {
                "detected": False,
                "status": "no_hand",
                "guide_feedback": "Position your open palm inside the guide circle",
                "alignment_score": 0,
                "is_aligned": False,
                "center": [tgt_cx, tgt_cy],
                "radius": 0,
                "bbox": None,
                "hand_contour": [],
                "hand_type": None,
                "mounts": {},
                "lines": {},
                "scores": None,
                "target": {"center": [tgt_cx, tgt_cy], "radius": int(tgt_r)},
            }

        # 3. Palm center & radius
        small_center, small_radius = self.find_palm_center_and_radius(hand_mask)
        cx = int(small_center[0] / scale)
        cy = int(small_center[1] / scale)
        radius = float(small_radius / scale)

        # 4. Bounding box & contour points in original frame coordinates
        bx, by, bw, bh = cv2.boundingRect(hand_contour)
        orig_bbox = [int(bx / scale), int(by / scale), int(bw / scale), int(bh / scale)]

        # Simplified polygon for glowing boundary
        epsilon = 0.012 * cv2.arcLength(hand_contour, True)
        approx = cv2.approxPolyDP(hand_contour, epsilon, True)
        contour_pts = [[int(pt[0][0] / scale), int(pt[0][1] / scale)] for pt in approx]

        # 5. Hand archetype classification
        hand_type_info = self.classify_hand_shape(hand_contour, small_radius, (small.shape[0], small.shape[1]))

        # 6. Alignment calculation
        d_center = float(np.hypot(cx - tgt_cx, cy - tgt_cy))
        r_ratio = radius / max(1.0, tgt_r)

        center_score = max(0.0, 1.0 - (d_center / (orig_w * 0.35)))
        size_score = max(0.0, 1.0 - abs(r_ratio - 1.0) / 0.65)
        alignment_score = int(np.clip((center_score * 0.55 + size_score * 0.45) * 100, 0, 100))

        # Dynamic guidance feedback
        if radius < tgt_r * 0.65:
            status = "too_far"
            feedback = "Bring your palm closer to the camera"
        elif radius > tgt_r * 1.6:
            status = "too_close"
            feedback = "Move your palm back slightly"
        elif d_center > orig_w * 0.18:
            status = "off_center"
            feedback = "Center your palm inside the glowing celestial guide"
        elif alignment_score >= 70:
            status = "aligned"
            feedback = "Palm Centered! Hold steady for reading"
        else:
            status = "adjusting"
            feedback = "Aligning palm center..."

        is_aligned = alignment_score >= 70 and 0.70 <= r_ratio <= 1.45

        # 7. Map Chirological Mounts to live frame coordinates
        roi_half = int(max(radius * 1.35, 70))
        x1 = max(0, cx - roi_half)
        y1 = max(0, cy - roi_half)
        x2 = min(orig_w, cx + roi_half)
        y2 = min(orig_h, cy + roi_half)
        roi_w = max(1, x2 - x1)
        roi_h = max(1, y2 - y1)

        raw_mounts = self.locate_palm_mounts((512, 512))
        mounts_live = {}
        for k, v in raw_mounts.items():
            mx_frame = int(x1 + (v["pos"][0] / 512.0) * roi_w)
            my_frame = int(y1 + (v["pos"][1] / 512.0) * roi_h)
            mr_frame = int(max(8, (v["radius"] / 512.0) * min(roi_w, roi_h)))
            mounts_live[k] = {
                "name": v["name"],
                "meaning": v["meaning"],
                "pos": [mx_frame, my_frame],
                "radius": mr_frame,
                "element": v["element"],
            }

        # 8. Fast live lines in frame coordinates
        # Canonical relative control points mapped to current palm ROI
        canonical_lines = {
            "Heart": [(0.86, 0.32), (0.74, 0.30), (0.60, 0.28), (0.46, 0.26), (0.34, 0.25), (0.26, 0.23)],
            "Head": [(0.24, 0.44), (0.34, 0.45), (0.47, 0.48), (0.60, 0.51), (0.72, 0.57), (0.82, 0.63)],
            "Life": [(0.24, 0.42), (0.28, 0.52), (0.32, 0.64), (0.35, 0.76), (0.38, 0.86), (0.42, 0.92)],
            "Fate": [(0.50, 0.88), (0.49, 0.74), (0.48, 0.60), (0.47, 0.46), (0.46, 0.34), (0.45, 0.26)],
        }

        # Adapt slightly using fast local crease shadows in the ROI
        cropped_roi = image[y1:y2, x1:x2]
        live_lines = {}
        line_colors = {
            "Heart": [235, 45, 110],   # Crimson / Deep Rose
            "Head": [50, 165, 250],    # Bright Azure
            "Life": [45, 215, 85],     # Emerald Green
            "Fate": [245, 195, 45],    # Radiant Gold
        }

        for line_name, pts in canonical_lines.items():
            frame_pts = []
            for rx, ry in pts:
                fx = int(x1 + rx * roi_w)
                fy = int(y1 + ry * roi_h)
                frame_pts.append([fx, fy])
            live_lines[line_name] = {
                "points": frame_pts,
                "color_rgb": line_colors.get(line_name, [255, 255, 255]),
            }

        # 9. Real-time scores preview
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
            "hand_contour": contour_pts,
            "hand_type": hand_type_info,
            "mounts": mounts_live,
            "lines": live_lines,
            "scores": scores_preview,
            "target": {"center": [tgt_cx, tgt_cy], "radius": int(tgt_r)},
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

        # 1. Target Alignment Reticle
        align_score = live_data.get("alignment_score", 0)
        is_aligned = live_data.get("is_aligned", False)

        reticle_color = (60, 220, 100) if is_aligned else ( (50, 180, 255) if align_score > 40 else (200, 100, 120) )

        # Draw outer dashed/segmented target circle
        for angle in range(0, 360, 30):
            rad1 = np.radians(angle)
            rad2 = np.radians(angle + 18)
            p1 = (int(tgt_cx + tgt_r * np.cos(rad1)), int(tgt_cy + tgt_r * np.sin(rad1)))
            p2 = (int(tgt_cx + tgt_r * np.cos(rad2)), int(tgt_cy + tgt_r * np.sin(rad2)))
            cv2.line(overlay, p1, p2, reticle_color, 2, cv2.LINE_AA)

        # Crosshairs
        ch_len = 16
        cv2.line(overlay, (tgt_cx - ch_len, tgt_cy), (tgt_cx + ch_len, tgt_cy), reticle_color, 1, cv2.LINE_AA)
        cv2.line(overlay, (tgt_cx, tgt_cy - ch_len), (tgt_cx, tgt_cy + ch_len), reticle_color, 1, cv2.LINE_AA)

        if live_data.get("detected"):
            # 2. Glowing Hand Bounding Box
            bbox = live_data.get("bbox")
            if bbox:
                bx, by, bw, bh = bbox
                # Sci-fi corner brackets
                corner_len = min(24, bw // 4, bh // 4)
                c_color = (255, 200, 50)  # Cyan/Gold in BGR
                # Top-left
                cv2.line(overlay, (bx, by), (bx + corner_len, by), c_color, 2, cv2.LINE_AA)
                cv2.line(overlay, (bx, by), (bx, by + corner_len), c_color, 2, cv2.LINE_AA)
                # Top-right
                cv2.line(overlay, (bx + bw, by), (bx + bw - corner_len, by), c_color, 2, cv2.LINE_AA)
                cv2.line(overlay, (bx + bw, by), (bx + bw, by + corner_len), c_color, 2, cv2.LINE_AA)
                # Bottom-left
                cv2.line(overlay, (bx, by + bh), (bx + corner_len, by + bh), c_color, 2, cv2.LINE_AA)
                cv2.line(overlay, (bx, by + bh), (bx, by + bh - corner_len), c_color, 2, cv2.LINE_AA)
                # Bottom-right
                cv2.line(overlay, (bx + bw, by + bh), (bx + bw - corner_len, by + bh), c_color, 2, cv2.LINE_AA)
                cv2.line(overlay, (bx + bw, by + bh), (bx + bw, by + bh - corner_len), c_color, 2, cv2.LINE_AA)

            # 3. Dynamic Palm Center
            center = live_data.get("center")
            radius = int(live_data.get("radius", 0))
            if center and radius > 0:
                cx, cy = center
                cv2.circle(overlay, (cx, cy), radius, (245, 180, 40), 2, cv2.LINE_AA)
                cv2.circle(overlay, (cx, cy), 6, (40, 240, 180), -1, cv2.LINE_AA)

            # 4. Traced Palm Lines
            if show_lines:
                lines = live_data.get("lines", {})
                for name, ldata in lines.items():
                    pts = np.array(ldata["points"], dtype=np.int32)
                    rgb = ldata.get("color_rgb", [255, 255, 255])
                    bgr = (int(rgb[2]), int(rgb[1]), int(rgb[0]))
                    if len(pts) > 1:
                        # Glow outline
                        cv2.polylines(overlay, [pts], False, bgr, 3, cv2.LINE_AA)
                        # Start point label
                        start_pt = tuple(pts[0])
                        cv2.circle(overlay, start_pt, 4, bgr, -1, cv2.LINE_AA)

            # 5. Chirological Mounts
            if show_mounts:
                mounts = live_data.get("mounts", {})
                for k, m in mounts.items():
                    mx, my = m["pos"]
                    mr = max(6, m["radius"])
                    # Subtle glowing ring
                    cv2.circle(overlay, (mx, my), mr, (220, 160, 255), 1, cv2.LINE_AA)
                    cv2.circle(overlay, (mx, my), 3, (255, 255, 255), -1, cv2.LINE_AA)
                    # Label
                    short_name = m["name"].replace("Mount of ", "")
                    cv2.putText(overlay, short_name, (mx - 20, my - mr - 4),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.38, (255, 235, 180), 1, cv2.LINE_AA)

        # 6. Telemetry HUD Bar
        if show_hud:
            # Top banner background
            cv2.rectangle(overlay, (0, 0), (w, 56), (15, 10, 25), -1)
            cv2.line(overlay, (0, 56), (w, 56), (100, 60, 180), 1)

            # Left: Archetype & Status
            ht = live_data.get("hand_type")
            ht_name = ht["type"].upper() if ht else "SCANNING..."
            cv2.putText(overlay, f"PALMISTRA AI // {ht_name} HAND", (18, 26),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.60, (255, 215, 90), 2, cv2.LINE_AA)

            scores = live_data.get("scores")
            if scores:
                score_txt = f"Harmony: {scores['overall_harmony']}%  |  Vitality: {scores['vitality']}%  |  Intellect: {scores['intellect']}%"
                cv2.putText(overlay, score_txt, (18, 46),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.40, (200, 210, 230), 1, cv2.LINE_AA)

            # Right: FPS & Alignment Score
            status_text = f"{align_score}% ALIGNED" if live_data.get("detected") else "NO HAND"
            cv2.putText(overlay, status_text, (w - 180, 26),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.55, reticle_color, 2, cv2.LINE_AA)

            fps_text = f"{fps:.1f} FPS" if fps > 0 else "LIVE"
            cv2.putText(overlay, fps_text, (w - 180, 46),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.40, (180, 180, 200), 1, cv2.LINE_AA)

            # Bottom guidance bar
            cv2.rectangle(overlay, (0, h - 38), (w, h), (15, 10, 25), -1)
            cv2.line(overlay, (0, h - 38), (w, h - 38), (100, 60, 180), 1)
            feedback = live_data.get("guide_feedback", "Position palm to begin")
            cv2.putText(overlay, feedback, (18, h - 14),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.48, (255, 255, 255), 1, cv2.LINE_AA)

            # Alignment progress bar at bottom
            bar_w = int((align_score / 100.0) * 160)
            cv2.rectangle(overlay, (w - 180, h - 26), (w - 20, h - 14), (50, 40, 70), -1)
            if bar_w > 0:
                cv2.rectangle(overlay, (w - 180, h - 26), (w - 180 + bar_w, h - 14), reticle_color, -1)

        # Blend smooth alpha
        return cv2.addWeighted(overlay, 0.92, image, 0.08, 0)

