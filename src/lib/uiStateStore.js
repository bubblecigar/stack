import * as SecureStore from 'expo-secure-store';

const UI_STATE_KEY_PREFIX = 'stack.uiState';

function getUiStateKey(userId) {
  return `${UI_STATE_KEY_PREFIX}.${userId}`;
}

function normalizeUiState(rawState) {
  if (!rawState || typeof rawState !== 'object') {
    return null;
  }

  const layoutMode = rawState.layoutMode === 'tree' ? 'tree' : 'leaf';
  const focusedCardId = Number(rawState.focusedCardId);
  const leafFocusedCardId = Number(rawState.leafFocusedCardId);

  return {
    focusedCardId: Number.isInteger(focusedCardId) ? focusedCardId : null,
    layoutMode,
    leafFocusedCardId: Number.isInteger(leafFocusedCardId) ? leafFocusedCardId : null,
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
