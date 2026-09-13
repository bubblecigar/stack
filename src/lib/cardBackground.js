export const DEFAULT_CARD_BACKGROUND_COLOR = '#FFFFFF';

export const CARD_BACKGROUND_OPTIONS = [
  { color: DEFAULT_CARD_BACKGROUND_COLOR, label: 'White' },
  { color: '#FEF3C7', label: 'Soft yellow' },
  { color: '#DBEAFE', label: 'Soft blue' },
];

export function normalizeCardBackgroundColor(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const normalizedColor = value.trim().toUpperCase();
  return /^#[0-9A-F]{6}$/.test(normalizedColor) ? normalizedColor : null;
}

export function normalizeNewCardBackgroundColor(value) {
  const normalizedColor = normalizeCardBackgroundColor(value);
  return CARD_BACKGROUND_OPTIONS.some(({ color }) => color === normalizedColor)
    ? normalizedColor
    : DEFAULT_CARD_BACKGROUND_COLOR;
}
