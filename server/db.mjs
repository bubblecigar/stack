import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, pbkdf2Sync, timingSafeEqual } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

const serverDir = dirname(fileURLToPath(import.meta.url));
const defaultDataDir = join(serverDir, '..', 'data');
const dataDir = process.env.STACK_DATA_DIR
  || (process.env.STACK_DATABASE_PATH ? dirname(process.env.STACK_DATABASE_PATH) : defaultDataDir);
const databasePath = process.env.STACK_DATABASE_PATH || join(dataDir, 'stack.sqlite');

mkdirSync(dataDir, { recursive: true });

export const db = new DatabaseSync(databasePath);

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS user_data (
    user_id INTEGER NOT NULL,
    data_key TEXT NOT NULL,
    data_json TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, data_key),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TEXT NOT NULL,
    used_at TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS scan_jobs (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    client_request_id TEXT NOT NULL,
    placeholder_id_json TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'uploading'
      CHECK (status IN ('uploading', 'queued', 'processing', 'completed', 'failed')),
    request_json TEXT,
    image_path TEXT,
    image_mime_type TEXT,
    image_bytes INTEGER,
    result_json TEXT,
    error_text TEXT,
    attempt_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    acknowledged_at TEXT,
    UNIQUE (user_id, client_request_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS scan_jobs_user_pending_idx
  ON scan_jobs (user_id, acknowledged_at, created_at);

  CREATE INDEX IF NOT EXISTS scan_jobs_queue_idx
  ON scan_jobs (status, created_at);
`);

const scanJobColumns = new Set(
  db.prepare('PRAGMA table_info(scan_jobs)').all().map((column) => column.name),
);
const scanJobSchema = db.prepare(`
  SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'scan_jobs'
`).get()?.sql || '';

if (!scanJobColumns.has('image_path') || !scanJobSchema.includes("'uploading'")) {
  db.exec(`
    BEGIN IMMEDIATE;

    DROP INDEX IF EXISTS scan_jobs_user_pending_idx;
    DROP INDEX IF EXISTS scan_jobs_queue_idx;

    CREATE TABLE scan_jobs_next (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      client_request_id TEXT NOT NULL,
      placeholder_id_json TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'uploading'
        CHECK (status IN ('uploading', 'queued', 'processing', 'completed', 'failed')),
      request_json TEXT,
      image_path TEXT,
      image_mime_type TEXT,
      image_bytes INTEGER,
      result_json TEXT,
      error_text TEXT,
      attempt_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      acknowledged_at TEXT,
      UNIQUE (user_id, client_request_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    INSERT INTO scan_jobs_next (
      id,
      user_id,
      client_request_id,
      placeholder_id_json,
      status,
      request_json,
      result_json,
      error_text,
      attempt_count,
      created_at,
      updated_at,
      acknowledged_at
    )
    SELECT
      id,
      user_id,
      client_request_id,
      placeholder_id_json,
      status,
      request_json,
      result_json,
      error_text,
      attempt_count,
      created_at,
      updated_at,
      acknowledged_at
    FROM scan_jobs;

    DROP TABLE scan_jobs;
    ALTER TABLE scan_jobs_next RENAME TO scan_jobs;

    CREATE INDEX scan_jobs_user_pending_idx
    ON scan_jobs (user_id, acknowledged_at, created_at);

    CREATE INDEX scan_jobs_queue_idx
    ON scan_jobs (status, created_at);

    COMMIT;
  `);
}

const PASSWORD_ITERATIONS = 310000;
const PASSWORD_KEY_LENGTH = 32;
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;
const PASSWORD_RESET_TTL_MS = 1000 * 60 * 30;

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function hashPassword(password, saltHex = randomBytes(16).toString('hex')) {
  const passwordHash = pbkdf2Sync(
    String(password),
    Buffer.from(saltHex, 'hex'),
    PASSWORD_ITERATIONS,
    PASSWORD_KEY_LENGTH,
    'sha256',
  ).toString('hex');

  return {
    passwordHash,
    passwordSalt: saltHex,
  };
}

function userView(user) {
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    createdAt: user.created_at,
    updatedAt: user.updated_at,
  };
}

function hashResetToken(token) {
  return pbkdf2Sync(
    String(token),
    Buffer.from('737461636b2d70617373776f72642d7265736574', 'hex'),
    120000,
    PASSWORD_KEY_LENGTH,
    'sha256',
  ).toString('hex');
}

function createSession(userId) {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();

  db.prepare(`
    INSERT INTO sessions (token, user_id, expires_at)
    VALUES (?, ?, ?)
  `).run(token, userId, expiresAt);

  return {
    token,
    expiresAt,
  };
}

export function createUser(email, password) {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail || !String(password || '').trim()) {
    const error = new Error('Email and password are required.');
    error.status = 400;
    throw error;
  }

  const { passwordHash, passwordSalt } = hashPassword(password);

  try {
    const result = db.prepare(`
      INSERT INTO users (email, password_hash, password_salt)
      VALUES (?, ?, ?)
    `).run(normalizedEmail, passwordHash, passwordSalt);

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
    return {
      user: userView(user),
      session: createSession(user.id),
    };
  } catch (error) {
    if (String(error.message).includes('UNIQUE')) {
      const conflict = new Error('Email is already registered.');
      conflict.status = 409;
      throw conflict;
    }

    throw error;
  }
}

export function loginUser(email, password) {
  const normalizedEmail = normalizeEmail(email);
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(normalizedEmail);

  if (!user) {
    const error = new Error('Invalid email or password.');
    error.status = 401;
    throw error;
  }

  const { passwordHash } = hashPassword(password, user.password_salt);
  const expected = Buffer.from(user.password_hash, 'hex');
  const actual = Buffer.from(passwordHash, 'hex');

  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    const error = new Error('Invalid email or password.');
    error.status = 401;
    throw error;
  }

  return {
    user: userView(user),
    session: createSession(user.id),
  };
}

export function createPasswordResetToken(email) {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    const error = new Error('Email is required.');
    error.status = 400;
    throw error;
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(normalizedEmail);
  if (!user) {
    return null;
  }

  db.prepare(`
    UPDATE password_reset_tokens
    SET used_at = CURRENT_TIMESTAMP
    WHERE user_id = ? AND used_at IS NULL
  `).run(user.id);

  const token = randomBytes(18).toString('base64url');
  const tokenHash = hashResetToken(token);
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS).toISOString();

  db.prepare(`
    INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
    VALUES (?, ?, ?)
  `).run(user.id, tokenHash, expiresAt);

  return {
    email: user.email,
    expiresAt,
    token,
  };
}

export function resetPasswordWithToken(token, password) {
  const nextPassword = String(password || '');

  if (!String(token || '').trim() || !nextPassword.trim()) {
    const error = new Error('Reset code and new password are required.');
    error.status = 400;
    throw error;
  }

  const tokenHash = hashResetToken(token);
  const resetRow = db.prepare(`
    SELECT password_reset_tokens.*, users.email
    FROM password_reset_tokens
    JOIN users ON users.id = password_reset_tokens.user_id
    WHERE password_reset_tokens.token_hash = ?
  `).get(tokenHash);

  if (
    !resetRow
    || resetRow.used_at
    || new Date(resetRow.expires_at).getTime() <= Date.now()
  ) {
    const error = new Error('Reset code is invalid or expired.');
    error.status = 400;
    throw error;
  }

  const { passwordHash, passwordSalt } = hashPassword(nextPassword);

  db.prepare(`
    UPDATE users
    SET password_hash = ?, password_salt = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(passwordHash, passwordSalt, resetRow.user_id);

  db.prepare(`
    UPDATE password_reset_tokens
    SET used_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(resetRow.id);

  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(resetRow.user_id);

  return {
    email: resetRow.email,
  };
}

export function getSessionUser(token) {
  if (!token) {
    return null;
  }

  const row = db.prepare(`
    SELECT
      sessions.token,
      sessions.expires_at,
      users.*
    FROM sessions
    JOIN users ON users.id = sessions.user_id
    WHERE sessions.token = ?
  `).get(token);

  if (!row) {
    return null;
  }

  if (new Date(row.expires_at).getTime() <= Date.now()) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    return null;
  }

  return userView(row);
}

export function deleteSession(token) {
  if (!token) {
    return;
  }

  db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

export function getUserData(userId, key) {
  const row = db.prepare(`
    SELECT data_json, updated_at
    FROM user_data
    WHERE user_id = ? AND data_key = ?
  `).get(userId, key);

  if (!row) {
    return null;
  }

  return {
    key,
    value: JSON.parse(row.data_json),
    updatedAt: row.updated_at,
  };
}

export function setUserData(userId, key, value) {
  const dataJson = JSON.stringify(value ?? null);

  db.prepare(`
    INSERT INTO user_data (user_id, data_key, data_json, updated_at)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(user_id, data_key) DO UPDATE SET
      data_json = excluded.data_json,
      updated_at = CURRENT_TIMESTAMP
  `).run(userId, key, dataJson);

  return getUserData(userId, key);
}

export function deleteUserData(userId, key) {
  db.prepare(`
    DELETE FROM user_data
    WHERE user_id = ? AND data_key = ?
  `).run(userId, key);
}

function scanJobView(row) {
  if (!row) {
    return null;
  }

  return {
    acknowledgedAt: row.acknowledged_at,
    attemptCount: row.attempt_count,
    clientRequestId: row.client_request_id,
    createdAt: row.created_at,
    error: row.error_text,
    id: row.id,
    imageBytes: row.image_bytes,
    hasImage: Boolean(row.image_path),
    placeholderId: JSON.parse(row.placeholder_id_json),
    result: row.result_json ? JSON.parse(row.result_json) : null,
    status: row.status,
    updatedAt: row.updated_at,
  };
}

function getScanJobRow(userId, jobId) {
  return db.prepare(`
    SELECT *
    FROM scan_jobs
    WHERE user_id = ? AND id = ?
  `).get(userId, jobId);
}

export function createScanJob(userId, {
  clientRequestId,
  placeholderId,
  request,
}) {
  const normalizedRequestId = String(clientRequestId || '').trim();
  if (!normalizedRequestId || normalizedRequestId.length > 128) {
    const error = new Error('A valid client request ID is required.');
    error.status = 400;
    throw error;
  }

  if (
    placeholderId === null
    || placeholderId === undefined
    || !['number', 'string'].includes(typeof placeholderId)
  ) {
    const error = new Error('A valid placeholder ID is required.');
    error.status = 400;
    throw error;
  }

  const existing = db.prepare(`
    SELECT *
    FROM scan_jobs
    WHERE user_id = ? AND client_request_id = ?
  `).get(userId, normalizedRequestId);
  if (existing) {
    return scanJobView(existing);
  }

  const jobId = randomBytes(18).toString('base64url');
  const initialStatus = request?.imageBase64 ? 'queued' : 'uploading';
  db.prepare(`
    INSERT INTO scan_jobs (
      id,
      user_id,
      client_request_id,
      placeholder_id_json,
      status,
      request_json
    ) VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    jobId,
    userId,
    normalizedRequestId,
    JSON.stringify(placeholderId),
    initialStatus,
    JSON.stringify(request || {}),
  );

  return scanJobView(getScanJobRow(userId, jobId));
}

export function getScanJob(userId, jobId) {
  return scanJobView(getScanJobRow(userId, String(jobId || '')));
}

export function listUnacknowledgedScanJobs(userId) {
  return db.prepare(`
    SELECT *
    FROM scan_jobs
    WHERE user_id = ? AND acknowledged_at IS NULL
    ORDER BY created_at ASC, id ASC
  `).all(userId).map(scanJobView);
}

export function requeueInterruptedScanJobs() {
  db.prepare(`
    UPDATE scan_jobs
    SET status = 'queued', updated_at = CURRENT_TIMESTAMP
    WHERE status = 'processing'
  `).run();
}

export function claimNextScanJob() {
  db.exec('BEGIN IMMEDIATE');
  try {
    const row = db.prepare(`
      SELECT *
      FROM scan_jobs
      WHERE status = 'queued'
      ORDER BY created_at ASC, id ASC
      LIMIT 1
    `).get();

    if (!row) {
      db.exec('COMMIT');
      return null;
    }

    db.prepare(`
      UPDATE scan_jobs
      SET
        status = 'processing',
        attempt_count = attempt_count + 1,
        error_text = NULL,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND status = 'queued'
    `).run(row.id);
    db.exec('COMMIT');

    const claimed = db.prepare('SELECT * FROM scan_jobs WHERE id = ?').get(row.id);
    return {
      ...scanJobView(claimed),
      request: claimed.request_json ? JSON.parse(claimed.request_json) : null,
      imagePath: claimed.image_path,
      imageMimeType: claimed.image_mime_type,
      userId: claimed.user_id,
    };
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

export function completeScanJob(jobId, result) {
  db.prepare(`
    UPDATE scan_jobs
    SET
      status = 'completed',
      request_json = NULL,
      result_json = ?,
      error_text = NULL,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND status = 'processing'
  `).run(JSON.stringify(result), jobId);
}

export function completeScanJobUpload(userId, jobId, {
  imageBytes,
  imageMimeType,
  imagePath,
}) {
  db.prepare(`
    UPDATE scan_jobs
    SET
      status = 'queued',
      image_path = ?,
      image_mime_type = ?,
      image_bytes = ?,
      error_text = NULL,
      updated_at = CURRENT_TIMESTAMP
    WHERE user_id = ? AND id = ? AND status = 'uploading'
  `).run(imagePath, imageMimeType, imageBytes, userId, jobId);

  return getScanJob(userId, jobId);
}

export function failScanJobUpload(userId, jobId, message) {
  db.prepare(`
    UPDATE scan_jobs
    SET
      status = 'failed',
      request_json = NULL,
      error_text = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE user_id = ? AND id = ? AND status = 'uploading'
  `).run(String(message || 'Image upload failed.').slice(0, 500), userId, jobId);

  return getScanJob(userId, jobId);
}

export function failStaleScanJobUploads(maxAgeSeconds) {
  const cutoff = `-${Math.max(Number(maxAgeSeconds) || 0, 1)} seconds`;
  return db.prepare(`
    UPDATE scan_jobs
    SET
      status = 'failed',
      request_json = NULL,
      error_text = 'Image upload did not finish in time.',
      updated_at = CURRENT_TIMESTAMP
    WHERE status = 'uploading' AND updated_at < datetime('now', ?)
  `).run(cutoff).changes;
}

export function clearScanJobImage(jobId) {
  db.prepare(`
    UPDATE scan_jobs
    SET image_path = NULL, image_mime_type = NULL, image_bytes = NULL
    WHERE id = ?
  `).run(jobId);
}

export function listScanJobImagePaths() {
  return db.prepare(`
    SELECT id, image_path, status
    FROM scan_jobs
    WHERE image_path IS NOT NULL
  `).all().map((row) => ({
    id: row.id,
    imagePath: row.image_path,
    status: row.status,
  }));
}

export function failScanJob(jobId, message) {
  db.prepare(`
    UPDATE scan_jobs
    SET
      status = 'failed',
      request_json = NULL,
      result_json = NULL,
      error_text = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND status = 'processing'
  `).run(String(message || 'Scan failed.').slice(0, 500), jobId);
}

export function requeueScanJob(jobId, message) {
  db.prepare(`
    UPDATE scan_jobs
    SET
      status = 'queued',
      error_text = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND status = 'processing'
  `).run(String(message || 'Scan will be retried.').slice(0, 500), jobId);
}

export function acknowledgeScanJob(userId, jobId) {
  db.prepare(`
    UPDATE scan_jobs
    SET acknowledged_at = COALESCE(acknowledged_at, CURRENT_TIMESTAMP),
        updated_at = CURRENT_TIMESTAMP
    WHERE user_id = ?
      AND id = ?
      AND status IN ('completed', 'failed')
  `).run(userId, jobId);

  return getScanJob(userId, jobId);
}

export function getDatabasePath() {
  return databasePath;
}

export function getDataDirectory() {
  return dataDir;
}
