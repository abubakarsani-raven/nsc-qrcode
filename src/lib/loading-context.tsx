'use client';

import React, { createContext, useState, useCallback, useContext, ReactNode } from 'react';

export type LoadingState = {
  isLoading: boolean;
  message: string;
  progress: number; // 0-100
  startTime: number | null;
  estimatedTime: number | null; // seconds
};

export type LoadingContextType = {
  loading: LoadingState;
  startLoading: (message: string, estimatedSeconds?: number) => void;
  stopLoading: () => void;
  setProgress: (progress: number) => void;
  setMessage: (message: string) => void;
};

const LoadingContext = createContext<LoadingContextType | undefined>(undefined);

export function LoadingProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState<LoadingState>({
    isLoading: false,
    message: '',
    progress: 0,
    startTime: null,
    estimatedTime: null,
  });

  const startLoading = useCallback((message: string, estimatedSeconds?: number) => {
    setLoading({
      isLoading: true,
      message,
      progress: 0,
      startTime: Date.now(),
      estimatedTime: estimatedSeconds || null,
    });
  }, []);

  const stopLoading = useCallback(() => {
    setLoading(prev => ({
      ...prev,
      isLoading: false,
      progress: 0,
      startTime: null,
    }));
  }, []);

  const setProgress = useCallback((progress: number) => {
    setLoading(prev => ({
      ...prev,
      progress: Math.min(100, Math.max(0, progress)),
    }));
  }, []);

  const setMessage = useCallback((message: string) => {
    setLoading(prev => ({
      ...prev,
      message,
    }));
  }, []);

  return (
    <LoadingContext.Provider
      value={{
        loading,
        startLoading,
        stopLoading,
        setProgress,
        setMessage,
      }}
    >
      {children}
    </LoadingContext.Provider>
  );
}

export function useLoading() {
  const context = useContext(LoadingContext);
  if (!context) {
    throw new Error('useLoading must be used within LoadingProvider');
  }
  return context;
}
