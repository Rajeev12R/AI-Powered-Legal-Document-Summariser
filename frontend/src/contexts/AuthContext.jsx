import { createContext, useContext, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../lib/api';

const AuthContext = createContext({});

// Helper function to transform error response
const transformError = (error) => {
    if (error.response?.data?.error) {
        return new Error(error.response.data.error);
    }
    if (error.message === 'Network Error') {
        return new Error('Unable to connect to server. Please check your internet connection.');
    }
    return error;
};

export const AuthProvider = ({ children }) => {
    const queryClient = useQueryClient();
    const navigate = useNavigate();

    // Get current user query
    const { data: auth, isLoading: isAuthLoading } = useQuery({
        queryKey: ['auth'],
        queryFn: authApi.getCurrentUser,
        retry: false,
        staleTime: 1000 * 60 * 5, // 5 minutes
        onError: (error) => {
            // Don't show errors for auth check - just redirect if needed
            if (error.response?.status === 401) {
                queryClient.setQueryData(['auth'], null);
            }
        }
    });

    // Signup mutation
    const signup = useMutation({
        mutationFn: authApi.signup,
        onSuccess: () => {
            navigate('/login', {
                state: { message: 'Account created successfully! Please log in.' }
            });
        },
        onError: (error) => {
            throw transformError(error);
        }
    });

    // Login mutation
    const login = useMutation({
        mutationFn: authApi.login,
        onSuccess: (data) => {
            queryClient.setQueryData(['auth'], data);
            navigate('/');
        },
        onError: (error) => {
            throw transformError(error);
        }
    });

    // Logout mutation
    const logout = useMutation({
        mutationFn: authApi.logout,
        onSuccess: () => {
            queryClient.setQueryData(['auth'], null);
            navigate('/login');
        },
        onError: (error) => {
            console.error('Logout error:', error);
            // Force logout even if the API call fails
            queryClient.setQueryData(['auth'], null);
            navigate('/login');
        }
    });

    const handleLogout = useCallback(() => {
        logout.mutate();
    }, [logout]);

    const value = {
        user: auth?.user,
        isAuthenticated: !!auth?.user,
        isAuthLoading,
        signup: signup.mutate,
        login: login.mutate,
        logout: handleLogout,
        authError: signup.error || login.error || logout.error,
        isAuthenticating: signup.isPending || login.isPending || logout.isPending,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}; 