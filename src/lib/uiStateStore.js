import * as SecureStore from 'expo-secure-store';

const UI_STATE_KEY_PREFIX = 'stack.uiState';
const pendingWritesByKey = new Map();

function getUiStateKey(userId) {
  return `${UI_STATE_KEY_PREFIX}.${userId}`;
}

function normalizeCardId(cardId) {
  if (cardId === null || cardId === undefined || cardId === '') {
    return null;
  }

  if (typeof cardId === 'number') {
    return Number.isInteger(cardId) ? cardId : null;
  }

  if (typeof cardId !== 'string') {
    return null;
  }

  const trimmedCardId = cardId.trim();
  if (!trimmedCardId) {
    return null;
  }

  const numericCardId = Number(trimmedCardId);
  return Number.isInteger(numericCardId) ? numericCardId : trimmedCardId;
}

function normalizeCardIds(cardIds) {
  if (!Array.isArray(cardIds)) {
    return [];
  }

  return [...new Set(cardIds.map(normalizeCardId).filter((cardId) => cardId !== null))];
}

export function normalizeUiState(rawState) {
  if (!rawState || typeof rawState !== 'object') {
    return null;
  }

  const layoutMode = rawState.layoutMode === 'tree' ? 'tree' : 'leaf';
  return {
    archivedRootIds: normalizeCardIds(rawState.archivedRootIds),
    collapsedNodeIds: normalizeCardIds(rawState.collapsedNodeIds),
    focusedCardId: normalizeCardId(rawState.focusedCardId),
    layoutMode,
    leafFocusedCardId: normalizeCardId(rawState.leafFocusedCardId),
  };
}

export async function getStoredUiState(userId) {
  if (userId === null || userId === undefined) {
    return null;
  }

  const value = await SecureStore.getItemAsync(getUiStateKey(userId));
  if (value === null) {
    return null;
  }

  return normalizeUiState(JSON.parse(value));
}

export async function setStoredUiState(userId, state) {
  if (userId === null || userId === undefined) {
    return;
  }

  const normalizedState = normalizeUiState(state);
  if (!normalizedState) {
    return;
  }

  const key = getUiStateKey(userId);
  const previousWrite = pendingWritesByKey.get(key) || Promise.resolve();
  const nextWrite = previousWrite
    .catch(() => {})
    .then(() => SecureStore.setItemAsync(key, JSON.stringify(normalizedState)));

  pendingWritesByKey.set(key, nextWrite);

  try {
    await nextWrite;
  } finally {
    if (pendingWritesByKey.get(key) === nextWrite) {
      pendingWritesByKey.delete(key);
    }
  }
}
