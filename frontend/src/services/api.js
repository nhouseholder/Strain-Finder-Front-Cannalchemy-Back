/**
 * MyStrainAI Backend API Client
 *
 * Replaces the local matchingEngine.js + localResultsBuilder.js.
 * All strain scoring now happens server-side using the full 24,853 strain
 * database with receptor pathway science.
 */

const API_BASE = '/api/v1'

/**
 * Get strain recommendations from the MyStrainAI backend.
 * Sends quiz state, returns 5 main results + 2 AI picks.
 *
 * @param {Object} quizState - The quiz context state
 * @returns {Promise<{strains: Array, aiPicks: Array, idealProfile: Object}>}
 */
export async function getRecommendations(quizState) {
  const response = await fetch(`${API_BASE}/quiz/recommend`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(quizState),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(
      errorData.detail || `Server error (${response.status}). Please try again.`
    )
  }

  return response.json()
}

/**
 * Check backend health status.
 * @returns {Promise<{status: string, graph_nodes: number, graph_edges: number}>}
 */
export async function checkHealth() {
  const response = await fetch('/api/health')
  if (!response.ok) throw new Error('Backend unavailable')
  return response.json()
}

// ── Ratings API ────────────────────────────────────────────────────

/**
 * Submit or update a strain rating.
 * @param {string} userId - Firebase user ID
 * @param {Object} rating - { strain_name, strain_type, rating, effects_felt, negative_effects, method, would_try_again, notes }
 */
export async function submitRating(userId, rating) {
  const response = await fetch(`${API_BASE}/ratings/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, rating }),
  })
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.detail || 'Failed to submit rating')
  }
  return response.json()
}

/**
 * Bulk sync all localStorage ratings to the server.
 * Returns all stored ratings + computed preference profile.
 */
export async function syncRatings(userId, ratings) {
  const response = await fetch(`${API_BASE}/ratings/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, ratings }),
  })
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.detail || 'Failed to sync ratings')
  }
  return response.json()
}

/**
 * Get all ratings and the preference profile for a user.
 */
export async function getUserRatings(userId) {
  const response = await fetch(`${API_BASE}/ratings/${userId}`)
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.detail || 'Failed to fetch ratings')
  }
  return response.json()
}

/**
 * Get the learned preference profile for a user.
 */
export async function getUserPreferenceProfile(userId) {
  const response = await fetch(`${API_BASE}/ratings/${userId}/profile`)
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.detail || 'Failed to fetch preferences')
  }
  return response.json()
}

// ── Strain Lookup & Request API ───────────────────────────────

/**
 * Look up a strain by name. Returns full data from the live database.
 * @param {string} name - Strain name to look up
 * @returns {Promise<{found: boolean, strain: Object|null, enrichmentStatus: string, message: string}>}
 */
export async function lookupStrain(name) {
  const response = await fetch(`${API_BASE}/strains/lookup/${encodeURIComponent(name)}`)
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.detail || 'Failed to look up strain')
  }
  return response.json()
}

/**
 * Request a strain be added and enriched.
 * Creates a minimal record if not found, kicks off background enrichment.
 * @param {string} name - Strain name to request
 * @returns {Promise<{found: boolean, strain: Object|null, enrichmentStatus: string, message: string}>}
 */
export async function requestStrain(name) {
  const response = await fetch(`${API_BASE}/strains/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  })
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.detail || 'Failed to request strain')
  }
  return response.json()
}

/**
 * Delete a rating for a specific strain.
 */
export async function deleteRating(userId, strainName) {
  const response = await fetch(
    `${API_BASE}/ratings/${userId}/${encodeURIComponent(strainName)}`,
    { method: 'DELETE' }
  )
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.detail || 'Failed to delete rating')
  }
  return response.json()
}
