"""
Test script to develop and verify anatomically accurate palm line tracing.
"""
import os
import cv2
import numpy as np
from backend.palm_detector import PalmDetector
from backend.line_extractor import LineExtractor

def test():
    img_path = "samples/sample_earth_palm.png"
    if not os.path.exists(img_path):
        from backend.generate_samples import generate_all_samples
        generate_all_samples()

    img = cv2.imread(img_path)
    detector = PalmDetector()
    extractor = LineExtractor()

    d = detector.process(img)
    roi = d["roi"]
    mounts = d["mounts"]
    thumb_side = d["thumb_side"]
    mask = d["roi_hand_mask"]

    res = extractor.process(roi, mounts, thumb_side=thumb_side, hand_mask=mask)
    lines = res["lines"]

    print("=== CURRENT LINE EXTRACTION RESULTS ===")
    for name, line in lines.items():
        m = line["metrics"]
        print(f"[{name}] length: {m['length']}, curvature: {m['curvature']}, depth: {m['depth_score']}, clarity: {m['clarity']}, angle: {m['angle']}")
        print(f"       start: {m['start_point']}, end: {m['end_point']}")

if __name__ == "__main__":
    test()
