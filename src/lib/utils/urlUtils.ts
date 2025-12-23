/**
 * URL and browser utilities
 */

/**
 * Clean URL search parameters and update browser history
 * @param params Array of parameter names to remove
 */
export function cleanUrlParams(params: string[]): void {
  if (typeof window === 'undefined') return;

  const url = new URL(window.location.href);
  params.forEach(param => url.searchParams.delete(param));
  window.history.replaceState({}, document.title, url.toString());
}
