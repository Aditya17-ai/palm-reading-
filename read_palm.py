"""
Standalone CLI Palm Reading Model
Analyzes a palm image from the terminal and outputs chiromancy readings and overlays.

Usage:
    python read_palm.py --image samples/sample_earth_palm.png
    python read_palm.py --image my_palm.jpg --output output_dir
"""

import os
import sys
import json
import argparse
import cv2
from backend.palm_detector import PalmDetector
from backend.line_extractor import LineExtractor
from backend.palmistry_engine import PalmistryEngine


def analyze_palm_image(image_path: str, output_dir: str = "output"):
    if not os.path.exists(image_path):
        print(f"Error: Image path '{image_path}' does not exist.")
        sys.exit(1)

    image = cv2.imread(image_path)
    if image is None:
        print(f"Error: Could not read image at '{image_path}'.")
        sys.exit(1)

    os.makedirs(output_dir, exist_ok=True)

    print("\n" + "=" * 60)
    print("           CELESTIAL PALM READING AI MODEL            ")
    print("=" * 60)
    print(f"[*] Processing image: {image_path}")

    detector = PalmDetector()
    extractor = LineExtractor()
    engine = PalmistryEngine()

    # 1. Palm Detection
    print("[*] Segmenting hand & localizing palm Region of Interest (ROI)...")
    det_res = detector.process(image)
    roi = det_res["roi"]
    mounts = det_res["mounts"]
    hand_type = det_res["hand_type"]

    # 2. Line Extraction
    print("[*] Applying multi-scale Frangi ridge filters & tracing major lines...")
    ext_res = extractor.process(roi, mounts)
    lines = ext_res["lines"]
    visuals = ext_res["visualizations"]

    # 3. Reading Generation
    print("[*] Synthesizing chiromancy reading & elemental profile...")
    reading = engine.generate_full_reading(hand_type, lines, mounts)

    # 4. Save Visualizations
    overlay_path = os.path.join(output_dir, "palm_lines_overlay.png")
    ridge_path = os.path.join(output_dir, "palm_crease_heatmap.png")
    blueprint_path = os.path.join(output_dir, "palm_celestial_blueprint.png")
    report_json_path = os.path.join(output_dir, "palm_reading_report.json")

    cv2.imwrite(overlay_path, visuals["overlay"])
    cv2.imwrite(ridge_path, visuals["ridge_map"])
    cv2.imwrite(blueprint_path, visuals["blueprint"])

    # Prepare JSON serializable lines
    serializable_lines = {}
    for k, v in lines.items():
        serializable_lines[k] = {
            "metrics": v["metrics"],
            "points_count": len(v["points"]),
            "color_bgr": v["color"]
        }

    full_output = {
        "reading": reading,
        "line_metrics": serializable_lines,
        "hand_geometry": {
            "type": hand_type["type"],
            "aspect_ratio": hand_type["aspect_ratio"],
            "solidity": hand_type["solidity"]
        }
    }

    with open(report_json_path, "w", encoding="utf-8") as f:
        json.dump(full_output, f, indent=2, ensure_ascii=False)

    # 5. Formatted Terminal Display
    scores = reading["scores"]
    elem = reading["elemental_profile"]
    lines_read = reading["lines"]

    print("\n" + "-" * 60)
    print(f" ELEMENTAL HAND ARCHETYPE: {elem['archetype'].upper()}")
    print(f" Motto: \"{elem['motto']}\"")
    print(f" Core Strengths: {', '.join(elem['strengths'])}")
    print("-" * 60)

    print("\n PALM HARMONY SCORES (0 - 100):")
    print(f"   * Overall Harmony : [{'#' * (scores['overall_harmony'] // 5):20}] {scores['overall_harmony']}/100")
    print(f"   * Vitality (Life) : [{'#' * (scores['vitality'] // 5):20}] {scores['vitality']}/100")
    print(f"   * Intellect (Head): [{'#' * (scores['intellect'] // 5):20}] {scores['intellect']}/100")
    print(f"   * Emotion (Heart) : [{'#' * (scores['heart_harmony'] // 5):20}] {scores['heart_harmony']}/100")
    print(f"   * Destiny (Fate)  : [{'#' * (scores['destiny'] // 5):20}] {scores['destiny']}/100")

    print("\n" + "-" * 60)
    print(" CHIROLOGICAL LINE BREAKDOWN:")
    print("-" * 60)

    for line_key, line_data in lines_read.items():
        title = line_data["title"]
        summary = line_data["summary"]
        clarity = line_data.get("clarity", "Clear")
        print(f"\n[+] {title.upper()} ({clarity})")
        print(f"    {summary}")

    print("\n" + "-" * 60)
    print(" AUSPICIOUS SIGNS & GIFTS:")
    print("-" * 60)
    for sign in reading["auspicious_signs"]:
        print(f" * {sign['name']}:")
        print(f"   {sign['significance']}")

    print("\n" + "-" * 60)
    print(" MINDFUL GUIDANCE:")
    print("-" * 60)
    for idx, guide in enumerate(reading["mindful_guidance"], 1):
        print(f" {idx}. {guide}")

    print("\n" + "=" * 60)
    print(f"[+] Visual artifacts saved successfully in '{output_dir}/':")
    print(f"    - {overlay_path}")
    print(f"    - {ridge_path}")
    print(f"    - {blueprint_path}")
    print(f"    - {report_json_path}")
    print("=" * 60 + "\n")


def main():
    parser = argparse.ArgumentParser(description="Celestial Palm Reading AI Model CLI")
    parser.add_argument("--image", type=str, default="samples/sample_earth_palm.png", help="Path to palm image")
    parser.add_argument("--output", type=str, default="output", help="Directory to save reading outputs")
    args = parser.parse_args()

    analyze_palm_image(args.image, args.output)


if __name__ == "__main__":
    main()
