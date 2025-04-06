import { useState } from 'react';
import FileUpload from '../components/FileUpload';
import { Gavel, Scale, Landmark, Loader2, XCircle, BookOpen, FileText, FileDigit } from 'lucide-react';

const Home = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [summary, setSummary] = useState('');
  const [processingStatus, setProcessingStatus] = useState('');
  const [documentId, setDocumentId] = useState(null);

  const handleFileUpload = async (file) => {
    setIsLoading(true);
    setProcessingStatus('Uploading document...');
    setSummary('');

    try {
      const formData = new FormData();
      formData.append('document', file);

      const uploadResponse = await fetch('http://localhost:3000/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!uploadResponse.ok) {
        throw new Error(`Upload failed with status ${uploadResponse.status}`);
      }

      const uploadData = await uploadResponse.json();
      setDocumentId(uploadData.documentId);
      setProcessingStatus('Analyzing document content...');

      const result = await pollForSummary(uploadData.documentId);
      setSummary(result.summary);
      setProcessingStatus('Analysis complete');

    } catch (error) {
      console.error('Error:', error);
      setProcessingStatus(`Error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const pollForSummary = async (documentId, interval = 2000, timeout = 120000) => {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      try {
        const response = await fetch(`http://localhost:3000/api/document/${documentId}`);

        if (!response.ok) {
          throw new Error(`Failed to fetch status: ${response.status}`);
        }

        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error || 'Server returned unsuccessful response');
        }

        if (data.document.status === 'completed') {
          return {
            summary: data.document.summary,
            status: 'completed'
          };
        } else if (data.document.status === 'failed') {
          throw new Error(data.document.error || 'Document processing failed');
        }

        await new Promise(resolve => setTimeout(resolve, interval));
      } catch (error) {
        console.error('Polling error:', error);
        throw error;
      }
    }

    throw new Error('Processing timeout exceeded');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 flex flex-col">
      <header className="bg-white shadow-sm py-4 border-b border-gray-200">
        <div className="container mx-auto px-4 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <BookOpen className="w-6 h-6 text-blue-600" />
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">
              LegalEase Summarizer
            </h1>
          </div>
          <div className="hidden md:flex items-center space-x-1 text-sm text-gray-500">
            <FileText className="w-4 h-4" />
            <span>Supports: PDF, DOCX, Images</span>
          </div>
        </div>
      </header>

      <main className="flex-grow container mx-auto px-4 py-8 md:py-12">
        <div className="text-center mb-12">
          <div className="inline-block bg-blue-100 rounded-full p-3 mb-4">
            <FileDigit className="w-8 h-8 text-blue-600" />
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-800 mb-3">
            AI-Powered Legal Document Analysis
          </h2>
          <p className="text-lg md:text-xl text-gray-600 max-w-2xl mx-auto">
            Transform complex legal documents into clear, actionable summaries with our advanced AI technology.
          </p>
        </div>

        <div className="max-w-4xl mx-auto h-auto p-10 bg-white rounded-xl shadow-md overflow-hidden border border-gray-200">
          <FileUpload onFileUpload={handleFileUpload} isLoading={isLoading} />
        </div>

        {/* Results Section */}
        <div className="mt-12 max-w-4xl mx-auto">
          {processingStatus && (
            <div className={`p-4 rounded-lg mb-6 transition-all duration-300 ${processingStatus.startsWith('Error:')
              ? 'bg-red-50 border border-red-200'
              : 'bg-blue-50 border border-blue-200'
              }`}>
              <div className="flex items-start">
                {isLoading ? (
                  <Loader2 className="w-5 h-5 mr-3 mt-0.5 text-blue-600 animate-spin" />
                ) : processingStatus.startsWith('Error:') ? (
                  <XCircle className="w-5 h-5 mr-3 mt-0.5 text-red-600" />
                ) : (
                  <div className="w-5 h-5 mr-3 mt-0.5 flex items-center justify-center">
                    <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></div>
                  </div>
                )}
                <div>
                  <p className={`font-medium ${processingStatus.startsWith('Error:') ? 'text-red-600' : 'text-blue-600'
                    }`}>
                    {processingStatus}
                  </p>
                  {processingStatus.includes('OCR') && (
                    <p className="text-sm mt-1 text-red-500">
                      For image-based documents, ensure proper text visibility for accurate analysis.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {summary && (
            <div className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-200 transition-all duration-500 animate-fadeIn">
              <div className="bg-gradient-to-r from-blue-600 to-blue-800 px-6 py-4">
                <h3 className="text-xl font-semibold text-white flex items-center">
                  <FileText className="w-5 h-5 mr-2" />
                  Document Summary
                </h3>
              </div>
              <div className="p-6">
                {/* Handle both string and structured summaries */}
                {typeof summary === 'string' ? (
                  <div className="prose max-w-none">
                    {summary.split('\n').map((para, i) => (
                      <p key={i} className="mb-4 text-gray-700 leading-relaxed">
                        {para}
                      </p>
                    ))}
                  </div>
                ) : (
                  <>
                    {/* Key Points Section */}
                    {summary.key_points && summary.key_points.length > 0 && (
                      <div className="mb-8">
                        <h4 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                          <span className="w-2 h-2 bg-blue-600 rounded-full mr-2"></span>
                          Key Points
                        </h4>
                        <ul className="space-y-3">
                          {summary.key_points.map((point, index) => (
                            <li key={index} className="flex items-start">
                              <span className="text-blue-600 mr-2">•</span>
                              <span className="text-gray-700">{point}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Tables Section */}
                    {summary.tables && summary.tables.length > 0 && (
                      <div className="mb-8">
                        <h4 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                          <span className="w-2 h-2 bg-blue-600 rounded-full mr-2"></span>
                          Structured Information
                        </h4>
                        <div className="space-y-6">
                          {summary.tables.map((table, index) => (
                            <div key={index} className="overflow-x-auto">
                              <h5 className="text-md font-medium text-gray-700 mb-2">{table.title}</h5>
                              <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                  <tr>
                                    {Object.keys(table.data[0]).map((header) => (
                                      <th key={header} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        {header}
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                  {table.data.map((row, rowIndex) => (
                                    <tr key={rowIndex}>
                                      {Object.values(row).map((value, colIndex) => (
                                        <td key={colIndex} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                          {value}
                                        </td>
                                      ))}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Highlights Section */}
                    {summary.highlights && summary.highlights.length > 0 && (
                      <div className="mb-8">
                        <h4 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                          <span className="w-2 h-2 bg-blue-600 rounded-full mr-2"></span>
                          Important Clauses
                        </h4>
                        <div className="space-y-3">
                          {summary.highlights.map((highlight, index) => (
                            <div key={index} className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
                              <p className="text-gray-700">{highlight}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}

                <div className="mt-6 pt-4 border-t border-gray-100 flex justify-end">
                  <button
                    onClick={() => navigator.clipboard.writeText(
                      typeof summary === 'string' ? summary : JSON.stringify(summary, null, 2)
                    )}
                    className="px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-md text-sm font-medium transition-colors"
                  >
                    Copy Summary
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Features Section */}
        <div className="mt-16">
          <h3 className="text-2xl font-bold text-center text-gray-800 mb-8">
            Powerful Legal Document Analysis
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <FeatureCard
              icon={<Gavel className="w-6 h-6 text-blue-600" />}
              title="Contract Analysis"
              description="Identify key clauses, obligations, and potential risks in contracts with precision."
              gradient="from-blue-50 to-blue-100"
            />
            <FeatureCard
              icon={<Scale className="w-6 h-6 text-blue-600" />}
              title="Case Law Summaries"
              description="Extract core arguments and rulings from lengthy legal decisions instantly."
              gradient="from-purple-50 to-purple-100"
            />
            <FeatureCard
              icon={<Landmark className="w-6 h-6 text-blue-600" />}
              title="Regulation Breakdown"
              description="Understand complex regulations with clear, structured summaries."
              gradient="from-indigo-50 to-indigo-100"
            />
          </div>
        </div>
      </main>

      <footer className="bg-white border-t border-gray-200 py-8">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center space-x-2 mb-4 md:mb-0">
              <BookOpen className="w-5 h-5 text-blue-600" />
              <span className="text-lg font-medium text-gray-800">LegalEase</span>
            </div>
            <div className="text-sm text-gray-500 text-center md:text-right">
              <p>AI-powered legal document analysis platform</p>
              <p className="mt-1">© {new Date().getFullYear()} LegalEase Summarizer. All rights reserved.</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

const FeatureCard = ({ icon, title, description, gradient = 'from-blue-50 to-blue-100' }) => (
  <div className={`bg-gradient-to-br ${gradient} p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-all duration-300 h-full`}>
    <div className="flex items-center mb-4">
      <div className="bg-white p-2 rounded-lg shadow-xs mr-4">
        {icon}
      </div>
      <h3 className="text-xl font-semibold text-gray-800">{title}</h3>
    </div>
    <p className="text-gray-600">{description}</p>
  </div>
);

export default Home;