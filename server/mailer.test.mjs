import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createPasswordResetMessage,
  createSmtpTransportOptions,
  sendPasswordResetEmail,
} from './mailer.mjs';

const smtpEnvironment = {
  SMTP_HOST: 'smtp.gmail.com',
  SMTP_PORT: '587',
  SMTP_USER: 'sender@example.com',
  SMTP_PASS: 'abcd efgh ijkl mnop',
  SMTP_FROM: 'sender@example.com',
};

test('creates Gmail STARTTLS transport options and compacts an app password', () => {
  const options = createSmtpTransportOptions(smtpEnvironment);

  assert.equal(options.host, 'smtp.gmail.com');
  assert.equal(options.port, 587);
  assert.equal(options.secure, false);
  assert.equal(options.requireTLS, true);
  assert.deepEqual(options.auth, {
    user: 'sender@example.com',
    pass: 'abcdefghijklmnop',
  });
});

test('sends a password reset message through an injected transport', async () => {
  const reset = {
    email: 'recipient@example.com',
    token: 'reset-code',
    expiresAt: '2026-09-19T12:00:00.000Z',
  };
  let deliveredMessage;
  const transport = {
    async sendMail(message) {
      deliveredMessage = message;
      return { messageId: 'test-message' };
    },
  };

  const result = await sendPasswordResetEmail(reset, {
    environment: smtpEnvironment,
    transport,
  });

  assert.equal(result.messageId, 'test-message');
  assert.equal(deliveredMessage.to, reset.email);
  assert.equal(deliveredMessage.from, smtpEnvironment.SMTP_FROM);
  assert.match(deliveredMessage.text, /reset-code/);
  assert.match(deliveredMessage.text, /2026-09-19T12:00:00\.000Z/);
  assert.equal(deliveredMessage.disableFileAccess, true);
  assert.equal(deliveredMessage.disableUrlAccess, true);
});

test('requires the SMTP sender when composing reset mail', () => {
  assert.throws(
    () => createPasswordResetMessage({
      email: 'recipient@example.com',
      token: 'reset-code',
      expiresAt: '2026-09-19T12:00:00.000Z',
    }, {}),
    /SMTP_FROM/,
  );
});
