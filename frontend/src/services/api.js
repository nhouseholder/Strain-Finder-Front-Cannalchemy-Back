/**
 * Strain Finder Backend API Client
 *
 * Replaces the local matchingEngine.js + localResultsBuilder.js.
 * All strain scoring now happens server-side using the full 24,853 strain
 * database with receptor pathway science.
 */

const API_BASE = '/api/v1'

/**
 * Get strain recommendations from the Strain Finder backend.
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
