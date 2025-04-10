import axios from 'axios';

// Get the base URL from environment variables or use default
const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const api = axios.create({
    baseURL: BASE_URL,
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    },
    withCredentials: true,
    timeout: 30000, // Default 30 second timeout
});

// Error transformer
const transformError = (error) => {
    if (error.response?.data?.error) {
        return new Error(error.response.data.error);
    }
    if (error.message === 'Network Error') {
        return new Error('Unable to connect to server. Please check your internet connection.');
    }
    if (error.code === 'ECONNABORTED') {
        return new Error('The request took too long to complete. Please try again.');
    }
    return error;
};

// Add request interceptor
api.interceptors.request.use(
    (config) => {
        // Adjust timeout for file uploads
        if (config.url === '/upload') {
            config.timeout = 300000; // 5 minutes for upload and processing
        }

        // Log requests in development
        if (import.meta.env.DEV) {
            console.log(`[API] ${config.method.toUpperCase()} ${config.url}`);
        }
        return config;
    },
    (error) => {
        console.error('[API] Request error:', error);
        return Promise.reject(transformError(error));
    }
);

// Add response interceptor
api.interceptors.response.use(
    (response) => {
        // Log responses in development
        if (import.meta.env.DEV) {
            console.log(`[API] Response from ${response.config.url}:`, response.data);
        }
        return response;
    },
    (error) => {
        // Handle different types of errors
        if (!error.response) {
            // Network error or server not responding
            console.error('[API] Network error:', error);
            return Promise.reject(transformError(error));
        }

        // Handle specific status codes
        switch (error.response.status) {
            case 401:
                // Clear any stored auth state and redirect to login
                if (error.config.url !== '/auth/me') {
                    window.location.href = '/login';
                }
                break;
            case 403:
                console.error('[API] Forbidden access:', error.response.data);
                break;
            case 404:
                console.error('[API] Resource not found:', error.config.url);
                break;
            case 500:
                console.error('[API] Server error:', error.response.data);
                break;
            default:
                console.error('[API] Request failed:', error);
        }

        return Promise.reject(transformError(error));
    }
);

// Auth API calls
export const authApi = {
    signup: async (userData) => {
        try {
            const response = await api.post('/auth/signup', userData);
            return response.data;
        } catch (error) {
            throw transformError(error);
        }
    },

    login: async (credentials) => {
        try {
            const response = await api.post('/auth/login', credentials);
            return response.data;
        } catch (error) {
            throw transformError(error);
        }
    },

    logout: async () => {
        try {
            const response = await api.post('/auth/logout');
            return response.data;
        } catch (error) {
            // Always clear local auth state on logout, even if the request fails
            console.warn('[API] Logout request failed, but proceeding with local logout');
            return { success: true };
        }
    },

    getCurrentUser: async () => {
        try {
            const response = await api.get('/auth/me');
            return response.data;
        } catch (error) {
            if (error.response?.status === 401) {
                return null;
            }
            throw transformError(error);
        }
    },
};

// Document API calls
export const documentApi = {
    uploadDocument: async (formData, onProgress) => {
        try {
            const response = await api.post('/upload', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
                onUploadProgress: (progressEvent) => {
                    if (onProgress && progressEvent.total) {
                        const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                        onProgress(percentCompleted);
                    }
                }
            });
            return response.data;
        } catch (error) {
            throw transformError(error);
        }
    },

    getDocumentStatus: async (id) => {
        try {
            const response = await api.get(`/document/${id}/status`);
            return response.data;
        } catch (error) {
            if (error.response?.status === 404) {
                return { success: false, error: 'Document not found' };
            }
            throw transformError(error);
        }
    },

    getSummaries: async () => {
        try {
            const response = await api.get('/documents');
            return response.data;
        } catch (error) {
            throw transformError(error);
        }
    },

    getDocument: async (id) => {
        try {
            const response = await api.get(`/document/${id}`);
            return response.data;
        } catch (error) {
            if (error.response?.status === 404) {
                return { success: false, error: 'Document not found' };
            }
            throw transformError(error);
        }
    },
};

export default api; 