import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, pbkdf2Sync, timingSafeEqual } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

const serverDir = dirname(fileURLToPath(import.meta.url));
const defaultDataDir = join(serverDir, '..', 'data');
const dataDir = process.env.STACK_DATA_DIR || defaultDataDir;
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
`);

const PASSWORD_ITERATIONS = 310000;
const PASSWORD_KEY_LENGTH = 32;
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;

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

export function getDatabasePath() {
  return databasePath;
}
