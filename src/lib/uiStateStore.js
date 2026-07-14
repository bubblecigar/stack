import * as SecureStore from 'expo-secure-store';

const UI_STATE_KEY_PREFIX = 'stack.uiState';

function getUiStateKey(userId) {
  return `${UI_STATE_KEY_PREFIX}.${userId}`;
}

function normalizeOptionalCardId(cardId) {
  if (cardId === null || cardId === undefined || cardId === '') {
    return null;
  }

  const normalizedCardId = Number(cardId);
  return Number.isInteger(normalizedCardId) ? normalizedCardId : null;
}

export function normalizeUiState(rawState) {
  if (!rawState || typeof rawState !== 'object') {
    return null;
  }

  const layoutMode = rawState.layoutMode === 'tree' ? 'tree' : 'leaf';
  const archivedRootIds = Array.isArray(rawState.archivedRootIds)
    ? rawState.archivedRootIds
      .map((cardId) => Number(cardId))
      .filter((cardId) => Number.isInteger(cardId))
    : [];

  return {
    archivedRootIds,
    focusedCardId: normalizeOptionalCardId(rawState.focusedCardId),
    layoutMode,
    leafFocusedCardId: normalizeOptionalCardId(rawState.leafFocusedCardId),
  };
}

export async function getStoredUiState(userId) {
  if (userId === null || userId === undefined) {
    return null;
  }

  try {
    const value = await SecureStore.getItemAsync(getUiStateKey(userId));
    return normalizeUiState(JSON.parse(value));
  } catch {
    return null;
  }
}

export async function setStoredUiState(userId, state) {
  if (userId === null || userId === undefined) {
    return;
  }

  const normalizedState = normalizeUiState(state);
  if (!normalizedState) {
    return;
  }

  await SecureStore.setItemAsync(getUiStateKey(userId), JSON.stringify(normalizedState));
}
