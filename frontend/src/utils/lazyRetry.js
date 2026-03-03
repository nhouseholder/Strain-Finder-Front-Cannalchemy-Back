/**
 * Wrapper around React.lazy() that retries failed dynamic imports once
 * by forcing a full page reload. This handles stale chunk hashes after
 * a new deployment (e.g. "QuizPage-DRRX_hQc.js" no longer exists).
 *
 * Uses sessionStorage to prevent infinite reload loops.
 */
export default function lazyRetry(importFn, chunkName) {
  return new Promise((resolve, reject) => {
    const key = `chunk-retry-${chunkName}`
    const hasRetried = sessionStorage.getItem(key) === '1'

    importFn()
      .then((mod) => {
        // Successful load — clear any retry flag
        sessionStorage.removeItem(key)
        resolve(mod)
      })
      .catch((err) => {
        if (!hasRetried) {
          // First failure — flag it and hard-reload to get fresh HTML with new chunk hashes
          sessionStorage.setItem(key, '1')
          window.location.reload()
        } else {
          // Already retried once — let the error propagate to ErrorBoundary
          sessionStorage.removeItem(key)
          reject(err)
        }
      })
  })
}
