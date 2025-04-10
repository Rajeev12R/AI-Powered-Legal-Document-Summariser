import { useState, useEffect } from 'react';
import { FileText, Clock, ChevronRight } from 'lucide-react';

const SummaryHistory = ({ onSelectSummary }) => {
    const [summaries, setSummaries] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchSummaries();
    }, []);

    const fetchSummaries = async () => {
        try {
            const response = await fetch('http://localhost:3000/api/summaries', {
                credentials: 'include',
            });

            if (!response.ok) {
                throw new Error('Failed to fetch summaries');
            }

            const data = await response.json();
            setSummaries(data.summaries);
        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const formatDate = (date) => {
        return new Date(date).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="animate-pulse space-y-4 w-full">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="h-20 bg-gray-100 rounded-lg w-full" />
                    ))}
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-center text-gray-500 py-8">
                Failed to load summaries. Please try again.
            </div>
        );
    }

    if (summaries.length === 0) {
        return (
            <div className="text-center text-gray-500 py-8">
                No summaries yet. Upload a document to get started.
            </div>
        );
    }

    return (
        <div className="space-y-2">
            {summaries.map((summary) => (
                <button
                    key={summary._id}
                    onClick={() => onSelectSummary(summary)}
                    className="w-full p-4 bg-white hover:bg-gray-50 rounded-lg border border-gray-200 transition-colors text-left group"
                >
                    <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-3">
                            <div className="p-2 bg-violet-50 rounded-lg">
                                <FileText className="w-5 h-5 text-violet-600" />
                            </div>
                            <div>
                                <h3 className="font-medium text-gray-900 line-clamp-1 group-hover:text-violet-600 transition-colors">
                                    {summary.title || 'Untitled Document'}
                                </h3>
                                <div className="flex items-center space-x-2 mt-1 text-sm text-gray-500">
                                    <Clock className="w-4 h-4" />
                                    <span>{formatDate(summary.createdAt)}</span>
                                </div>
                            </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-violet-600 transition-colors" />
                    </div>
                </button>
            ))}
        </div>
    );
};

export default SummaryHistory; 