"""
Unit test for Palm Reading Pipeline
Validates palm detection, line extraction, palmistry interpretation, and image overlays.
"""

import os
import cv2
import unittest
from backend.palm_detector import PalmDetector
from backend.line_extractor import LineExtractor
from backend.palmistry_engine import PalmistryEngine


class TestPalmReadingPipeline(unittest.TestCase):
    def setUp(self):
        self.detector = PalmDetector()
        self.extractor = LineExtractor()
        self.engine = PalmistryEngine()
        self.test_img_path = "samples/sample_earth_palm.png"
        self.assertTrue(os.path.exists(self.test_img_path), "Sample image does not exist")
        self.image = cv2.imread(self.test_img_path)

    def test_detection(self):
        result = self.detector.process(self.image)
        self.assertIn("roi", result)
        self.assertEqual(result["roi"].shape, (512, 512, 3))
        self.assertIn("mounts", result)
        self.assertIn("hand_type", result)
        print(f"\nHand Type Detected: {result['hand_type']['type']}")

    def test_line_extraction(self):
        det_result = self.detector.process(self.image)
        roi = det_result["roi"]
        mounts = det_result["mounts"]

        ext_result = self.extractor.process(roi, mounts)
        lines = ext_result["lines"]

        for line_name in ["Heart", "Head", "Life", "Fate"]:
            self.assertIn(line_name, lines)
            self.assertTrue(len(lines[line_name]["points"]) > 0)
            metrics = lines[line_name]["metrics"]
            self.assertIn("length", metrics)
            self.assertIn("curvature", metrics)
            self.assertIn("depth_score", metrics)
            print(f"Line {line_name}: Length={metrics['length']}, Curvature={metrics['curvature']}, Depth={metrics['depth_score']}")

        visuals = ext_result["visualizations"]
        self.assertIn("overlay", visuals)
        self.assertIn("ridge_map", visuals)
        self.assertIn("blueprint", visuals)

    def test_full_reading(self):
        det_result = self.detector.process(self.image)
        ext_result = self.extractor.process(det_result["roi"], det_result["mounts"])
        reading = self.engine.generate_full_reading(
            det_result["hand_type"], ext_result["lines"], det_result["mounts"]
        )

        self.assertIn("elemental_profile", reading)
        self.assertIn("scores", reading)
        self.assertIn("lines", reading)
        self.assertIn("auspicious_signs", reading)
        self.assertIn("mindful_guidance", reading)

        print(f"\nReading Overall Harmony: {reading['scores']['overall_harmony']}/100")
        print(f"Life Summary: {reading['lines']['life']['summary']}")


if __name__ == "__main__":
    unittest.main()
