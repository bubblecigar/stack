import { createServer } from 'node:http';
import {
  createPasswordResetToken,
  createUser,
  deleteSession,
  getDatabasePath,
  getSessionUser,
  loginUser,
  resetPasswordWithToken,
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

const port = Number(process.env.AUTH_PORT || 4100);
const host = process.env.AUTH_HOST || '0.0.0.0';

function sendAuthResponse(response, result, statusCode = 200) {
  sendJson(response, statusCode, {
    user: result.user,
    token: result.session.token,
    expiresAt: result.session.expiresAt,
  });
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
        service: 'authserver',
        databasePath: getDatabasePath(),
      });
      return;
    }

    if (url.pathname === '/auth/register') {
      if (!requireMethod(request, response, ['POST'])) {
        return;
      }

      const body = await readJson(request);
      sendAuthResponse(response, createUser(body.email, body.password), 201);
      return;
    }

    if (url.pathname === '/auth/login') {
      if (!requireMethod(request, response, ['POST'])) {
        return;
      }

      const body = await readJson(request);
      sendAuthResponse(response, loginUser(body.email, body.password));
      return;
    }

    if (url.pathname === '/auth/logout') {
      if (!requireMethod(request, response, ['POST'])) {
        return;
      }

      deleteSession(getBearerToken(request));
      sendJson(response, 200, {
        ok: true,
      });
      return;
    }

    if (url.pathname === '/auth/forgot-password') {
      if (!requireMethod(request, response, ['POST'])) {
        return;
      }

      const body = await readJson(request);
      const reset = createPasswordResetToken(body.email);

      if (reset) {
        console.log(
          `[authserver] password reset code for ${reset.email}: `
          + `${reset.token} expires ${reset.expiresAt}`,
        );
      }

      sendJson(response, 200, {
        ok: true,
        message: 'If an account exists for that email, a reset code has been sent.',
      });
      return;
    }

    if (url.pathname === '/auth/reset-password') {
      if (!requireMethod(request, response, ['POST'])) {
        return;
      }

      const body = await readJson(request);
      resetPasswordWithToken(body.token, body.password);
      sendJson(response, 200, {
        ok: true,
      });
      return;
    }

    if (url.pathname === '/auth/me') {
      if (!requireMethod(request, response, ['GET'])) {
        return;
      }

      const user = getSessionUser(getBearerToken(request));
      if (!user) {
        sendJson(response, 401, {
          error: 'Unauthorized.',
        });
        return;
      }

      sendJson(response, 200, {
        user,
      });
      return;
    }

    sendJson(response, 404, {
      error: 'Not found.',
    });
  } catch (error) {
    handleError(response, error);
  }
}

const server = createServer(withRequestLogging('authserver', handleRequest));

server.listen(port, host, () => {
  console.log(`authserver listening on http://${host}:${port}`);
  console.log(`set EXPO_PUBLIC_AUTH_SERVER_URL=http://YOUR_LAN_IP:${port} if auto-detection fails`);
  console.log(`sqlite database: ${getDatabasePath()}`);
});
