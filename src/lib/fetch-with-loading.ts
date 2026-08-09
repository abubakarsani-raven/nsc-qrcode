/**
 * Fetch wrapper that automatically manages loading state
 * Usage: Use this instead of fetch() for automatic loading indicators
 */

import type { LoadingContextType } from './loading-context';

let loadingContext: LoadingContextType | null = null;

export function setLoadingContext(context: LoadingContextType) {
  loadingContext = context;
}

type FetchOptions = RequestInit & {
  loadingMessage?: string;
  estimatedSeconds?: number;
  showProgress?: boolean;
};

export async function fetchWithLoading(
  url: string,
  options: FetchOptions = {}
) {
  const {
    loadingMessage = 'Processing...',
    estimatedSeconds = 10,
    showProgress = true,
    ...fetchOptions
  } = options;

  if (!loadingContext) {
    // Fallback if context not set
    return fetch(url, fetchOptions);
  }

  try {
    loadingContext.startLoading(loadingMessage, estimatedSeconds);

    // Simulate progress for indeterminate operations
    let progressInterval: NodeJS.Timeout | null = null;
    if (showProgress) {
      let progress = 0;
      progressInterval = setInterval(() => {
        progress = Math.min(progress + Math.random() * 15, 90);
        loadingContext?.setProgress(Math.round(progress));
      }, 200);
    }

    const response = await fetch(url, fetchOptions);

    if (progressInterval) clearInterval(progressInterval);

    // Show 100% for a moment before hiding
    loadingContext.setProgress(100);

    // Allow UI to show completion state briefly
    await new Promise(resolve => setTimeout(resolve, 300));
    loadingContext.stopLoading();

    return response;
  } catch (error) {
    loadingContext.stopLoading();
    throw error;
  }
}
