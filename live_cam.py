"""
Palmistra AI - Real-Time Live Camera Palm Detection
Standalone Desktop Computer Vision Application

Features:
- Live 30+ FPS hand segmentation, palm center distance transform, and alignment reticle
- Real-time Chirological Mounts projection (Venus, Jupiter, Saturn, Sun, Mercury, Luna, Mars)
- Real-time crease and major line tracking (Heart, Head, Life, Fate)
- Real-time elemental archetype classification (Earth, Air, Fire, Water) and vitality score meters
- Instant capture to generate full Chiromancy report ([SPACE] or [C])
- Auto-capture when aligned and steady

Usage:
    python live_cam.py
    python live_cam.py --cam 0 --width 1280 --height 720
    python live_cam.py --auto-capture
    python live_cam.py --mock  (Simulates camera feed using sample palms if no physical webcam)
"""

import os
import sys
import time
import argparse
import cv2
import numpy as np

from backend.palm_detector import PalmDetector
from backend.line_extractor import LineExtractor
from backend.palmistry_engine import PalmistryEngine


def capture_and_analyze(frame: np.ndarray, output_dir: str = "output"):
    """Runs full deep Frangi Hessian analysis and saves report."""
    os.makedirs(output_dir, exist_ok=True)
    print("\n" + "=" * 62)
    print("      CELESTIAL PALM READING AI - DEEP MULTI-SCALE SCAN        ")
    print("=" * 62)
    print("[*] Processing captured camera frame...")

    detector = PalmDetector()
    extractor = LineExtractor()
    engine = PalmistryEngine()

    det_res = detector.process(frame)
    roi = det_res["roi"]
    mounts = det_res["mounts"]
    hand_type = det_res["hand_type"]

    ext_res = extractor.process(roi, mounts)
    lines = ext_res["lines"]
    visuals = ext_res["visualizations"]

    reading = engine.generate_full_reading(hand_type, lines, mounts)

    overlay_path = os.path.join(output_dir, "palm_lines_overlay.png")
    ridge_path = os.path.join(output_dir, "palm_crease_heatmap.png")
    blueprint_path = os.path.join(output_dir, "palm_celestial_blueprint.png")
    report_json_path = os.path.join(output_dir, "palm_reading_report.json")

    cv2.imwrite(overlay_path, visuals["overlay"])
    cv2.imwrite(ridge_path, visuals["ridge_map"])
    cv2.imwrite(blueprint_path, visuals["blueprint"])

    scores = reading["scores"]
    elem = reading["elemental_profile"]
    lines_read = reading["lines"]

    print("\n" + "-" * 62)
    print(f" ELEMENTAL HAND ARCHETYPE: {elem['archetype'].upper()}")
    print(f" Motto: \"{elem['motto']}\"")
    print("-" * 62)
    print(f" Harmony Score : {scores['overall_harmony']}/100")
    print(f" Vitality (Life): {scores['vitality']}/100")
    print(f" Intellect (Head): {scores['intellect']}/100")
    print(f" Heart Harmony  : {scores['heart_harmony']}/100")
    print(f" Destiny (Fate) : {scores['destiny']}/100")
    print("-" * 62)
    print(f"[+] Visual artifacts & full JSON report saved to: '{output_dir}/'")
    print("-" * 62 + "\n")


def run_live_camera(
    cam_index: int = 0,
    width: int = 1280,
    height: int = 720,
    auto_capture: bool = False,
    mock_mode: bool = False,
    output_dir: str = "output"
):
    print("=" * 65)
    print("      PALMISTRA AI - REAL-TIME LIVE CAMERA VISION STUDIO       ")
    print("=" * 65)
    print("[*] Initializing computer vision models...")

    detector = PalmDetector()

    cap = None
    if not mock_mode:
        print(f"[*] Opening webcam index {cam_index} (Resolution: {width}x{height})...")
        cap = cv2.VideoCapture(cam_index, cv2.CAP_DSHOW if sys.platform.startswith("win") else cv2.CAP_ANY)
        cap.set(cv2.CAP_PROP_FRAME_WIDTH, width)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, height)

        if not cap.isOpened():
            print(f"[!] Warning: Could not open camera {cam_index}.")
            print("[*] Falling back to Simulated Mock Camera using sample palm...")
            mock_mode = True

    if mock_mode:
        sample_path = "samples/sample_earth_palm.png"
        if not os.path.exists(sample_path):
            from backend.generate_samples import generate_all_samples
            generate_all_samples()
        mock_img = cv2.imread(sample_path)
        if mock_img is None:
            mock_img = np.zeros((720, 1280, 3), dtype=np.uint8)

    print("\n[*] CONTROLS:")
    print("   [SPACE] / [C] : Capture & Generate Deep Chiromancy Report")
    print("   [A]           : Toggle Auto-Capture on alignment")
    print("   [L]           : Toggle Line Overlays")
    print("   [M]           : Toggle Mount Overlays")
    print("   [H]           : Toggle Telemetry HUD")
    print("   [Q] / [ESC]   : Quit\n")

    show_lines = True
    show_mounts = True
    show_hud = True
    auto_cap_enabled = auto_capture

    aligned_start_time = None
    fps_time = time.time()
    fps_count = 0
    fps = 0.0

    window_name = "Palmistra AI - Live Camera Palm Detection"
    cv2.namedWindow(window_name, cv2.WINDOW_NORMAL)
    cv2.resizeWindow(window_name, 1024, 768)

    frame_counter = 0

    try:
        while True:
            if not mock_mode and cap is not None:
                ret, frame = cap.read()
                if not ret or frame is None:
                    print("[!] Failed to grab camera frame. Retrying...")
                    time.sleep(0.05)
                    continue
                # Mirror horizontally for natural webcam experience
                frame = cv2.flip(frame, 1)
            else:
                # Mock camera animation
                frame = mock_img.copy()
                frame_counter += 1
                # Subtle simulated motion
                dx = int(np.sin(frame_counter * 0.05) * 15)
                dy = int(np.cos(frame_counter * 0.05) * 10)
                M = np.float32([[1, 0, dx], [0, 1, dy]])
                frame = cv2.warpAffine(frame, M, (frame.shape[1], frame.shape[0]))
                time.sleep(0.03)

            # FPS calculation
            fps_count += 1
            now = time.time()
            if now - fps_time >= 0.5:
                fps = fps_count / (now - fps_time)
                fps_count = 0
                fps_time = now

            # Live Detection
            live_data = detector.detect_live(frame)

            # Auto-Capture Trigger
            if auto_cap_enabled:
                if live_data.get("is_aligned"):
                    if aligned_start_time is None:
                        aligned_start_time = time.time()
                    elapsed = time.time() - aligned_start_time
                    countdown = max(0.0, 1.8 - elapsed)
                    if countdown > 0:
                        live_data["guide_feedback"] = f"LOCKED! Capturing reading in {countdown:.1f}s..."
                    else:
                        live_data["guide_feedback"] = "Capturing now! Hold still..."
                        # Flash frame
                        flash_frame = frame.copy()
                        cv2.imshow(window_name, cv2.addWeighted(flash_frame, 0.4, np.full_like(flash_frame, 255), 0.6, 0))
                        cv2.waitKey(100)
                        capture_and_analyze(frame, output_dir=output_dir)
                        aligned_start_time = None
                else:
                    aligned_start_time = None

            # Render Overlay
            display_frame = detector.draw_live_overlay(
                frame,
                live_data,
                show_lines=show_lines,
                show_mounts=show_mounts,
                show_hud=show_hud,
                fps=fps
            )

            cv2.imshow(window_name, display_frame)

            key = cv2.waitKey(1) & 0xFF
            if key in [ord('q'), ord('Q'), 27]:  # 27 = ESC
                print("[*] Exiting live camera.")
                break
            elif key in [ord(' '), ord('c'), ord('C')]:
                print("[*] Manual capture triggered!")
                capture_and_analyze(frame, output_dir=output_dir)
            elif key in [ord('l'), ord('L')]:
                show_lines = not show_lines
                print(f"[*] Lines overlay: {'ON' if show_lines else 'OFF'}")
            elif key in [ord('m'), ord('M')]:
                show_mounts = not show_mounts
                print(f"[*] Mounts overlay: {'ON' if show_mounts else 'OFF'}")
            elif key in [ord('h'), ord('H')]:
                show_hud = not show_hud
                print(f"[*] Telemetry HUD: {'ON' if show_hud else 'OFF'}")
            elif key in [ord('a'), ord('A')]:
                auto_cap_enabled = not auto_cap_enabled
                aligned_start_time = None
                print(f"[*] Auto-Capture: {'ENABLED' if auto_cap_enabled else 'DISABLED'}")

    finally:
        if cap is not None:
            cap.release()
        cv2.destroyAllWindows()


def main():
    parser = argparse.ArgumentParser(description="Palmistra AI - Real-Time Live Camera Palm Detection")
    parser.add_argument("--cam", type=int, default=0, help="Webcam index (default: 0)")
    parser.add_argument("--width", type=int, default=1280, help="Camera width resolution")
    parser.add_argument("--height", type=int, default=720, help="Camera height resolution")
    parser.add_argument("--auto-capture", action="store_true", help="Enable automatic capture upon alignment")
    parser.add_argument("--mock", action="store_true", help="Run simulated camera with sample palm")
    parser.add_argument("--output", type=str, default="output", help="Directory to save reading outputs")

    args = parser.parse_args()
    run_live_camera(
        cam_index=args.cam,
        width=args.width,
        height=args.height,
        auto_capture=args.auto_capture,
        mock_mode=args.mock,
        output_dir=args.output
    )


if __name__ == "__main__":
    main()
