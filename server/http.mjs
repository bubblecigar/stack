export function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'content-type, authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Content-Type': 'application/json',
  });
  response.end(JSON.stringify(body));
}

function getClientAddress(request) {
  const forwardedFor = request.headers['x-forwarded-for'];

  if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
    return forwardedFor.split(',')[0].trim();
  }

  return request.socket.remoteAddress || 'unknown';
}

export function withRequestLogging(serviceName, handler) {
  return async (request, response) => {
    const startedAt = performance.now();
    const clientAddress = getClientAddress(request);
    const url = new URL(request.url, `http://${request.headers.host}`);

    response.on('finish', () => {
      const elapsedMs = Math.round(performance.now() - startedAt);
      console.log(
        `[${serviceName}] ${request.method} ${url.pathname}${url.search} `
        + `${response.statusCode} ${elapsedMs}ms ${clientAddress}`,
      );
    });

    await handler(request, response);
  };
}

export function sendNoContent(response) {
  response.writeHead(204, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'content-type, authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  });
  response.end();
}

export async function readJson(request) {
  const chunks = [];

  for await (const chunk of request) {
    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    return {};
  }

  const rawBody = Buffer.concat(chunks).toString('utf8');
  return JSON.parse(rawBody || '{}');
}

export function getBearerToken(request) {
  const authorization = request.headers.authorization || '';
  const [scheme, token] = authorization.split(' ');

  if (scheme?.toLowerCase() !== 'bearer') {
    return null;
  }

  return token || null;
}

export function handleError(response, error) {
  const status = Number.isInteger(error.status) ? error.status : 500;
  const message = status === 500 ? 'Internal server error.' : error.message;

  if (status === 500) {
    console.error(error);
  }

  sendJson(response, status, {
    error: message,
  });
}

export function requireMethod(request, response, allowedMethods) {
  if (allowedMethods.includes(request.method)) {
    return true;
  }

  sendJson(response, 405, {
    error: 'Method not allowed.',
  });
  return false;
}
