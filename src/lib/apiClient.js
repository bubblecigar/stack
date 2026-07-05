const fallbackHost = '192.168.1.101';
const DEFAULT_AUTH_BASE_URL = `http://${fallbackHost}:4100`;
const DEFAULT_API_BASE_URL = `http://${fallbackHost}:4101`;

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
