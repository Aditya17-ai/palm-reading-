"""
Sample Palm Generator
Synthesizes realistic sample hand and palm images with authentic skin gradients,
hand contours, finger silhouettes, and major palmistry creases for instant testing.
"""

import os
import cv2
import numpy as np


def create_synthetic_palm(
    hand_type: str = "Earth",
    skin_tone: tuple = (195, 215, 240), # BGR warm skin tone
    output_path: str = "samples/sample_palm.png"
):
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    w, h = 600, 750
    img = np.zeros((h, w, 3), dtype=np.uint8)
    img[:] = (24, 20, 18) # Dark aesthetic background

    # 1. Base skin mask with hand & fingers contour
    hand_canvas = np.zeros((h, w, 3), dtype=np.uint8)

    # Palm body center
    cx, cy = 300, 420
    palm_rx = 160 if hand_type in ["Earth", "Air"] else 140
    palm_ry = 170 if hand_type in ["Earth", "Fire"] else 190

    # Draw palm base
    cv2.ellipse(hand_canvas, (cx, cy), (palm_rx, palm_ry), 0, 0, 360, skin_tone, -1, cv2.LINE_AA)

    # Draw wrist base
    wrist_pts = np.array([
        [cx - 100, cy + 140],
        [cx + 100, cy + 140],
        [cx + 85, cy + 280],
        [cx - 85, cy + 280]
    ], np.int32)
    cv2.fillPoly(hand_canvas, [wrist_pts], skin_tone, cv2.LINE_AA)

    # Draw 5 fingers
    # Thumb
    cv2.ellipse(hand_canvas, (cx - 165, cy + 30), (45, 95), -45, 0, 360, skin_tone, -1, cv2.LINE_AA)
    # Index finger
    cv2.ellipse(hand_canvas, (cx - 95, cy - 180), (32, 110), -5, 0, 360, skin_tone, -1, cv2.LINE_AA)
    # Middle finger
    cv2.ellipse(hand_canvas, (cx - 25, cy - 215), (34, 125), 0, 0, 360, skin_tone, -1, cv2.LINE_AA)
    # Ring finger
    cv2.ellipse(hand_canvas, (cx + 45, cy - 195), (32, 115), 4, 0, 360, skin_tone, -1, cv2.LINE_AA)
    # Pinky finger
    cv2.ellipse(hand_canvas, (cx + 115, cy - 145), (28, 90), 10, 0, 360, skin_tone, -1, cv2.LINE_AA)

    # Smooth the hand silhouette
    gray_mask = cv2.cvtColor(hand_canvas, cv2.COLOR_BGR2GRAY)
    _, binary = cv2.threshold(gray_mask, 10, 255, cv2.THRESH_BINARY)
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (15, 15))
    closed_mask = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel)
    closed_mask = cv2.GaussianBlur(closed_mask, (7, 7), 0)

    # Add 3D organic skin shading and texture
    skin_rendered = np.zeros((h, w, 3), dtype=np.uint8)
    y_coords, x_coords = np.indices((h, w))
    dist_from_palm = np.sqrt(((x_coords - cx) / palm_rx) ** 2 + ((y_coords - cy) / palm_ry) ** 2)
    shading = np.clip(1.0 - 0.28 * dist_from_palm, 0.65, 1.05)

    for c in range(3):
        skin_rendered[:, :, c] = np.clip(skin_tone[c] * shading, 0, 255).astype(np.uint8)

    # Subtle palm mount bulges (highlights)
    # Venus mount highlight
    venus_dist = np.sqrt((x_coords - (cx - 65))**2 + (y_coords - (cy + 75))**2)
    venus_light = np.clip(np.exp(- (venus_dist / 65)**2) * 22, 0, 25).astype(np.uint8)
    # Luna mount highlight
    luna_dist = np.sqrt((x_coords - (cx + 75))**2 + (y_coords - (cy + 85))**2)
    luna_light = np.clip(np.exp(- (luna_dist / 60)**2) * 18, 0, 25).astype(np.uint8)

    skin_rendered = cv2.add(skin_rendered, cv2.merge([venus_light, venus_light, venus_light]))
    skin_rendered = cv2.add(skin_rendered, cv2.merge([luna_light, luna_light, luna_light]))

    # Now add authentic palm creases (darker shadows)
    crease_layer = np.zeros((h, w), dtype=np.uint8)

    # Crease darker color tone
    crease_color = tuple(max(10, int(c * 0.62)) for c in skin_tone)

    # 1. Life line
    life_pts = np.array([
        [cx - 105, cy - 40],
        [cx - 95, cy + 10],
        [cx - 75, cy + 70],
        [cx - 45, cy + 125],
        [cx - 15, cy + 160],
        [cx + 5, cy + 175]
    ], np.int32)
    # Smooth spline
    cv2.polylines(crease_layer, [life_pts], False, 200, 3, cv2.LINE_AA)

    # 2. Head line
    if hand_type == "Earth":
        head_pts = np.array([
            [cx - 100, cy - 35],
            [cx - 50, cy - 20],
            [cx + 10, cy - 10],
            [cx + 65, cy - 5],
            [cx + 105, cy - 0]
        ], np.int32)
    else:
        head_pts = np.array([
            [cx - 100, cy - 35],
            [cx - 50, cy - 20],
            [cx + 10, cy - 5],
            [cx + 60, cy + 25],
            [cx + 95, cy + 60]
        ], np.int32)
    cv2.polylines(crease_layer, [head_pts], False, 190, 3, cv2.LINE_AA)

    # 3. Heart line
    heart_pts = np.array([
        [cx + 120, cy - 65],
        [cx + 75, cy - 80],
        [cx + 20, cy - 88],
        [cx - 35, cy - 90],
        [cx - 75, cy - 80],
        [cx - 95, cy - 60]
    ], np.int32)
    cv2.polylines(crease_layer, [heart_pts], False, 210, 3, cv2.LINE_AA)

    # 4. Fate line
    fate_pts = np.array([
        [cx + 5, cy + 170],
        [cx + 2, cy + 110],
        [cx - 2, cy + 40],
        [cx - 8, cy - 30],
        [cx - 15, cy - 95]
    ], np.int32)
    cv2.polylines(crease_layer, [fate_pts], False, 170, 2, cv2.LINE_AA)

    # Minor creases
    minor_pts = [
        np.array([[cx - 70, cy + 40], [cx - 50, cy + 45]], np.int32),
        np.array([[cx + 60, cy - 40], [cx + 85, cy - 35]], np.int32),
        np.array([[cx + 40, cy + 90], [cx + 70, cy + 105]], np.int32),
        np.array([[cx - 15, cy - 145], [cx - 10, cy - 120]], np.int32),
    ]
    for m in minor_pts:
        cv2.polylines(crease_layer, [m], False, 120, 1, cv2.LINE_AA)

    # Blur crease layer for organic look
    crease_blurred = cv2.GaussianBlur(crease_layer, (5, 5), 0)

    # Apply creases onto skin
    crease_factor = (crease_blurred.astype(np.float32) / 255.0) * 0.38
    for c in range(3):
        skin_rendered[:, :, c] = np.clip(
            skin_rendered[:, :, c] * (1.0 - crease_factor), 0, 255
        ).astype(np.uint8)

    # Composite skin over background using mask
    mask_3ch = cv2.merge([closed_mask, closed_mask, closed_mask])
    alpha = mask_3ch.astype(np.float32) / 255.0

    final_img = (alpha * skin_rendered + (1.0 - alpha) * img).astype(np.uint8)

    cv2.imwrite(output_path, final_img)
    print(f"Generated sample palm at: {output_path}")
    return output_path


def generate_all_samples():
    os.makedirs("samples", exist_ok=True)
    create_synthetic_palm("Earth", (185, 205, 235), "samples/sample_earth_palm.png")
    create_synthetic_palm("Air", (195, 215, 245), "samples/sample_air_palm.png")
    create_synthetic_palm("Fire", (170, 195, 230), "samples/sample_fire_palm.png")


if __name__ == "__main__":
    generate_all_samples()
