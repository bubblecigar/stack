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

export function orderScanTreeNodesForInsertion(scanTree) {
  if (!scanTree || typeof scanTree !== 'object' || !Array.isArray(scanTree.nodes)) {
    throw new Error('Scan result does not contain a card tree.');
  }

  const nodeById = new Map();
  scanTree.nodes.forEach((node) => {
    if (!node || typeof node.id !== 'string' || !node.id || nodeById.has(node.id)) {
      throw new Error('Scan result contains an invalid node ID.');
    }
    nodeById.set(node.id, node);
  });

  scanTree.nodes.forEach((node) => {
    if (node.parentId !== null && !nodeById.has(node.parentId)) {
      throw new Error('Scan result contains a missing parent.');
    }
  });

  const orderedNodes = [];
  const visitedIds = new Set();
  const visitingIds = new Set();

  function visit(node) {
    if (visitedIds.has(node.id)) {
      return;
    }
    if (visitingIds.has(node.id)) {
      throw new Error('Scan result contains a cycle.');
    }

    visitingIds.add(node.id);
    if (node.parentId !== null) {
      visit(nodeById.get(node.parentId));
    }
    visitingIds.delete(node.id);
    visitedIds.add(node.id);
    orderedNodes.push(node);
  }

  scanTree.nodes.forEach(visit);
  return orderedNodes;
}

export function appendScanTreeResultToPlaceholder({
  getCards,
  insertChildAt,
  placeholderId,
  scanTree,
  updateCardAt,
}) {
  const orderedNodes = orderScanTreeNodesForInsertion(scanTree);
  let placeholderIndex = updatePendingScanPlaceholder({
    getCards,
    placeholderId,
    text: scanTree.title,
    updateCardAt,
  });

  if (placeholderIndex === -1) {
    return -1;
  }

  const cardIdByNodeId = new Map();
  orderedNodes.forEach((node) => {
    const parentCardId = node.parentId === null
      ? placeholderId
      : cardIdByNodeId.get(node.parentId);
    const parentIndex = findScanPlaceholderIndex(getCards(), parentCardId);
    if (parentIndex === -1) {
      throw new Error('Scan insertion target no longer exists.');
    }

    const insertedIndex = insertChildAt(parentIndex, node.text);
    const insertedCard = getCards()[insertedIndex];
    if (!insertedCard) {
      throw new Error('Could not insert a generated scan card.');
    }
    cardIdByNodeId.set(node.id, insertedCard.id);
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
