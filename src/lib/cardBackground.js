export const DEFAULT_CARD_BACKGROUND_COLOR = '#FFFFFF';

export const CARD_BACKGROUND_OPTIONS = [
  { color: DEFAULT_CARD_BACKGROUND_COLOR, label: 'White' },
  { color: '#FEF3C7', label: 'Soft yellow' },
  { color: '#DCFCE7', label: 'Soft green' },
  { color: '#DBEAFE', label: 'Soft blue' },
  { color: '#FCE7F3', label: 'Soft pink' },
  { color: '#EDE9FE', label: 'Soft violet' },
];

export function normalizeCardBackgroundColor(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const normalizedColor = value.trim().toUpperCase();
  return /^#[0-9A-F]{6}$/.test(normalizedColor) ? normalizedColor : null;
}
