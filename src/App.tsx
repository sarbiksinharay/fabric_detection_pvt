import { useState, useEffect } from 'react';
import { Activity, Layers } from 'lucide-react';
import { FileUploader } from './components/FileUploader';
import { ImagePreview } from './components/ImagePreview';
import { Controls } from './components/Controls';
import { ResultsDisplay } from './components/ResultsDisplay';
import { checkHealth, getModels, runInference, type Detection, type ModelInfo } from './lib/api';

function App() {
  const [files, setFiles] = useState<File[]>([]);
  const [confThreshold, setConfThreshold] = useState(0.35);
  const [iouThreshold, setIouThreshold] = useState(0.45);
  const [nms, setNms] = useState(true);
  const [classFilter, setClassFilter] = useState<string[]>([]);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('ultra');
  const [isHealthy, setIsHealthy] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [overlayPng, setOverlayPng] = useState<string | null>(null);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [meta, setMeta] = useState<any>(null);

  useEffect(() => {
    async function initialize() {
      try {
        const health = await checkHealth();
        setIsHealthy(health.model_loaded);

        const modelsData = await getModels();
        setModels(modelsData.available);
        setSelectedModel(modelsData.current);
      } catch (err) {
        console.error('Failed to initialize:', err);
        setIsHealthy(false);
      }
    }

    initialize();
  }, []);

  const handleFilesSelected = (newFiles: File[]) => {
    setFiles([...files, ...newFiles]);
    setError(null);
  };

  const handleRemoveFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  const handleRunDetection = async () => {
    if (files.length === 0) {
      setError('Please upload at least one image');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await runInference(
        files[0],
        selectedModel,
        confThreshold,
        iouThreshold,
        nms,
        classFilter
      );

      setOverlayPng(result.overlay_png);
      setDetections(result.detections);
      setMeta(result.meta);
    } catch (err: any) {
      setError(err.message || 'Inference failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadPng = () => {
    if (!overlayPng) return;

    const link = document.createElement('a');
    link.href = `data:image/png;base64,${overlayPng}`;
    link.download = `fabric-defects-${Date.now()}.png`;
    link.click();
  };

  const handleDownloadJson = () => {
    if (detections.length === 0) return;

    const data = JSON.stringify({ detections, meta }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `fabric-defects-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <header className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Layers className="w-10 h-10 text-blue-600" />
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  Fabric Defect Detection
                </h1>
                <p className="text-sm text-gray-600 mt-1">
                  Upload images to detect fabric defects using AI
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {models.length > 0 && (
                <div>
                  <label className="text-xs text-gray-500 uppercase block mb-1">
                    Model
                  </label>
                  <select
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {models.map((model) => (
                      <option key={model.id} value={model.id}>
                        {model.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex items-center gap-2">
                <div
                  className={`w-3 h-3 rounded-full ${
                    isHealthy === null
                      ? 'bg-gray-400'
                      : isHealthy
                      ? 'bg-green-500'
                      : 'bg-red-500'
                  }`}
                />
                <span className="text-sm text-gray-600">
                  {isHealthy === null
                    ? 'Checking...'
                    : isHealthy
                    ? 'Model Ready'
                    : 'Model Unavailable'}
                </span>
              </div>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">
                Upload Images
              </h2>
              <FileUploader
                onFilesSelected={handleFilesSelected}
                disabled={isLoading}
              />
              <ImagePreview files={files} onRemove={handleRemoveFile} />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-800 text-sm">{error}</p>
              </div>
            )}

            <button
              onClick={handleRunDetection}
              disabled={isLoading || files.length === 0 || !isHealthy}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {isLoading ? (
                <>
                  <Activity className="w-5 h-5 animate-spin" />
                  Running Detection...
                </>
              ) : (
                <>
                  <Activity className="w-5 h-5" />
                  Run Detection
                </>
              )}
            </button>

            <ResultsDisplay
              overlayPng={overlayPng}
              detections={detections}
              meta={meta}
              onDownloadPng={handleDownloadPng}
              onDownloadJson={handleDownloadJson}
            />
          </div>

          <div>
            <div className="sticky top-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">
                Detection Parameters
              </h2>
              <Controls
                confThreshold={confThreshold}
                iouThreshold={iouThreshold}
                nms={nms}
                classFilter={classFilter}
                onConfChange={setConfThreshold}
                onIouChange={setIouThreshold}
                onNmsChange={setNms}
                onClassFilterChange={setClassFilter}
                disabled={isLoading}
              />
            </div>
          </div>
        </div>

        <footer className="mt-12 pt-6 border-t border-gray-200 text-center">
          <p className="text-sm text-gray-600">
            This is a demonstration of offline, local AI inference for fabric defect
            detection.
          </p>
          <p className="text-xs text-gray-500 mt-2">
            Powered by YOLOv8 and FastAPI
          </p>
        </footer>
      </div>
    </div>
  );
}

export default App;
