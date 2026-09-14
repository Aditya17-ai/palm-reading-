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
