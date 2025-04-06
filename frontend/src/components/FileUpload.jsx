import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { FileText, UploadCloud, X, Loader2 } from 'lucide-react'

const FileUpload = ({ onFileUpload, isLoading }) => {
  const [file, setFile] = useState(null)
  const [error, setError] = useState('')

  const onDrop = useCallback((acceptedFiles) => {
    setError('')
    if (acceptedFiles.length > 1) {
      setError('Please upload only one file at a time')
      return
    }

    const selectedFile = acceptedFiles[0]
    
    const validTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword', 
      'text/plain',
      'image/png',
      'image/jpeg',
      'image/tiff'
    ]
    
    const validExtensions = ['.pdf', '.docx', '.doc', '.txt', '.png', '.jpg', '.jpeg', '.tiff']
    
    const fileExtension = selectedFile.name.split('.').pop().toLowerCase()
    if (!validTypes.includes(selectedFile.type) && 
        !validExtensions.includes(`.${fileExtension}`)) {
      setError('Please upload a PDF, DOC, DOCX, TXT, or image file')
      return
    }

    if (selectedFile.size > 20 * 1024 * 1024) {
      setError('File size must be less than 20MB')
      return
    }

    setFile(selectedFile)
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt'],
    },
    maxFiles: 1,
  })

  const removeFile = () => {
    setFile(null)
    setError('')
  }

  const handleSubmit = () => {
    if (file) {
      onFileUpload(file)
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
          isDragActive ? 'border-primary-500 bg-primary-50' : 'border-gray-300 hover:border-primary-500'
        }`}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center justify-center space-y-3">
          <UploadCloud className="w-12 h-12 text-primary-500" strokeWidth={1.5} />
          {isDragActive ? (
            <p className="text-lg font-medium text-primary-600">Drop the file here</p>
          ) : (
            <>
              <p className="text-lg font-medium text-gray-700">
                Drag & drop your legal document here
              </p>
              <p className="text-sm text-gray-500">or click to browse files</p>
              <p className="text-xs text-gray-400">Supports: PDF, DOCX, TXT (Max 20MB)</p>
            </>
          )}
        </div>
      </div>

      {file && (
        <div className="mt-4 p-4 bg-white rounded-lg border border-gray-200 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <FileText className="w-5 h-5 text-secondary-500" />
            <span className="font-medium text-gray-700">{file.name}</span>
            <span className="text-sm text-gray-500">{(file.size / (1024 * 1024)).toFixed(2)} MB</span>
          </div>
          <button
            onClick={removeFile}
            className="p-1 rounded-full hover:bg-gray-100 text-gray-500 hover:text-gray-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {error && (
        <div className="mt-2 text-sm text-red-600 flex items-center justify-center space-x-1">
          <X className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={!file || isLoading}
        className={`mt-6 w-full py-3 px-4 rounded-lg font-medium text-white flex items-center justify-center ${
          !file || isLoading
            ? 'bg-gray-300 cursor-not-allowed'
            : 'bg-primary-500 hover:bg-primary-600'
        }`}
      >
        {isLoading ? (
          <>
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            Processing...
          </>
        ) : (
          'Summarize Document'
        )}
      </button>
    </div>
  )
}

export default FileUpload