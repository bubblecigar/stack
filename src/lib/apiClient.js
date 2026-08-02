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

const shouldLogApiRequests = typeof __DEV__ !== 'undefined' && __DEV__;
let hasLoggedApiConfig = false;

function logApiConfig() {
  if (!shouldLogApiRequests || hasLoggedApiConfig) {
    return;
  }

  hasLoggedApiConfig = true;
  console.log('[api] resolved endpoints', {
    apiBaseUrl: API_BASE_URL,
    authBaseUrl: AUTH_BASE_URL,
    defaultApiBaseUrl: DEFAULT_API_BASE_URL,
    defaultAuthBaseUrl: DEFAULT_AUTH_BASE_URL,
    envApiBaseUrl: process.env.EXPO_PUBLIC_API_SERVER_URL || null,
    envAuthBaseUrl: process.env.EXPO_PUBLIC_AUTH_SERVER_URL || null,
    expoHost: fallbackHost,
  });
}

async function requestJson(url, options = {}) {
  let response;
  const method = options.method || 'GET';

  logApiConfig();
  if (shouldLogApiRequests) {
    console.log(`[api] ${method} ${url}`);
  }

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
    if (shouldLogApiRequests) {
      console.log(`[api] ${method} ${url} network error`, error?.message || error);
    }

    const networkError = new Error(`Network request failed: ${url}`);
    networkError.cause = error;
    throw networkError;
  }

  const body = await response.json().catch(() => ({}));

  if (shouldLogApiRequests) {
    console.log(`[api] ${method} ${url} -> ${response.status}`);
  }

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

export function requestPasswordReset(email) {
  return requestJson(`${AUTH_BASE_URL}/auth/forgot-password`, {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export function resetPassword(token, password) {
  return requestJson(`${AUTH_BASE_URL}/auth/reset-password`, {
    method: 'POST',
    body: JSON.stringify({ token, password }),
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

export function scanImageToCards(token, image) {
  return requestJson(`${API_BASE_URL}/api/scan-cards`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(image),
  });
}

export function createScanJob(token, request) {
  return requestJson(`${API_BASE_URL}/api/scan-jobs`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(request),
  });
}

export function loadScanJobs(token) {
  return requestJson(`${API_BASE_URL}/api/scan-jobs`, {
    headers: authHeaders(token),
  });
}

export function acknowledgeScanJob(token, jobId) {
  return requestJson(
    `${API_BASE_URL}/api/scan-jobs/${encodeURIComponent(jobId)}/acknowledge`,
    {
      method: 'POST',
      headers: authHeaders(token),
    },
  );
}
