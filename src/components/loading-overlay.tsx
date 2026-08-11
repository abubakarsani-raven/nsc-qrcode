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
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/25 backdrop-blur-md">
      <div className="mx-4 w-full max-w-sm rounded-2xl border border-[var(--nsc-separator)] bg-white/95 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.18)] sm:mx-0">
        <div className="mb-4 flex justify-center">
          <div className="relative h-12 w-12">
            <div className="absolute inset-0 rounded-full border-[3px] border-[var(--nsc-fill)]" />
            <div className="absolute inset-0 animate-spin rounded-full border-[3px] border-transparent border-t-[var(--nsc-green)]" />
          </div>
        </div>

        <h3 className="mb-2 text-center text-[17px] font-semibold tracking-tight text-[var(--nsc-ink)]">
          {message}
        </h3>

        <div className="mb-4">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--nsc-fill)]">
            <div
              className="h-full rounded-full bg-[var(--nsc-green)] transition-[width] duration-200 ease-out"
              style={{ width: `${displayProgress}%` }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-[12px] text-[var(--nsc-secondary)]">
            <span className="tabular-nums">{displayProgress}%</span>
            <div className="flex gap-3 tabular-nums">
              <span>{formatSeconds(elapsed)} elapsed</span>
              {remaining !== null && !overdue && (
                <span className="font-medium text-[var(--nsc-ink)]">
                  ~{formatSeconds(remaining)} left
                </span>
              )}
            </div>
          </div>
        </div>

        <p className="text-center text-[13px] text-[var(--nsc-secondary)]">
          {progress === 100
            ? "Finalizing…"
            : overdue
              ? "Taking longer than expected — still working…"
              : "Please wait while we process your request"}
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
