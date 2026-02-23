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
  const keys = ['ca-theme', 'ca-quiz', 'ca-results', 'ca-user-favorites', 'ca-user-journal', 'ca-user-recent', 'ca-user-dismissed']
  keys.forEach(k => localStorage.removeItem(k))
}

/** Migrate legacy sf-* keys to ca-* (runs once) */
export function migrateStorageKeys() {
  const map = [
    ['sf-theme', 'ca-theme'],
    ['sf-quiz', 'ca-quiz'],
    ['sf-results', 'ca-results'],
    ['sf-user-favorites', 'ca-user-favorites'],
    ['sf-user-journal', 'ca-user-journal'],
    ['sf-user-recent', 'ca-user-recent'],
    ['sf-user-dismissed', 'ca-user-dismissed'],
  ]
  map.forEach(([old, nw]) => {
    const val = localStorage.getItem(old)
    if (val !== null && localStorage.getItem(nw) === null) {
      localStorage.setItem(nw, val)
      localStorage.removeItem(old)
    }
  })
}
