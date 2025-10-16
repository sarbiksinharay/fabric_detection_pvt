import { Download } from 'lucide-react';
import { Detection } from '../lib/api';
import { useState } from 'react';

interface ResultsDisplayProps {
  overlayPng: string | null;
  detections: Detection[];
  meta: {
    width: number;
    height: number;
    inference_ms: number;
    kept: number;
    discarded_below_threshold: number;
  } | null;
  onDownloadPng: () => void;
  onDownloadJson: () => void;
}

export function ResultsDisplay({
  overlayPng,
  detections,
  meta,
  onDownloadPng,
  onDownloadJson,
}: ResultsDisplayProps) {
  const [sortBy, setSortBy] = useState<'score' | 'class'>('score');

  if (!overlayPng || !meta) {
    return null;
  }

  const sortedDetections = [...detections].sort((a, b) => {
    if (sortBy === 'score') {
      return b.score - a.score;
    }
    return a.class.localeCompare(b.class);
  });

  const classGroups = detections.reduce((acc, det) => {
    acc[det.class] = (acc[det.class] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="mt-8 space-y-6">
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-800">Detection Results</h2>
          <div className="flex gap-2">
            <button
              onClick={onDownloadPng}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Download className="w-4 h-4" />
              Download PNG
            </button>
            <button
              onClick={onDownloadJson}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Download className="w-4 h-4" />
              Download JSON
            </button>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
          <div>
            <p className="text-xs text-gray-500 uppercase">Inference Time</p>
            <p className="text-lg font-semibold text-gray-800">{meta.inference_ms}ms</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase">Detections</p>
            <p className="text-lg font-semibold text-gray-800">{meta.kept}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase">Filtered Out</p>
            <p className="text-lg font-semibold text-gray-800">{meta.discarded_below_threshold}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase">Image Size</p>
            <p className="text-lg font-semibold text-gray-800">
              {meta.width} × {meta.height}
            </p>
          </div>
        </div>

        <img
          src={`data:image/png;base64,${overlayPng}`}
          alt="Annotated fabric"
          className="w-full rounded-lg border border-gray-300"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Class Distribution</h3>
          <div className="space-y-2">
            {Object.entries(classGroups).map(([className, count]) => (
              <div key={className} className="flex justify-between items-center">
                <span className="text-sm text-gray-700 capitalize">
                  {className.replace('_', ' ')}
                </span>
                <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                  {count}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-800">All Detections</h3>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'score' | 'class')}
              className="px-3 py-1 border border-gray-300 rounded-lg text-sm"
            >
              <option value="score">Sort by Score</option>
              <option value="class">Sort by Class</option>
            </select>
          </div>
          <div className="max-h-96 overflow-y-auto space-y-2">
            {sortedDetections.map((det, index) => (
              <div
                key={index}
                className="flex justify-between items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div>
                  <p className="text-sm font-medium text-gray-800 capitalize">
                    {det.class.replace('_', ' ')}
                  </p>
                  <p className="text-xs text-gray-500">
                    Box: [{det.bbox[0]}, {det.bbox[1]}, {det.bbox[2]}, {det.bbox[3]}]
                  </p>
                </div>
                <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                  {(det.score * 100).toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
