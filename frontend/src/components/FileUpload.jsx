import { useState, useRef } from 'react';
import { Upload, X, FileText, Loader2 } from 'lucide-react';

const FileUpload = ({ onFileUpload, isLoading }) => {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const fileInputRef = useRef(null);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = (file) => {
    setSelectedFile(file);
    onFileUpload(file);
  };

  const onButtonClick = () => {
    fileInputRef.current.click();
  };

  const removeFile = () => {
    setSelectedFile(null);
  };

  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleChange}
        accept=".pdf,.doc,.docx,.txt"
      />

      <div
        className={`
          relative 
          flex 
          flex-col 
          items-center 
          justify-center 
          p-8
          border-2 
          border-dashed 
          rounded-xl
          transition-colors
          ${dragActive
            ? 'border-violet-400 bg-violet-50'
            : 'border-gray-300 hover:border-violet-400 '
          }
        `}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        {isLoading ? (
          <div className="flex flex-col items-center space-y-4">
            <Loader2 className="w-12 h-12 text-violet-600 animate-spin" />
            <p className="text-lg font-medium text-gray-200">Processing document...</p>
          </div>
        ) : selectedFile ? (
          <div className="w-full">
            <div className="flex items-center justify-between p-4 bg-violet-50 rounded-lg">
              <div className="flex items-center space-x-4">
                <FileText className="w-8 h-8 text-violet-600" />
                <div>
                  <p className="font-medium text-gray-800">{selectedFile.name}</p>
                  <p className="text-sm text-gray-500">
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              </div>
              <button
                onClick={removeFile}
                className="p-1 hover:bg-violet-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-violet-600" />
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-6 p-4 bg-violet-50 rounded-full">
              <Upload className="w-8 h-8 text-violet-600" />
            </div>
            <p className="mb-2 text-lg font-medium text-gray-300">
              Drop your document here
            </p>
            <p className="mb-4 text-sm text-gray-500">
              Support for PDF, DOC, DOCX, and TXT files
            </p>
            <button
              onClick={onButtonClick}
              className="px-6 py-3 bg-violet-600 hover:bg-violet-700 text-white font-medium rounded-lg transition-colors"
            >
              Choose File
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default FileUpload;