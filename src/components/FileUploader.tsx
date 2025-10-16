import { Upload } from 'lucide-react';
import { useRef } from 'react';

interface FileUploaderProps {
  onFilesSelected: (files: File[]) => void;
  disabled?: boolean;
}

export function FileUploader({ onFilesSelected, disabled }: FileUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (disabled) return;

    const files = Array.from(e.dataTransfer.files).filter((file) =>
      file.type.startsWith('image/')
    );

    if (files.length > 0) {
      onFilesSelected(files);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      onFilesSelected(files);
    }
  };

  const handleClick = () => {
    if (!disabled) {
      fileInputRef.current?.click();
    }
  };

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onClick={handleClick}
      className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
        disabled
          ? 'border-gray-300 bg-gray-50 cursor-not-allowed'
          : 'border-blue-400 bg-blue-50 hover:bg-blue-100 cursor-pointer'
      }`}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileInput}
        className="hidden"
        disabled={disabled}
      />
      <Upload className="w-12 h-12 mx-auto mb-4 text-blue-600" />
      <p className="text-lg font-medium text-gray-700 mb-2">
        Drop images here or click to browse
      </p>
      <p className="text-sm text-gray-500">
        Supports JPG, PNG, and WebP up to 10MB
      </p>
    </div>
  );
}
