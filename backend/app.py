import io
import base64
import time
import os
from pathlib import Path
from typing import List, Optional, Dict, Any

import numpy as np
from PIL import Image, ImageDraw, ImageFont
from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import cv2

app = FastAPI(title="Fabric Defect Detection API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MODEL_STATE = {
    "yolo_available": False,
    "hf_available": False,
    "current_model": None,
    "yolo_model": None,
    "hf_pipeline": None
}

FABRIC_CLASSES = [
    "hole",
    "stain",
    "weave_defect",
    "scratch",
    "foreign_fiber",
    "other"
]

CLASS_COLORS = {
    "hole": (255, 0, 0),
    "stain": (255, 165, 0),
    "weave_defect": (0, 255, 0),
    "scratch": (0, 0, 255),
    "foreign_fiber": (255, 255, 0),
    "other": (128, 128, 128)
}


def initialize_models():
    try:
        from ultralytics import YOLO

        models_dir = Path("./models")
        fabric_model_path = models_dir / "fabric.pt"

        if fabric_model_path.exists():
            MODEL_STATE["yolo_model"] = YOLO(str(fabric_model_path))
            print(f"Loaded custom fabric model from {fabric_model_path}")
        else:
            MODEL_STATE["yolo_model"] = YOLO("yolov8n.pt")
            print("Loaded generic YOLOv8n model (no custom fabric.pt found)")

        MODEL_STATE["yolo_available"] = True
        MODEL_STATE["current_model"] = "ultra"
        print("YOLOv8 initialized successfully")
    except Exception as e:
        print(f"Failed to load YOLOv8: {e}")
        MODEL_STATE["yolo_available"] = False

    if not MODEL_STATE["yolo_available"]:
        try:
            from transformers import pipeline
            MODEL_STATE["hf_pipeline"] = pipeline("object-detection", model="facebook/detr-resnet-50")
            MODEL_STATE["hf_available"] = True
            MODEL_STATE["current_model"] = "hf"
            print("HuggingFace DETR model initialized successfully")
        except Exception as e:
            print(f"Failed to load HuggingFace model: {e}")
            MODEL_STATE["hf_available"] = False


@app.on_event("startup")
async def startup_event():
    initialize_models()


@app.get("/health")
async def health_check():
    return {
        "status": "ok",
        "model_loaded": MODEL_STATE["yolo_available"] or MODEL_STATE["hf_available"],
        "backend": "fastapi",
        "yolo_available": MODEL_STATE["yolo_available"],
        "hf_available": MODEL_STATE["hf_available"]
    }


@app.get("/models")
async def get_models():
    available = []

    if MODEL_STATE["yolo_available"]:
        available.append({"id": "ultra", "label": "YOLOv8 (preferred)"})

    if MODEL_STATE["hf_available"]:
        available.append({"id": "hf", "label": "HuggingFace DETR (fallback)"})

    return {
        "available": available,
        "current": MODEL_STATE["current_model"]
    }


def resize_image_if_needed(img: Image.Image, max_size: int = 2048) -> Image.Image:
    width, height = img.size
    max_dim = max(width, height)

    if max_dim > max_size:
        scale = max_size / max_dim
        new_width = int(width * scale)
        new_height = int(height * scale)
        return img.resize((new_width, new_height), Image.Resampling.LANCZOS)

    return img


def apply_nms(detections: List[Dict], iou_threshold: float) -> List[Dict]:
    if len(detections) == 0:
        return []

    boxes = np.array([d["bbox"] for d in detections])
    scores = np.array([d["score"] for d in detections])

    x1 = boxes[:, 0]
    y1 = boxes[:, 1]
    x2 = boxes[:, 0] + boxes[:, 2]
    y2 = boxes[:, 1] + boxes[:, 3]

    areas = (x2 - x1) * (y2 - y1)
    order = scores.argsort()[::-1]

    keep = []
    while order.size > 0:
        i = order[0]
        keep.append(i)

        xx1 = np.maximum(x1[i], x1[order[1:]])
        yy1 = np.maximum(y1[i], y1[order[1:]])
        xx2 = np.minimum(x2[i], x2[order[1:]])
        yy2 = np.minimum(y2[i], y2[order[1:]])

        w = np.maximum(0.0, xx2 - xx1)
        h = np.maximum(0.0, yy2 - yy1)
        inter = w * h

        iou = inter / (areas[i] + areas[order[1:]] - inter)

        inds = np.where(iou <= iou_threshold)[0]
        order = order[inds + 1]

    return [detections[i] for i in keep]


def run_yolo_inference(
    img: Image.Image,
    conf_threshold: float,
    iou_threshold: float,
    nms: bool
) -> tuple[List[Dict], float, int]:
    start_time = time.time()

    img_array = np.array(img)

    results = MODEL_STATE["yolo_model"].predict(
        img_array,
        conf=conf_threshold,
        iou=iou_threshold,
        agnostic_nms=nms,
        verbose=False
    )

    inference_ms = int((time.time() - start_time) * 1000)

    detections = []
    result = results[0]

    if result.boxes is not None:
        boxes = result.boxes
        for i in range(len(boxes)):
            box = boxes.xyxy[i].cpu().numpy()
            conf = float(boxes.conf[i].cpu().numpy())
            cls_id = int(boxes.cls[i].cpu().numpy())

            class_name = result.names.get(cls_id, "other")
            if class_name not in FABRIC_CLASSES and cls_id < len(FABRIC_CLASSES):
                class_name = FABRIC_CLASSES[cls_id]
            elif class_name not in FABRIC_CLASSES:
                class_name = "other"

            x1, y1, x2, y2 = box
            detection = {
                "class": class_name,
                "score": conf,
                "bbox": [int(x1), int(y1), int(x2 - x1), int(y2 - y1)]
            }

            if result.masks is not None and i < len(result.masks):
                mask = result.masks.xy[i]
                detection["mask"] = mask.tolist()

            detections.append(detection)

    discarded = 0

    return detections, inference_ms, discarded


def run_hf_inference(
    img: Image.Image,
    conf_threshold: float,
    iou_threshold: float,
    nms: bool
) -> tuple[List[Dict], float, int]:
    start_time = time.time()

    results = MODEL_STATE["hf_pipeline"](img, threshold=conf_threshold)

    inference_ms = int((time.time() - start_time) * 1000)

    detections = []
    for det in results:
        box = det["box"]
        detection = {
            "class": det["label"] if det["label"] in FABRIC_CLASSES else "other",
            "score": det["score"],
            "bbox": [box["xmin"], box["ymin"], box["xmax"] - box["xmin"], box["ymax"] - box["ymin"]]
        }
        detections.append(detection)

    original_count = len(detections)

    if nms:
        detections = apply_nms(detections, iou_threshold)

    discarded = original_count - len(detections)

    return detections, inference_ms, discarded


def filter_by_classes(detections: List[Dict], class_filter: Optional[List[str]]) -> tuple[List[Dict], int]:
    if not class_filter or len(class_filter) == 0:
        return detections, 0

    filtered = [d for d in detections if d["class"] in class_filter]
    discarded = len(detections) - len(filtered)

    return filtered, discarded


def draw_overlays(img: Image.Image, detections: List[Dict]) -> Image.Image:
    overlay = img.copy()
    draw = ImageDraw.Draw(overlay)

    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 16)
    except:
        font = ImageFont.load_default()

    for det in detections:
        class_name = det["class"]
        score = det["score"]
        bbox = det["bbox"]

        color = CLASS_COLORS.get(class_name, (128, 128, 128))

        x, y, w, h = bbox

        if "mask" in det and det["mask"]:
            mask_points = det["mask"]
            if len(mask_points) > 2:
                draw.polygon([(p[0], p[1]) for p in mask_points], outline=color, width=2)
        else:
            draw.rectangle([x, y, x + w, y + h], outline=color, width=3)

        label = f"{class_name} {score:.0%}"

        try:
            bbox_text = draw.textbbox((x, y - 20), label, font=font)
            text_width = bbox_text[2] - bbox_text[0]
            text_height = bbox_text[3] - bbox_text[1]
        except:
            text_width = len(label) * 8
            text_height = 16

        draw.rectangle([x, y - text_height - 4, x + text_width + 8, y], fill=color)
        draw.text((x + 4, y - text_height - 2), label, fill=(255, 255, 255), font=font)

    return overlay


@app.post("/infer")
async def infer(
    file: UploadFile = File(...),
    model_id: str = Form("ultra"),
    conf_threshold: float = Form(0.35),
    iou_threshold: float = Form(0.45),
    nms: bool = Form(True),
    class_filter: Optional[str] = Form(None)
):
    if file.content_type not in ["image/jpeg", "image/png", "image/webp"]:
        raise HTTPException(status_code=400, detail="Invalid file type. Only JPEG, PNG, and WebP are supported.")

    try:
        contents = await file.read()

        if len(contents) > 10 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="File size exceeds 10MB limit.")

        img = Image.open(io.BytesIO(contents))

        if img.mode != "RGB":
            img = img.convert("RGB")

        img = resize_image_if_needed(img)

        width, height = img.size

        if model_id == "ultra" and MODEL_STATE["yolo_available"]:
            detections, inference_ms, discarded = run_yolo_inference(
                img, conf_threshold, iou_threshold, nms
            )
        elif model_id == "hf" and MODEL_STATE["hf_available"]:
            detections, inference_ms, discarded = run_hf_inference(
                img, conf_threshold, iou_threshold, nms
            )
        else:
            raise HTTPException(status_code=400, detail=f"Model {model_id} is not available.")

        class_filter_list = None
        if class_filter and class_filter.strip():
            class_filter_list = [c.strip() for c in class_filter.split(",")]

        filtered_detections, filter_discarded = filter_by_classes(detections, class_filter_list)
        discarded += filter_discarded

        overlay = draw_overlays(img, filtered_detections)

        buffered = io.BytesIO()
        overlay.save(buffered, format="PNG")
        overlay_base64 = base64.b64encode(buffered.getvalue()).decode()

        return {
            "detections": filtered_detections,
            "meta": {
                "width": width,
                "height": height,
                "inference_ms": inference_ms,
                "kept": len(filtered_detections),
                "discarded_below_threshold": discarded
            },
            "overlay_png": overlay_base64
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Inference failed: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
