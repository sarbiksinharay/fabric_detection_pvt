interface ControlsProps {
  confThreshold: number;
  iouThreshold: number;
  nms: boolean;
  classFilter: string[];
  onConfChange: (value: number) => void;
  onIouChange: (value: number) => void;
  onNmsChange: (value: boolean) => void;
  onClassFilterChange: (classes: string[]) => void;
  disabled?: boolean;
}

const FABRIC_CLASSES = [
  'hole',
  'stain',
  'weave_defect',
  'scratch',
  'foreign_fiber',
  'other',
];

export function Controls({
  confThreshold,
  iouThreshold,
  nms,
  classFilter,
  onConfChange,
  onIouChange,
  onNmsChange,
  onClassFilterChange,
  disabled,
}: ControlsProps) {
  const handleClassToggle = (className: string) => {
    if (classFilter.includes(className)) {
      onClassFilterChange(classFilter.filter((c) => c !== className));
    } else {
      onClassFilterChange([...classFilter, className]);
    }
  };

  return (
    <div className="space-y-6 p-6 bg-white rounded-lg border border-gray-200">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Confidence Threshold: {confThreshold.toFixed(2)}
        </label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={confThreshold}
          onChange={(e) => onConfChange(parseFloat(e.target.value))}
          disabled={disabled}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          IOU Threshold: {iouThreshold.toFixed(2)}
        </label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={iouThreshold}
          onChange={(e) => onIouChange(parseFloat(e.target.value))}
          disabled={disabled}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
        />
      </div>

      <div className="flex items-center">
        <input
          type="checkbox"
          id="nms"
          checked={nms}
          onChange={(e) => onNmsChange(e.target.checked)}
          disabled={disabled}
          className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
        />
        <label htmlFor="nms" className="ml-2 text-sm font-medium text-gray-700">
          Enable NMS (Non-Maximum Suppression)
        </label>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Filter by Classes (empty = all)
        </label>
        <div className="space-y-2">
          {FABRIC_CLASSES.map((className) => (
            <div key={className} className="flex items-center">
              <input
                type="checkbox"
                id={`class-${className}`}
                checked={classFilter.includes(className)}
                onChange={() => handleClassToggle(className)}
                disabled={disabled}
                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
              />
              <label
                htmlFor={`class-${className}`}
                className="ml-2 text-sm text-gray-700 capitalize"
              >
                {className.replace('_', ' ')}
              </label>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
