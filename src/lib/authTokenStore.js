import * as SecureStore from 'expo-secure-store';

const AUTH_TOKEN_KEY = 'stack.authToken';

export async function getStoredAuthToken() {
  try {
    return await SecureStore.getItemAsync(AUTH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function setStoredAuthToken(token) {
  if (!token) {
    await clearStoredAuthToken();
    return;
  }

  await SecureStore.setItemAsync(AUTH_TOKEN_KEY, token);
}

export async function clearStoredAuthToken() {
  try {
    await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
  } catch {
    // A failed delete should not block session reset.
  }
}
