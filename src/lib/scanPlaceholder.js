export const SCAN_PLACEHOLDER_TEXT = 'Generating scan result...';

export function findScanPlaceholderIndex(cards, placeholderId) {
  if (!Array.isArray(cards) || placeholderId == null) {
    return -1;
  }

  return cards.findIndex((card) => card?.id === placeholderId);
}

export function updatePendingScanPlaceholder({
  getCards,
  placeholderId,
  text,
  updateCardAt,
}) {
  const cards = getCards();
  const placeholderIndex = findScanPlaceholderIndex(cards, placeholderId);
  const placeholderCard = placeholderIndex === -1 ? null : cards[placeholderIndex];

  if (!placeholderCard || placeholderCard.text !== SCAN_PLACEHOLDER_TEXT) {
    return placeholderIndex;
  }

  updateCardAt(placeholderIndex, text);
  return placeholderIndex;
}

export function appendFlatScanResultToPlaceholder({
  getCards,
  insertChildAt,
  placeholderId,
  scannedCards,
  title,
  updateCardAt,
}) {
  let placeholderIndex = updatePendingScanPlaceholder({
    getCards,
    placeholderId,
    text: title,
    updateCardAt,
  });

  if (placeholderIndex === -1) {
    return -1;
  }

  (Array.isArray(scannedCards) ? scannedCards : []).forEach((card) => {
    placeholderIndex = findScanPlaceholderIndex(getCards(), placeholderId);
    if (placeholderIndex !== -1) {
      insertChildAt(placeholderIndex, card.text);
    }
  });

  return findScanPlaceholderIndex(getCards(), placeholderId);
}

export function getScanImageName(asset) {
  if (asset?.fileName) {
    return asset.fileName;
  }

  const uriName = String(asset?.uri || '').split('/').filter(Boolean).pop();
  return uriName || 'image';
}

export function formatScanResultTitle(asset, timestamp = Date.now()) {
  const imageName = getScanImageName(asset);
  const scannedAt = new Date(timestamp).toLocaleString(undefined, {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  return `Scan result: for img ${imageName} at ${scannedAt}`;
}
