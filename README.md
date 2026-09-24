---
title: Palmistra AI - Celestial Palm Reading Studio
emoji: 🔮
colorFrom: purple
colorTo: indigo
sdk: docker
app_port: 7860
pinned: false
---

# Palmistra AI: Palm Reading Model & Vision Studio

An end-to-end AI platform and computer vision model for automated Palm Reading (Chiromancy & Chirology). The system analyzes hand contours, segments the palm Region of Interest (ROI), extracts fine and major creases using multi-scale Frangi Hessian ridge detection, classifies the 4 primary palmistry lines (Heart, Head, Life, Fate), maps Chirological mounts, and generates personalized, authentic palmistry readings.


---

## Key Features

1. **Computer Vision & Ridge Extraction Pipeline**:
   - **Hand Segmentation & Center Localization**: Skin color thresholding (YCrCb + HSV) and distance transform to compute the maximum inscribed circle for palm centering.
   - **Multi-Scale Frangi Hessian Ridge Filters**: Enhances crease vesselness across variable line thicknesses.
   - **Directional Sato & Gabor Filtering**: Captures diagonal and transverse crease directions.
   - **Morphological Skeletonization**: Zhang-Suen algorithm extracting 1-pixel wide line graphs.
   - **Line Trajectory Tracing**: Categorizes lines into **Heart**, **Head**, **Life**, and **Fate** with geometric curvature, depth/clarity score, and arc-length metrics.

2. **Chiromancy & Palmistry AI Engine**:
   - **Elemental Hand Types**: Classifies hand into **Earth**, **Air**, **Fire**, or **Water** based on palm-to-finger aspect ratio and solidity.
   - **Chirological Mounts**: Evaluates the Mounts of Venus (Passion), Jupiter (Ambition), Saturn (Destiny), Sun/Apollo (Creativity), Mercury (Intellect), and Luna (Intuition).
   - **Comprehensive Life Readings**:
     - *Life Line*: Physical stamina, vitality index, life transitions, and resilience.
     - *Head Line*: Analytical vs. creative intellect, focus depth, and career aptitudes.
     - *Heart Line*: Romantic temperament, emotional boundaries, and empathy.
     - *Fate Line*: Vocational clarity, self-determination, and milestone alignment.
   - **Auspicious Markings**: Detects configurations such as The Mystic Cross (*La Croix Mystique*) and The Ring of Solomon.

2. **Interactive Vision Studio Web App**:
   - **Real-Time Live Camera Detection & AR Studio**: High-speed (30+ FPS) live hand tracking, distance transform palm centering, dynamic celestial alignment reticle, live Chirological mounts projection, traced palm lines, real-time telemetry drawer, and optional auto-capture on steady alignment.
   - **Drag & Drop Upload**: Instant processing of user-uploaded palm photos.
   - **Interactive Layer Canvas**: Toggle Heart, Head, Life, Fate lines, and Mounts. Hover over any line or mount for instant metric tooltips.
   - **Multi-View Modes**: Switch between Palm Line Overlay, Frangi Ridge Heatmap, Sacred Geometry Blueprint, and Cropped ROI.
   - **Printable Reports**: Generate formatted PDF / paper readings.

3. **Desktop & Developer CLI Tools**:
   - **Live Camera Application**: Run standalone desktop OpenCV real-time detection: `python live_cam.py` or `python read_palm.py --camera`.
   - **Still Image Predictions**: Analyze images directly from terminal: `python read_palm.py --image my_palm.jpg --output output/`.

---

## Quick Start

### 1. Launch the Web Studio
Run the universal launcher:
```bash
python run.py
```
This initializes sample assets, starts the FastAPI backend, and opens `http://localhost:8000` in your web browser. Click **"Start Live Camera"** to begin instant AR palm detection!

### 2. Run Desktop Live Camera Detection (OpenCV)
Run real-time palm detection directly through your webcam:
```bash
python live_cam.py
# or
python read_palm.py --camera
```
**Controls**:
- `[SPACE]` / `[C]`: Capture frame and generate full Chiromancy report.
- `[A]`: Toggle auto-capture on steady alignment.
- `[L]`: Toggle traced palm lines overlay.
- `[M]`: Toggle Chirological mounts overlay.
- `[H]`: Toggle telemetry HUD.
- `[Q]` / `[ESC]`: Exit.

### 3. Run Static Image Analysis via CLI
Analyze any palm image directly from the terminal:
```bash
python read_palm.py --image samples/sample_earth_palm.png --output output/
```
Outputs:
- Terminal ASCII harmony score meters and chiromancy breakdown.
- Visual artifacts saved to `output/`:
  - `palm_lines_overlay.png`
  - `palm_crease_heatmap.png`
  - `palm_celestial_blueprint.png`
  - `palm_reading_report.json`

---

## Running Automated Tests

Run the test suite covering the vision pipeline, line segmentation, and API endpoints:
```bash
python -m unittest discover tests
```

---

## API Endpoints

- `GET /api/health`: Health status and active models.
- `GET /api/samples`: List of built-in sample palms.
- `POST /api/analyze`: Multipart image file upload.
- `POST /api/analyze-base64`: Base64 image payload (JSON: `{"image": "data:image/png;base64,..."}`).
- `POST /api/analyze-sample/{sample_id}`: One-click analysis of built-in sample palms (`earth`, `air`, `fire`).
