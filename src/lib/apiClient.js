import Constants from 'expo-constants';

function getExpoHost() {
  const hostUri = Constants.expoConfig?.hostUri
    || Constants.manifest2?.extra?.expoGo?.debuggerHost
    || Constants.manifest?.debuggerHost;

  if (!hostUri || typeof hostUri !== 'string') {
    return null;
  }

  return hostUri.split(':')[0] || null;
}

const DEFAULT_REMOTE_BASE_URL = 'https://bubblestack.duckdns.org';
const fallbackHost = getExpoHost();
const DEFAULT_AUTH_BASE_URL = __DEV__ && fallbackHost
  ? `http://${fallbackHost}:4100`
  : DEFAULT_REMOTE_BASE_URL;
const DEFAULT_API_BASE_URL = __DEV__ && fallbackHost
  ? `http://${fallbackHost}:4101`
  : DEFAULT_REMOTE_BASE_URL;

export const AUTH_BASE_URL = process.env.EXPO_PUBLIC_AUTH_SERVER_URL
  || DEFAULT_AUTH_BASE_URL;
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_SERVER_URL
  || DEFAULT_API_BASE_URL;

async function requestJson(url, options = {}) {
  let response;

  try {
    response = await fetch(url, {
      ...options,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });
  } catch (error) {
    const networkError = new Error(`Network request failed: ${url}`);
    networkError.cause = error;
    throw networkError;
  }

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(body.error || 'Request failed.');
    error.status = response.status;
    throw error;
  }

  return body;
}

function authHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
  };
}

export function register(email, password) {
  return requestJson(`${AUTH_BASE_URL}/auth/register`, {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export function login(email, password) {
  return requestJson(`${AUTH_BASE_URL}/auth/login`, {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export function getMe(token) {
  return requestJson(`${AUTH_BASE_URL}/auth/me`, {
    headers: authHeaders(token),
  });
}

export function loadRemoteCards(token) {
  return requestJson(`${API_BASE_URL}/api/cards`, {
    headers: authHeaders(token),
  });
}

export function saveRemoteCards(token, cards) {
  return requestJson(`${API_BASE_URL}/api/cards`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify({ cards }),
  });
}

export function loadRemoteUserData(token, key) {
  return requestJson(`${API_BASE_URL}/api/user-data?key=${encodeURIComponent(key)}`, {
    headers: authHeaders(token),
  });
}

export function saveRemoteUserData(token, key, value) {
  return requestJson(`${API_BASE_URL}/api/user-data?key=${encodeURIComponent(key)}`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify({ key, value }),
  });
}
