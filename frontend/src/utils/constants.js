export const APP_NAME = 'MyStrainAI';
export const APP_VERSION = 'v4.4.0 · Feb 28, 2026';

export const STORAGE_KEYS = {
  THEME: 'sf-theme',
  QUIZ: 'sf-quiz',
  RESULTS: 'sf-results',
  FAVORITES: 'sf-user-favorites',
  JOURNAL: 'sf-user-journal',
  RECENT_SEARCHES: 'sf-user-recent',
  DISMISSED: 'sf-user-dismissed',
};

export const MAX_EFFECTS_SELECT = 5;
export const MAX_EFFECTS_RANK = 3;
export const MAX_FEELINGS_SELECT = 3;
export const MAX_COMPARE_STRAINS = 3;
export const MAX_RECENT_SEARCHES = 5;

export const INVALID_STRAIN_NAMES = ['sativa', 'indica', 'hybrid', 'strain', 'unknown', 'n/a'];

export const QUIZ_STEPS = [
  { id: 'effects', label: 'Effects', number: 1 },
  { id: 'tolerance', label: 'Tolerance', number: 2 },
  { id: 'consumption', label: 'Method', number: 3 },
  { id: 'budget', label: 'Budget', number: 4 },
  { id: 'preferences', label: 'Fine-Tune', number: 5 },
];
