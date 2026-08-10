'use client';

import { useLoading } from '@/lib/loading-context';
import { useEffect, useState } from 'react';

export function LoadingOverlay() {
  const { loading } = useLoading();
  const { isLoading, startTime, estimatedTime, progress, message } = loading;

  // A ticking clock is the only thing that makes elapsed/remaining move.
  // Deriving them from startTime alone freezes them, since startTime is set
  // once when the operation begins and never changes while it runs.
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!isLoading || !startTime) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, [isLoading, startTime]);

  if (!isLoading) return null;

  const elapsed = startTime ? Math.max(0, (now - startTime) / 1000) : 0;

  // Callers only report progress at a few coarse milestones, which leaves the
  // bar motionless for long stretches. Between milestones, ease toward the
  // estimate so the bar reflects real elapsed time — but never let the
  // estimate overtake genuine reported progress, and never reach 100% on
  // time alone.
  let displayProgress = progress;
  if (estimatedTime && progress < 100) {
    const timeBased = (1 - Math.exp(-elapsed / (estimatedTime * 0.45))) * 95;
    displayProgress = Math.max(progress, Math.min(95, timeBased));
  }
  displayProgress = Math.round(displayProgress);

  const remaining =
    estimatedTime && progress < 100
      ? Math.max(0, estimatedTime - elapsed)
      : null;

  const overdue = remaining !== null && remaining <= 0;

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
          {message}
        </h3>

        {/* Progress Bar */}
        <div className="mb-4">
          <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-200">
            <div
              className="h-full bg-gradient-to-r from-[#0d4720] to-emerald-500 transition-[width] duration-200 ease-out"
              style={{ width: `${displayProgress}%` }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-neutral-700">
            <span className="font-mono tabular-nums">{displayProgress}%</span>
            <div className="flex gap-4 tabular-nums">
              <span>{formatSeconds(elapsed)} elapsed</span>
              {remaining !== null && !overdue && (
                <span className="font-medium text-emerald-700">
                  ~{formatSeconds(remaining)} left
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Status Text */}
        <p className="text-center text-sm text-neutral-700">
          {progress === 100
            ? 'Finalizing…'
            : overdue
              ? 'Taking longer than expected — still working…'
              : 'Please wait while we process your request'}
        </p>
      </div>
    </div>
  );
}

function formatSeconds(seconds: number) {
  if (seconds < 60) return `${Math.floor(seconds)}s`;
  const mins = Math.floor(seconds / 60);
  const rest = Math.floor(seconds % 60);
  return `${mins}m ${rest.toString().padStart(2, '0')}s`;
}
