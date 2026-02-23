export const APP_NAME = 'Strain Finder';
export const APP_VERSION = '3.0.4';

export const STORAGE_KEYS = {
  THEME: 'ca-theme',
  QUIZ: 'ca-quiz',
  RESULTS: 'ca-results',
  FAVORITES: 'ca-user-favorites',
  JOURNAL: 'ca-user-journal',
  RECENT_SEARCHES: 'ca-user-recent',
  DISMISSED: 'ca-user-dismissed',
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
