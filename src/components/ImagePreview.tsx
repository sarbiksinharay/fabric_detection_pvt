import { X } from 'lucide-react';

interface ImagePreviewProps {
  files: File[];
  onRemove: (index: number) => void;
}

export function ImagePreview({ files, onRemove }: ImagePreviewProps) {
  if (files.length === 0) return null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-6">
      {files.map((file, index) => (
        <div key={index} className="relative group">
          <img
            src={URL.createObjectURL(file)}
            alt={file.name}
            className="w-full h-32 object-cover rounded-lg border-2 border-gray-200"
          />
          <button
            onClick={() => onRemove(index)}
            className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
            aria-label={`Remove ${file.name}`}
          >
            <X className="w-4 h-4" />
          </button>
          <p className="text-xs text-gray-600 mt-1 truncate">{file.name}</p>
        </div>
      ))}
    </div>
  );
}
