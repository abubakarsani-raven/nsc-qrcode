'use client';

import { useLoading } from '@/lib/loading-context';
import { useMemo } from 'react';

export function LoadingOverlay() {
  const { loading } = useLoading();

  const timeRemaining = useMemo(() => {
    if (!loading.startTime || !loading.estimatedTime || !loading.isLoading) return null;

    const elapsed = (Date.now() - loading.startTime) / 1000;
    const remaining = Math.max(0, loading.estimatedTime - elapsed);

    if (remaining < 1) return null;
    if (remaining < 60) return `~${Math.ceil(remaining)}s`;
    return `~${Math.ceil(remaining / 60)}m`;
  }, [loading.startTime, loading.estimatedTime, loading.isLoading]);

  const elapsedSeconds = useMemo(() => {
    if (!loading.startTime || !loading.isLoading) return 0;
    return Math.round((Date.now() - loading.startTime) / 1000);
  }, [loading.startTime, loading.isLoading]);

  if (!loading.isLoading) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-2xl mx-4 sm:mx-0">
        {/* Spinner */}
        <div className="flex justify-center mb-4">
          <div className="relative h-16 w-16">
            <div className="absolute inset-0 rounded-full border-4 border-neutral-200" />
            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-[#0d4720] animate-spin" />
          </div>
        </div>

        {/* Message */}
        <h3 className="text-center text-lg font-semibold text-neutral-900 mb-2">
          {loading.message}
        </h3>

        {/* Progress Bar */}
        <div className="mb-4">
          <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-200">
            <div
              className="h-full bg-gradient-to-r from-[#0d4720] to-emerald-500 transition-all duration-300"
              style={{ width: `${loading.progress}%` }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-neutral-600">
            <span className="font-mono">{loading.progress}%</span>
            <div className="flex gap-4">
              {elapsedSeconds > 0 && (
                <span>⏱️ {elapsedSeconds}s</span>
              )}
              {timeRemaining && (
                <span className="text-emerald-600 font-medium">{timeRemaining}</span>
              )}
            </div>
          </div>
        </div>

        {/* Status Text */}
        <p className="text-center text-sm text-neutral-500">
          {loading.progress === 100
            ? 'Finalizing...'
            : 'Please wait while we process your request'}
        </p>
      </div>
    </div>
  );
}
