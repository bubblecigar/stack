import nodemailer from 'nodemailer';

const DEFAULT_SMTP_PORT = 587;

function requiredEnvironmentValue(environment, name) {
  const value = String(environment[name] || '').trim();

  if (!value) {
    throw new Error(`Missing required SMTP setting: ${name}.`);
  }

  return value;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function createSmtpTransportOptions(environment = process.env) {
  const portValue = String(environment.SMTP_PORT || DEFAULT_SMTP_PORT).trim();
  const port = Number(portValue);

  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error('SMTP_PORT must be a valid TCP port.');
  }

  return {
    host: requiredEnvironmentValue(environment, 'SMTP_HOST'),
    port,
    secure: port === 465,
    requireTLS: port !== 465,
    auth: {
      user: requiredEnvironmentValue(environment, 'SMTP_USER'),
      // Google displays app passwords in groups; SMTP expects the 16 characters.
      pass: requiredEnvironmentValue(environment, 'SMTP_PASS').replace(/\s/g, ''),
    },
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 30_000,
  };
}

export function createPasswordResetMessage(reset, environment = process.env) {
  const from = requiredEnvironmentValue(environment, 'SMTP_FROM');
  const expiration = new Date(reset.expiresAt);
  const expirationText = Number.isNaN(expiration.getTime())
    ? String(reset.expiresAt)
    : expiration.toISOString();
  const safeToken = escapeHtml(reset.token);
  const safeExpiration = escapeHtml(expirationText);

  return {
    from,
    to: reset.email,
    subject: 'Your Stack password reset code',
    text: [
      'Use this code to reset your Stack password:',
      '',
      reset.token,
      '',
      `This code expires at ${expirationText}.`,
      'If you did not request a password reset, you can ignore this email.',
    ].join('\n'),
    html: [
      '<p>Use this code to reset your Stack password:</p>',
      `<p style="font-size: 24px; font-weight: 700; letter-spacing: 2px;">${safeToken}</p>`,
      `<p>This code expires at ${safeExpiration}.</p>`,
      '<p>If you did not request a password reset, you can ignore this email.</p>',
    ].join(''),
    disableFileAccess: true,
    disableUrlAccess: true,
  };
}

export async function sendPasswordResetEmail(
  reset,
  { environment = process.env, transport } = {},
) {
  const mailTransport = transport
    || nodemailer.createTransport(createSmtpTransportOptions(environment));

  return mailTransport.sendMail(createPasswordResetMessage(reset, environment));
}
