import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import FileUpload from '../components/FileUpload';
import SummaryHistory from '../components/SummaryHistory';
import { documentApi } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import {
  Search, Globe2, Settings, User, Menu, ArrowRight, Share2,
  ThumbsUp, ThumbsDown, Upload, FileText, Command, Home as HomeIcon,
  Compass, Library, Plus, Mic, Volume2, VolumeX,
  FolderOpen, BookOpen, History, Scale, Landmark,
  FileCheck, Filter, LogOut
} from 'lucide-react';

const Home = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [summary, setSummary] = useState('');
  const [processingStatus, setProcessingStatus] = useState('');
  const [documentId, setDocumentId] = useState(null);
  const [selectedLanguage, setSelectedLanguage] = useState('english');
  const [isPlaying, setIsPlaying] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const { user, isAuthenticated, isAuthLoading, logout } = useAuth();
  const speechSynthesisRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAuthLoading && !isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, isAuthLoading, navigate]);

  const handleFileUpload = async (file) => {
    setIsLoading(true);
    setProcessingStatus('Preparing to upload document...');
    setSummary('');

    try {
      const formData = new FormData();
      formData.append('document', file);

      // Show file size in a readable format
      const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
      setProcessingStatus(`Uploading document (${fileSizeMB} MB)...`);

      const uploadResponse = await documentApi.uploadDocument(formData);
      console.log('Upload response details:', {
        fullResponse: uploadResponse,
        success: uploadResponse.success,
        documentId: uploadResponse.documentId,
        message: uploadResponse.message,
        status: uploadResponse.status,
        document: uploadResponse.document
      });

      if (!uploadResponse.success) {
        throw new Error(uploadResponse.error || 'Failed to upload document');
      }

      const documentId = uploadResponse.documentId;
      if (!documentId) {
        throw new Error('No document ID received from server');
      }

      setDocumentId(documentId);
      setProcessingStatus('Document uploaded successfully. Processing content...');

      // If the document is already processed (new format)
      if (uploadResponse.document?.summary) {
        setSummary(uploadResponse.document.summary);
        setProcessingStatus('Analysis complete');
      } else {
        // Fall back to polling if needed
        setProcessingStatus('Processing document...');
        const result = await pollForSummary(documentId);
        console.log('Poll result details:', {
          fullResult: result,
          success: result.success,
          status: result.status,
          document: result.document,
          error: result.error
        });

        if (!result.success) {
          throw new Error(result.error || 'Failed to get document summary');
        }

        setSummary(result.document?.summary || result.summary);
        setProcessingStatus('Analysis complete');
      }
    } catch (error) {
      console.error('Error details:', {
        error,
        message: error.message,
        type: typeof error,
        isObject: error instanceof Object,
        keys: error instanceof Object ? Object.keys(error) : null
      });
      const errorMessage = error.message || (typeof error === 'string' ? error : 'An unknown error occurred');
      setProcessingStatus(`Error: ${errorMessage}`);
      setSummary('');
      setDocumentId(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTranslate = async () => {
    if (!summary) return;
    setIsLoading(true);
    try {
      const response = await fetch('http://localhost:3000/api/translate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          text: typeof summary === 'string' ? summary : JSON.stringify(summary),
          targetLanguage: selectedLanguage
        }),
      });
      const data = await response.json();
      setSummary(data.translatedText);
    } catch (error) {
      console.error('Translation error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSpeak = () => {
    if (!summary) return;

    if (isPlaying) {
      window.speechSynthesis.cancel();
      setIsPlaying(false);
      return;
    }

    const text = typeof summary === 'string' ? summary : JSON.stringify(summary);
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = selectedLanguage === 'hindi' ? 'hi-IN' : 'en-US';
    utterance.onend = () => setIsPlaying(false);

    window.speechSynthesis.speak(utterance);
    speechSynthesisRef.current = utterance;
    setIsPlaying(true);
  };

  const highlightSearchResults = (text) => {
    if (!searchQuery) return text;
    const regex = new RegExp(`(${searchQuery})`, 'gi');
    return text.replace(regex, '<mark class="bg-violet-500/30 text-white">$1</mark>');
  };

  const pollForSummary = async (documentId) => {
    if (!documentId) {
      throw new Error('Document ID is required for polling');
    }

    const maxAttempts = 30; // 5 minutes maximum polling time
    const interval = 10000; // 10 seconds between attempts
    let attempts = 0;

    const poll = async () => {
      try {
        console.log(`Polling attempt ${attempts + 1} for document ${documentId}`);
        const statusResponse = await documentApi.getDocumentStatus(documentId);
        console.log('Status response details:', {
          fullResponse: statusResponse,
          success: statusResponse.success,
          status: statusResponse.status,
          error: statusResponse.error
        });

        if (!statusResponse.success) {
          console.error('Status check failed:', statusResponse);
          throw new Error(statusResponse.error || 'Failed to get document status');
        }

        if (!statusResponse.status) {
          console.error('Invalid status response:', statusResponse);
          throw new Error('Invalid status response from server');
        }

        if (statusResponse.status === 'failed') {
          throw new Error(statusResponse.error || 'Document processing failed');
        }

        if (statusResponse.status === 'completed') {
          const docResponse = await documentApi.getDocument(documentId);
          console.log('Document response details:', {
            fullResponse: docResponse,
            success: docResponse.success,
            document: docResponse.document,
            error: docResponse.error
          });

          if (!docResponse.success) {
            throw new Error(docResponse.error || 'Failed to get document summary');
          }

          if (!docResponse.document?.summary) {
            throw new Error('Document summary not found in response');
          }

          return docResponse;
        }

        // Still processing
        if (attempts >= maxAttempts) {
          throw new Error('Processing timeout exceeded');
        }

        attempts++;
        await new Promise(resolve => setTimeout(resolve, interval));
        return poll();
      } catch (error) {
        console.error('Polling error details:', {
          error,
          message: error.message,
          type: typeof error,
          isObject: error instanceof Object,
          keys: error instanceof Object ? Object.keys(error) : null
        });
        throw error;
      }
    };

    return poll();
  };

  const handleSelectSummary = (selectedSummary) => {
    setSummary(selectedSummary.summary);
    setDocumentId(selectedSummary._id);
  };

  return (
    <div className="flex h-screen bg-[#0C0C0C] text-gray-100">
      {/* Sidebar */}
      <div className="w-[270px] border-r border-gray-800 flex flex-col">
        <div className="p-4">
          <div className="flex items-center space-x-3 mb-6">
            <Scale className="w-8 h-8 text-violet-400" />
            <span className="text-lg font-semibold">LegalDoc AI</span>
          </div>

          {/* New Analysis Button */}
          <button className="w-full flex items-center space-x-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 rounded-lg text-sm mb-4">
            <Upload size={16} />
            <span>New Analysis</span>
            <div className="ml-auto flex items-center space-x-1 text-xs">
              <Command size={14} />
              <span>N</span>
            </div>
          </button>

          {/* Navigation */}
          <nav className="space-y-1">
            {/* Recent Documents Section */}
            <div className="mb-4">
              <div className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Documents
              </div>
              <button className="w-full flex items-center space-x-3 px-3 py-2 text-gray-300 hover:text-white rounded-lg hover:bg-gray-800">
                <FolderOpen size={20} />
                <span>Recent Documents</span>
              </button>
              <button className="w-full flex items-center space-x-3 px-3 py-2 text-gray-300 hover:text-white rounded-lg hover:bg-gray-800">
                <History size={20} />
                <span>Analysis History</span>
              </button>
            </div>

            {/* Document Types Section */}
            <div className="mb-4">
              <div className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Document Types
              </div>
              <button className="w-full flex items-center space-x-3 px-3 py-2 text-gray-300 hover:text-white rounded-lg hover:bg-gray-800">
                <Landmark size={20} />
                <span>Contracts</span>
              </button>
              <button className="w-full flex items-center space-x-3 px-3 py-2 text-gray-300 hover:text-white rounded-lg hover:bg-gray-800">
                <FileCheck size={20} />
                <span>Agreements</span>
              </button>
              <button className="w-full flex items-center space-x-3 px-3 py-2 text-gray-300 hover:text-white rounded-lg hover:bg-gray-800">
                <BookOpen size={20} />
                <span>Legal Reports</span>
              </button>
            </div>

            {/* Tools Section */}
            <div className="mb-4">
              <div className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Tools
              </div>
              <button className="w-full flex items-center space-x-3 px-3 py-2 text-gray-300 hover:text-white rounded-lg hover:bg-gray-800">
                <Filter size={20} />
                <span>Advanced Filters</span>
              </button>
              <button className="w-full flex items-center space-x-3 px-3 py-2 text-gray-300 hover:text-white rounded-lg hover:bg-gray-800">
                <FileText size={20} />
                <span>Batch Analysis</span>
              </button>
            </div>
          </nav>
        </div>

        <div className="flex-1 overflow-y-auto px-4">
          <div className="mb-4">
            <div className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Recent Analyses
            </div>
            <SummaryHistory onSelectSummary={handleSelectSummary} />
          </div>
        </div>

        <div className="p-4 border-t border-gray-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center">
                <User size={18} className="text-gray-300" />
              </div>
              <div>
                <p className="text-sm font-medium">{user?.name || 'Guest User'}</p>
                <p className="text-xs text-gray-400">{user?.email}</p>
              </div>
            </div>
            <div className="flex items-center space-x-0">
              <button className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800">
                <Settings size={20} />
              </button>
              <button
                onClick={logout}
                className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800"
                title="Logout"
              >
                <LogOut size={20} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-4 py-8">
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center mb-8">
              <h1 className="text-4xl font-semibold mb-6 text-white">
                What document would you like to analyze?
              </h1>

              {/* Upload Section */}
              <div className="w-full max-w-2xl relative mb-8">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-violet-600/20 to-indigo-600/20 rounded-xl blur"></div>
                  <div className="relative bg-gray-900 rounded-xl border border-gray-800 p-4">
                    <FileUpload onFileUpload={handleFileUpload} isLoading={isLoading} />
                  </div>
                </div>
              </div>

              {/* Pro Badge */}
              <div className="flex items-center space-x-2 px-3 py-1 bg-gray-800 rounded-full text-xs font-medium text-gray-300">
                <span className="w-2 h-2 bg-teal-400 rounded-full"></span>
                <span>Deep Summary</span>
              </div>
            </div>

            {/* Processing Status */}
            {processingStatus && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-6">
                <div className="flex items-center space-x-3">
                  {isLoading ? (
                    <div className="w-5 h-5 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <div className="w-5 h-5 bg-violet-500 rounded-full" />
                  )}
                  <p className="text-gray-300">{processingStatus}</p>
                </div>
              </div>
            )}

            {/* Summary Section */}
            {summary && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                <div className="p-6 border-b border-gray-800">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold">Document Analysis</h2>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={handleSpeak}
                        className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
                      >
                        {isPlaying ? (
                          <Volume2 size={20} className="text-gray-400" />
                        ) : (
                          <VolumeX size={20} className="text-gray-400" />
                        )}
                      </button>
                      <button className="p-2 hover:bg-gray-800 rounded-lg transition-colors">
                        <Share2 size={20} className="text-gray-400" />
                      </button>
                    </div>
                  </div>

                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search in summary..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-gray-800 text-gray-100 pl-10 pr-4 py-2 rounded-lg border border-gray-700 focus:outline-none focus:border-gray-600 focus:ring-1 focus:ring-gray-600"
                    />
                    <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                    <button className="absolute right-3 top-1/2 transform -translate-y-1/2">
                      <Mic size={20} className="text-gray-400" />
                    </button>
                  </div>
                </div>

                <div className="p-6">
                  <div className="space-y-6">
                    {typeof summary === 'string' ? (
                      <div className="prose prose-invert max-w-none">
                        {summary.split('\n').map((para, i) => (
                          <p
                            key={i}
                            className="text-gray-300 leading-relaxed"
                            dangerouslySetInnerHTML={{
                              __html: highlightSearchResults(para)
                            }}
                          />
                        ))}
                      </div>
                    ) : (
                      <>
                        {/* Key Points */}
                        {summary.key_points?.length > 0 && (
                          <div>
                            <h3 className="text-lg font-medium text-gray-100 mb-4">Key Points</h3>
                            <ul className="space-y-3">
                              {summary.key_points.map((point, index) => (
                                <li key={index} className="flex items-start">
                                  <ArrowRight className="w-5 h-5 text-violet-400 mt-0.5 mr-3 flex-shrink-0" />
                                  <span
                                    className="text-gray-300"
                                    dangerouslySetInnerHTML={{
                                      __html: highlightSearchResults(point)
                                    }}
                                  />
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Tables */}
                        {summary.tables?.length > 0 && (
                          <div>
                            <h3 className="text-lg font-medium text-gray-100 mb-4">Important Data</h3>
                            <div className="space-y-4">
                              {summary.tables.map((table, index) => (
                                <div key={index} className="overflow-x-auto">
                                  <table className="min-w-full divide-y divide-gray-800">
                                    <tbody className="divide-y divide-gray-800">
                                      {Array.isArray(table.data) ? (
                                        // Handle array of objects format
                                        table.data.map((row, rowIndex) => (
                                          <tr key={rowIndex}>
                                            {Object.entries(row).map(([key, value], cellIndex) => (
                                              <td
                                                key={`${rowIndex}-${cellIndex}`}
                                                className={`py-3 px-4 ${cellIndex === 0 ? 'text-gray-400' : 'text-gray-300'}`}
                                                dangerouslySetInnerHTML={{
                                                  __html: highlightSearchResults(String(value))
                                                }}
                                              />
                                            ))}
                                          </tr>
                                        ))
                                      ) : (
                                        // Handle key-value object format
                                        Object.entries(table.data || table).map(([key, value], rowIndex) => (
                                          <tr key={rowIndex}>
                                            <td className="py-3 px-4 text-gray-400">{key}</td>
                                            <td
                                              className="py-3 px-4 text-gray-300"
                                              dangerouslySetInnerHTML={{
                                                __html: highlightSearchResults(
                                                  typeof value === 'object' ?
                                                    JSON.stringify(value) :
                                                    String(value)
                                                )
                                              }}
                                            />
                                          </tr>
                                        ))
                                      )}
                                    </tbody>
                                  </table>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Highlights */}
                        {summary.highlights?.length > 0 && (
                          <div>
                            <h3 className="text-lg font-medium text-gray-100 mb-4">Important Clauses</h3>
                            <div className="space-y-4">
                              {summary.highlights.map((highlight, index) => (
                                <div key={index} className="p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                                  <p
                                    className="text-gray-300"
                                    dangerouslySetInnerHTML={{
                                      __html: highlightSearchResults(highlight)
                                    }}
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="mt-8 flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <button className="inline-flex items-center px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors">
                        <ThumbsUp size={20} className="mr-2 text-gray-400" />
                        <span className="text-gray-300">Helpful</span>
                      </button>
                      <button className="inline-flex items-center px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors">
                        <ThumbsDown size={20} className="mr-2 text-gray-400" />
                        <span className="text-gray-300">Not Helpful</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
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