/**
 * useQuizHistory — persists completed quiz snapshots per user.
 *
 * Each entry stores the full quiz answers + top 5 result strain names
 * so the user can view and re-run any previous quiz from their dashboard.
 *
 * Storage key: `sf-quiz-history-<uid>` (per-account)
 * Falls back to `sf-quiz-history-anon` for non-logged-in users.
 */
import { useState, useCallback, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'

const PREFIX = 'sf-quiz-history'
const MAX_ENTRIES = 50

function storageKey(uid) {
  return `${PREFIX}-${uid || 'anon'}`
}

function load(uid) {
  try {
    const raw = localStorage.getItem(storageKey(uid))
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function useQuizHistory() {
  const { user } = useAuth()
  const uid = user?.uid || null
  const [entries, setEntries] = useState(() => load(uid))

  // Re-load when uid changes (login/logout)
  useEffect(() => {
    setEntries(load(uid))
  }, [uid])

  // Persist on change
  useEffect(() => {
    localStorage.setItem(storageKey(uid), JSON.stringify(entries))
  }, [entries, uid])

  /**
   * Save a completed quiz.
   * @param {Object} quizState — full quiz context state
   * @param {Array}  topStrains — top result strain objects (we store name + type + score)
   */
  const saveQuiz = useCallback((quizState, topStrains = []) => {
    const entry = {
      id: `quiz-${Date.now()}`,
      date: new Date().toISOString(),
      answers: {
        effects: quizState.effects || [],
        effectRanking: quizState.effectRanking || [],
        tolerance: quizState.tolerance,
        avoidEffects: quizState.avoidEffects || [],
        consumptionMethod: quizState.consumptionMethod,
        budget: quizState.budget,
        subtype: quizState.subtype,
        thcPreference: quizState.thcPreference,
        cbdPreference: quizState.cbdPreference,
        flavors: quizState.flavors || [],
      },
      topStrains: topStrains.slice(0, 5).map(s => ({
        name: s.name,
        type: s.type,
        score: s.score ?? s.totalScore ?? null,
      })),
      resultCount: topStrains.length,
    }
    setEntries(prev => [entry, ...prev].slice(0, MAX_ENTRIES))
    return entry
  }, [])

  const deleteEntry = useCallback((id) => {
    setEntries(prev => prev.filter(e => e.id !== id))
  }, [])

  const clearAll = useCallback(() => {
    setEntries([])
  }, [])

  return { quizHistory: entries, saveQuiz, deleteEntry, clearAll }
}
