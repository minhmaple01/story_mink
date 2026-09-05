import React, { useCallback, useState } from 'react';
import { Upload, FileText, FileSpreadsheet, AlertCircle } from 'lucide-react';

interface DropzoneProps {
  onFileLoaded: (content: string, fileName: string) => void;
  onExcelLoaded?: (file: File) => void;
  isLoading: boolean;
}

const Dropzone: React.FC<DropzoneProps> = ({ onFileLoaded, onExcelLoaded, isLoading }) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!isLoading) setIsDragOver(true);
  }, [isLoading]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const processFile = (file: File) => {
    setError(null);
    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');

    if (isExcel && onExcelLoaded) {
      onExcelLoaded(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result;
      if (typeof text === 'string') {
        onFileLoaded(text, file.name);
      }
    };
    reader.onerror = () => setError("Không thể đọc tệp tin.");
    reader.readAsText(file);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (isLoading) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  }, [isLoading, onFileLoaded, onExcelLoaded]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`
        relative group border border-dashed rounded-lg p-6 transition-all duration-200
        flex items-center gap-4 cursor-pointer w-full
        ${isLoading ? 'opacity-50 cursor-not-allowed border-slate-200' : ''}
        ${isDragOver 
          ? 'border-indigo-500 bg-indigo-50' 
          : 'border-slate-300 hover:border-slate-400 hover:bg-slate-50'
        }
      `}
    >
      <input
        type="file"
        accept=".srt,.txt,.xlsx,.xls"
        onChange={handleInputChange}
        disabled={isLoading}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
      />
      
      <div className="flex-shrink-0 bg-white p-2.5 rounded-md border border-slate-100 shadow-sm transition-transform">
        {isDragOver ? (
          <Upload className="w-5 h-5 text-indigo-600" />
        ) : (
          <div className="flex items-center gap-1">
            <FileText className="w-5 h-5 text-slate-400 group-hover:text-indigo-500" />
          </div>
        )}
      </div>

      <div className="text-left">
        <h3 className="text-sm font-bold text-slate-700">
          {isDragOver ? 'Thả để tải lên' : 'Tải lên phụ đề hoặc tệp Excel'}
        </h3>
        <p className="text-[11px] text-slate-400 uppercase tracking-tight">
          Tệp SRT, TXT hoặc XLSX (nạp lại để tiếp tục)
        </p>
      </div>

      {error && (
        <div className="absolute top-full left-0 right-0 mt-2 flex items-center gap-2 text-red-500 text-[10px] bg-red-50 px-2 py-1 rounded border border-red-100 italic">
          <AlertCircle size={12} />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};

export default Dropzone;