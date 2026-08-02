import { createServer } from 'node:http';
import {
  acknowledgeScanJob,
  createScanJob,
  deleteUserData,
  getDatabasePath,
  getScanJob,
  getSessionUser,
  getUserData,
  listUnacknowledgedScanJobs,
  setUserData,
} from './db.mjs';
import {
  getBearerToken,
  handleError,
  readJson,
  requireMethod,
  sendJson,
  sendNoContent,
  withRequestLogging,
} from './http.mjs';
import { scanImageToCards } from './openaiVision.mjs';
import { scheduleScanJobWorker, startScanJobWorker } from './scanJobWorker.mjs';

const port = Number(process.env.API_PORT || 4101);
const host = process.env.API_HOST || '0.0.0.0';

function getAuthenticatedUser(request, response) {
  const user = getSessionUser(getBearerToken(request));

  if (!user) {
    sendJson(response, 401, {
      error: 'Unauthorized.',
    });
    return null;
  }

  return user;
}

function readDataKey(url) {
  return String(url.searchParams.get('key') || 'stack').trim() || 'stack';
}

async function handleRequest(request, response) {
  try {
    if (request.method === 'OPTIONS') {
      sendNoContent(response);
      return;
    }

    const url = new URL(request.url, `http://${request.headers.host}`);

    if (url.pathname === '/health') {
      if (!requireMethod(request, response, ['GET'])) {
        return;
      }

      sendJson(response, 200, {
        ok: true,
        service: 'apiserver',
        databasePath: getDatabasePath(),
      });
      return;
    }

    if (url.pathname === '/api/user-data') {
      const user = getAuthenticatedUser(request, response);
      if (!user) {
        return;
      }

      const key = readDataKey(url);

      if (request.method === 'GET') {
        sendJson(response, 200, getUserData(user.id, key) || {
          key,
          value: null,
          updatedAt: null,
        });
        return;
      }

      if (request.method === 'PUT') {
        const body = await readJson(request);
        sendJson(response, 200, setUserData(user.id, body.key || key, body.value));
        return;
      }

      if (request.method === 'DELETE') {
        deleteUserData(user.id, key);
        sendJson(response, 200, {
          ok: true,
        });
        return;
      }

      sendJson(response, 405, {
        error: 'Method not allowed.',
      });
      return;
    }

    if (url.pathname === '/api/cards') {
      const user = getAuthenticatedUser(request, response);
      if (!user) {
        return;
      }

      if (request.method === 'GET') {
        const data = getUserData(user.id, 'cards');
        sendJson(response, 200, {
          cards: Array.isArray(data?.value) ? data.value : [],
          updatedAt: data?.updatedAt ?? null,
        });
        return;
      }

      if (request.method === 'PUT') {
        const body = await readJson(request);
        const cards = Array.isArray(body.cards) ? body.cards : [];
        const data = setUserData(user.id, 'cards', cards);
        sendJson(response, 200, {
          cards: data.value,
          updatedAt: data.updatedAt,
        });
        return;
      }

      sendJson(response, 405, {
        error: 'Method not allowed.',
      });
      return;
    }

    if (url.pathname === '/api/scan-cards') {
      const user = getAuthenticatedUser(request, response);
      if (!user) {
        return;
      }

      if (!requireMethod(request, response, ['POST'])) {
        return;
      }

      const body = await readJson(request);
      sendJson(response, 200, await scanImageToCards(body));
      return;
    }

    if (url.pathname === '/api/scan-jobs') {
      const user = getAuthenticatedUser(request, response);
      if (!user) {
        return;
      }

      if (request.method === 'GET') {
        sendJson(response, 200, {
          jobs: listUnacknowledgedScanJobs(user.id),
        });
        return;
      }

      if (request.method === 'POST') {
        const body = await readJson(request);
        const job = createScanJob(user.id, {
          clientRequestId: body.clientRequestId,
          placeholderId: body.placeholderId,
          request: {
            imageBase64: body.imageBase64,
            mimeType: body.mimeType,
            prompt: body.prompt,
          },
        });
        scheduleScanJobWorker();
        sendJson(response, 202, { job });
        return;
      }

      sendJson(response, 405, {
        error: 'Method not allowed.',
      });
      return;
    }

    const scanJobMatch = url.pathname.match(/^\/api\/scan-jobs\/([^/]+)$/);
    if (scanJobMatch) {
      const user = getAuthenticatedUser(request, response);
      if (!user) {
        return;
      }

      if (!requireMethod(request, response, ['GET'])) {
        return;
      }

      const job = getScanJob(user.id, decodeURIComponent(scanJobMatch[1]));
      if (!job) {
        sendJson(response, 404, { error: 'Scan job not found.' });
        return;
      }

      sendJson(response, 200, { job });
      return;
    }

    const scanJobAcknowledgeMatch = url.pathname.match(
      /^\/api\/scan-jobs\/([^/]+)\/acknowledge$/,
    );
    if (scanJobAcknowledgeMatch) {
      const user = getAuthenticatedUser(request, response);
      if (!user) {
        return;
      }

      if (!requireMethod(request, response, ['POST'])) {
        return;
      }

      const job = acknowledgeScanJob(
        user.id,
        decodeURIComponent(scanJobAcknowledgeMatch[1]),
      );
      if (!job) {
        sendJson(response, 404, { error: 'Scan job not found.' });
        return;
      }

      if (!job.acknowledgedAt) {
        sendJson(response, 409, { error: 'Scan job is not finished.' });
        return;
      }

      sendJson(response, 200, { job });
      return;
    }

    sendJson(response, 404, {
      error: 'Not found.',
    });
  } catch (error) {
    handleError(response, error);
  }
}

const server = createServer(withRequestLogging('apiserver', handleRequest));

server.listen(port, host, () => {
  startScanJobWorker();
  console.log(`apiserver listening on http://${host}:${port}`);
  console.log(`set EXPO_PUBLIC_API_SERVER_URL=http://YOUR_LAN_IP:${port} if auto-detection fails`);
  console.log(`sqlite database: ${getDatabasePath()}`);
});
