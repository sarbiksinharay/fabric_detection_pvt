const API_BASE_URL = 'http://localhost:8000';

export interface Detection {
  class: string;
  score: number;
  bbox: [number, number, number, number];
  mask?: number[][];
}

export interface InferenceResult {
  detections: Detection[];
  meta: {
    width: number;
    height: number;
    inference_ms: number;
    kept: number;
    discarded_below_threshold: number;
  };
  overlay_png: string;
}

export interface HealthResponse {
  status: string;
  model_loaded: boolean;
  backend: string;
  yolo_available: boolean;
  hf_available: boolean;
}

export interface ModelInfo {
  id: string;
  label: string;
}

export interface ModelsResponse {
  available: ModelInfo[];
  current: string;
}

export async function checkHealth(): Promise<HealthResponse> {
  const response = await fetch(`${API_BASE_URL}/health`);
  if (!response.ok) {
    throw new Error('Failed to check health');
  }
  return response.json();
}

export async function getModels(): Promise<ModelsResponse> {
  const response = await fetch(`${API_BASE_URL}/models`);
  if (!response.ok) {
    throw new Error('Failed to fetch models');
  }
  return response.json();
}

export async function runInference(
  file: File,
  modelId: string,
  confThreshold: number,
  iouThreshold: number,
  nms: boolean,
  classFilter: string[]
): Promise<InferenceResult> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('model_id', modelId);
  formData.append('conf_threshold', confThreshold.toString());
  formData.append('iou_threshold', iouThreshold.toString());
  formData.append('nms', nms.toString());

  if (classFilter.length > 0) {
    formData.append('class_filter', classFilter.join(','));
  }

  const response = await fetch(`${API_BASE_URL}/infer`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Inference failed');
  }

  return response.json();
}
