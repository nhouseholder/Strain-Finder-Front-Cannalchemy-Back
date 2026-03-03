export const TYPE_COLORS = {
  sativa: { bg: 'bg-sativa-500/15', border: 'border-sativa-500/30', text: 'text-sativa-400', hex: '#ff8c32', label: 'Sativa' },
  indica: { bg: 'bg-indica-500/15', border: 'border-indica-500/30', text: 'text-indica-400', hex: '#9350ff', label: 'Indica' },
  hybrid: { bg: 'bg-hybrid-500/15', border: 'border-hybrid-500/30', text: 'text-hybrid-400', hex: '#32c864', label: 'Hybrid' },
};

export const TERPENE_COLORS = {
  myrcene: '#ff6b6b',
  limonene: '#ffd43b',
  linalool: '#9775fa',
  caryophyllene: '#ff922b',
  pinene: '#51cf66',
  terpinolene: '#22b8cf',
  humulene: '#845ef7',
  ocimene: '#f06595',
  bisabolol: '#a9e34b',
  default: '#868e96',
};

export function getTerpeneColor(name) {
  return TERPENE_COLORS[name?.toLowerCase()] || TERPENE_COLORS.default;
}

export function getTypeColor(type) {
  return TYPE_COLORS[type?.toLowerCase()] || TYPE_COLORS.hybrid;
}

export const RECEPTOR_COLORS = {
  CB1: '#32c864',
  CB2: '#3b82f6',
  TRPV1: '#ef4444',
  '5-HT1A': '#a855f7',
  PPARgamma: '#f59e0b',
  GPR55: '#22d3ee',
};

export function getReceptorColor(receptor) {
  return RECEPTOR_COLORS[receptor] || '#6b7280';
}
