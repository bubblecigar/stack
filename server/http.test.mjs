import assert from 'node:assert/strict';
import test from 'node:test';

import { handleError } from './http.mjs';

test('handleError sends a JSON error before a response starts', () => {
  let body;
  let headers;
  let statusCode;
  const response = {
    headersSent: false,
    writableEnded: false,
    writeHead(nextStatusCode, nextHeaders) {
      statusCode = nextStatusCode;
      headers = nextHeaders;
    },
    end(nextBody) {
      body = nextBody;
    },
  };
  const error = Object.assign(new Error('Bad request.'), { status: 400 });

  handleError(response, error);

  assert.equal(statusCode, 400);
  assert.equal(headers['Content-Type'], 'application/json');
  assert.deepEqual(JSON.parse(body), { error: 'Bad request.' });
});

test('handleError does not write headers after a response starts', () => {
  let destroyCalls = 0;
  let writeHeadCalls = 0;
  const response = {
    destroyed: false,
    headersSent: true,
    writableEnded: false,
    destroy() {
      destroyCalls += 1;
      this.destroyed = true;
    },
    writeHead() {
      writeHeadCalls += 1;
    },
  };
  const error = Object.assign(new Error('Image stream interrupted.'), { status: 499 });

  handleError(response, error);

  assert.equal(writeHeadCalls, 0);
  assert.equal(destroyCalls, 1);
});
