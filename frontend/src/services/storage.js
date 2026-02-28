export function loadFromStorage(key, fallback = null) {
  try {
    const item = localStorage.getItem(key)
    return item ? JSON.parse(item) : fallback
  } catch {
    return fallback
  }
}

export function saveToStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (e) {
    console.warn(`Failed to save to localStorage "${key}":`, e)
  }
}

export function removeFromStorage(key) {
  try {
    localStorage.removeItem(key)
  } catch {}
}

export function clearAllAppStorage() {
  const keys = ['sf-theme', 'sf-quiz', 'sf-results', 'sf-user-favorites', 'sf-user-journal', 'sf-user-recent', 'sf-user-dismissed']
  keys.forEach(k => localStorage.removeItem(k))
}

/** Migrate legacy ca-* keys to sf-* (Cannalchemy → MyStrainAI rebrand) */
export function migrateStorageKeys() {
  const map = [
    ['ca-theme', 'sf-theme'],
    ['ca-quiz', 'sf-quiz'],
    ['ca-results', 'sf-results'],
    ['ca-user-favorites', 'sf-user-favorites'],
    ['ca-user-journal', 'sf-user-journal'],
    ['ca-user-recent', 'sf-user-recent'],
    ['ca-user-dismissed', 'sf-user-dismissed'],
  ]
  map.forEach(([old, nw]) => {
    const val = localStorage.getItem(old)
    if (val !== null && localStorage.getItem(nw) === null) {
      localStorage.setItem(nw, val)
      localStorage.removeItem(old)
    }
  })
}
