export const CANNABINOIDS = [
  { id: 'thc', name: 'THC', fullName: 'Delta-9-Tetrahydrocannabinol', color: '#ff8c32', description: 'The primary psychoactive compound. Commonly associated with euphoria, relaxation, and appetite stimulation. Effects vary by individual.' },
  { id: 'cbd', name: 'CBD', fullName: 'Cannabidiol', color: '#9775fa', description: 'Non-psychoactive compound. Research is exploring its potential calming and balancing properties. May modulate THC effects.' },
  { id: 'cbn', name: 'CBN', fullName: 'Cannabinol', color: '#ffd43b', description: 'Mildly psychoactive. Forms as THC ages. Commonly associated with relaxation. Research into its properties is ongoing.' },
  { id: 'cbg', name: 'CBG', fullName: 'Cannabigerol', color: '#51cf66', description: 'The "mother cannabinoid" from which others are synthesized. Early research is exploring its potential properties.' },
  { id: 'thcv', name: 'THCV', fullName: 'Tetrahydrocannabivarin', color: '#22b8cf', description: 'Reported to produce a clear-headed, shorter-duration experience at higher doses. Research is ongoing.' },
  { id: 'cbc', name: 'CBC', fullName: 'Cannabichromene', color: '#f06595', description: 'Non-psychoactive. May contribute to the entourage effect when combined with other cannabinoids. Research is ongoing.' },
];

export const THC_PREFERENCES = [
  { id: 'low', label: 'Low', desc: 'Under 15%', range: [0, 15] },
  { id: 'medium', label: 'Medium', desc: '15–22%', range: [15, 22] },
  { id: 'high', label: 'High', desc: '22–28%', range: [22, 28] },
  { id: 'very_high', label: 'Very High', desc: '28%+', range: [28, 40] },
  { id: 'no_preference', label: 'No Preference', desc: 'Any THC level', range: [0, 40] },
];

export const CBD_PREFERENCES = [
  { id: 'no_preference', label: 'No Preference', desc: 'Any CBD level', range: [0, 30] },
  { id: 'none', label: 'Very Low', desc: 'Under 0.5%', range: [0, 0.5] },
  { id: 'some', label: 'Low', desc: '0.5–1%', range: [0.5, 1] },
  { id: 'high', label: 'Some CBD', desc: '1–5%', range: [1, 5] },
  { id: 'cbd_dominant', label: 'CBD-Rich', desc: '5%+ CBD', range: [5, 30] },
];
