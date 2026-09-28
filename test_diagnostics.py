import cv2
import numpy as np
from backend.palm_detector import PalmDetector
from backend.line_extractor import LineExtractor

img = cv2.imread("samples/sample_earth_palm.png")
detector = PalmDetector()
extractor = LineExtractor()

d = detector.process(img)
roi = d["roi"]
enhanced = extractor.enhance_contrast(roi)
ridge = extractor.compute_ridge_filter(enhanced)

print(f"ROI shape: {roi.shape}, dtype: {roi.dtype}")
print(f"Ridge min: {ridge.min()}, max: {ridge.max()}, mean: {ridge.mean():.2f}")

cv2.imwrite("output/test_roi.png", roi)
cv2.imwrite("output/test_ridge.png", ridge)
print("Saved output/test_roi.png and output/test_ridge.png")
