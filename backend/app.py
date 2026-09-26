"""
FastAPI Server for Celestial Palm Reading AI
Provides REST endpoints for analyzing palm images, serving sample palms,
and delivering interactive palmistry reports and visual overlays.
"""

import os
import base64
import cv2
import numpy as np
from fastapi import FastAPI, File, UploadFile, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse, FileResponse
from pydantic import BaseModel
from typing import Optional

from backend.palm_detector import PalmDetector
from backend.line_extractor import LineExtractor
from backend.palmistry_engine import PalmistryEngine

app = FastAPI(
    title="Celestial Palm Reading AI API",
    description="Computer Vision & Chirology Engine for Palm Line Extraction & Readings",
    version="1.0.0"
)

# Enable CORS for local development and web frontends
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize CV & Chirology models
detector = PalmDetector()
extractor = LineExtractor()
engine = PalmistryEngine()


class Base64AnalyzeRequest(BaseModel):
    image: str  # Base64 string or data URL


class LiveDetectRequest(BaseModel):
    image: str  # Base64 string or data URL
    mirror: Optional[bool] = False
    target_x: Optional[int] = None
    target_y: Optional[int] = None
    target_r: Optional[float] = None


def image_to_base64_data_uri(img: np.ndarray, format: str = "png") -> str:
    """Encodes an OpenCV image to a base64 Data URI."""
    success, buffer = cv2.imencode(f".{format}", img)
    if not success:
        return ""
    b64_str = base64.b64encode(buffer).decode("utf-8")
    return f"data:image/{format};base64,{b64_str}"


def decode_image(image_bytes: bytes) -> np.ndarray:
    """Decodes raw image bytes into OpenCV BGR numpy array."""
    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        raise HTTPException(status_code=400, detail="Invalid image data could not be decoded.")
    return img


def decode_base64_image(base64_str: str) -> np.ndarray:
    """Decodes base64 string (including data:image/... headers) to OpenCV BGR array."""
    if "," in base64_str:
        base64_str = base64_str.split(",", 1)[1]
    try:
        raw_bytes = base64.b64decode(base64_str)
        return decode_image(raw_bytes)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to decode base64 image: {str(e)}")


def run_pipeline(img: np.ndarray) -> dict:
    """Executes the full Palm Reading AI pipeline."""
    # 1. Hand & Palm Detection
    det_res = detector.process(img)
    roi = det_res["roi"]
    mounts = det_res["mounts"]
    hand_type = det_res["hand_type"]

    # 2. Line Extraction & Ridge Filtering with Handedness & Mask
    thumb_side = det_res.get("thumb_side", "left")
    roi_mask = det_res.get("roi_hand_mask")
    ext_res = extractor.process(roi, mounts, thumb_side=thumb_side, hand_mask=roi_mask)
    lines = ext_res["lines"]
    visuals = ext_res["visualizations"]

    # 3. Palmistry Reading Engine
    reading = engine.generate_full_reading(hand_type, lines, mounts)

    # 4. Serialize line points and metrics for interactive web canvas
    serializable_lines = {}
    for name, data in lines.items():
        serializable_lines[name] = {
            "points": data["points"],
            "metrics": data["metrics"],
            "color_rgb": [int(data["color"][2]), int(data["color"][1]), int(data["color"][0])],
        }

    # Format mounts for web display
    formatted_mounts = {}
    for k, v in mounts.items():
        formatted_mounts[k] = {
            "name": v["name"],
            "meaning": v["meaning"],
            "pos": v["pos"],
            "radius": v["radius"],
            "element": v["element"],
        }

    # Encode visualizations into Base64 for instant front-end display
    encoded_visuals = {
        "overlay": image_to_base64_data_uri(visuals["overlay"], "png"),
        "ridge_map": image_to_base64_data_uri(visuals["ridge_map"], "png"),
        "blueprint": image_to_base64_data_uri(visuals["blueprint"], "png"),
        "roi": image_to_base64_data_uri(roi, "png"),
    }

    return {
        "reading": reading,
        "lines": serializable_lines,
        "mounts": formatted_mounts,
        "visualizations": encoded_visuals,
        "hand_type": hand_type,
    }


@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "service": "Celestial Palm Reading AI",
        "version": "1.0.0",
        "models": ["PalmDetector", "LineExtractor (Frangi/Sato)", "PalmistryEngine"]
    }


@app.get("/api/samples")
def get_sample_palms():
    """Returns list of pre-rendered sample palms for instant one-click testing."""
    samples = [
        {
            "id": "earth",
            "title": "Earth Hand Archetype",
            "element": "Earth",
            "description": "Square palm, grounded lines, resilient vitality and practical wisdom.",
            "path": "/samples/sample_earth_palm.png"
        },
        {
            "id": "air",
            "title": "Air Hand Archetype",
            "element": "Air",
            "description": "Balanced palm, imaginative sloping head line, intuitive faculties.",
            "path": "/samples/sample_air_palm.png"
        },
        {
            "id": "fire",
            "title": "Fire Hand Archetype",
            "element": "Fire",
            "description": "Dynamic palm ratio, high energy, bold ambition, and radiant passion.",
            "path": "/samples/sample_fire_palm.png"
        }
    ]
    return {"samples": samples}


@app.post("/api/analyze")
async def analyze_image_upload(file: UploadFile = File(...)):
    """Analyze palm image from form file upload."""
    content = await file.read()
    img = decode_image(content)
    result = run_pipeline(img)
    return JSONResponse(content=result)


@app.post("/api/analyze-base64")
async def analyze_image_base64(payload: Base64AnalyzeRequest):
    """Analyze palm image from base64 string (webcam snapshot or clipboard)."""
    img = decode_base64_image(payload.image)
    result = run_pipeline(img)
    return JSONResponse(content=result)


@app.post("/api/detect-live")
async def detect_live_frame(payload: LiveDetectRequest):
    """Ultra-fast live detection endpoint for camera streams."""
    img = decode_base64_image(payload.image)
    if payload.mirror:
        img = cv2.flip(img, 1)

    tgt_center = (payload.target_x, payload.target_y) if (payload.target_x is not None and payload.target_y is not None) else None
    result = detector.detect_live(img, target_center=tgt_center, target_radius=payload.target_r)
    return JSONResponse(content=result)



@app.post("/api/analyze-sample/{sample_id}")
async def analyze_sample(sample_id: str):
    """Analyze one of the built-in sample palms."""
    filename_map = {
        "earth": "samples/sample_earth_palm.png",
        "air": "samples/sample_air_palm.png",
        "fire": "samples/sample_fire_palm.png"
    }
    if sample_id not in filename_map:
        raise HTTPException(status_code=404, detail=f"Sample '{sample_id}' not found.")

    filepath = filename_map[sample_id]
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail=f"Sample file '{filepath}' missing.")

    img = cv2.imread(filepath)
    if img is None:
        raise HTTPException(status_code=500, detail="Failed to load sample image.")

    result = run_pipeline(img)
    return JSONResponse(content=result)


# Mount static sample images
os.makedirs("samples", exist_ok=True)
if not os.path.exists("samples/sample_earth_palm.png"):
    try:
        from backend.generate_samples import generate_all_samples
        generate_all_samples()
    except Exception as e:
        print(f"[*] Note: generating samples: {e}")

app.mount("/samples", StaticFiles(directory="samples"), name="samples")

# Mount frontend directory if it exists
if os.path.exists("frontend"):
    app.mount("/", StaticFiles(directory="frontend", html=True), name="frontend")


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    host = os.environ.get("HOST", "0.0.0.0")
    uvicorn.run("backend.app:app", host=host, port=port, reload=False)

