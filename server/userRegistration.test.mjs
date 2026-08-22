import assert from 'node:assert/strict';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const databasePath = join(tmpdir(), `stack-user-registration-${process.pid}.sqlite`);
process.env.STACK_DATABASE_PATH = databasePath;

const database = await import('./db.mjs');
const { createInitialCards } = await import('./initialCards.mjs');

test.after(() => {
  database.db.close();
  rmSync(databasePath, { force: true });
  rmSync(`${databasePath}-shm`, { force: true });
  rmSync(`${databasePath}-wal`, { force: true });
});

test('registering a user persists the initial cards and creates a session', () => {
  const result = database.createUser('new-user@example.com', 'test-password');
  const initialCards = createInitialCards();

  assert.deepEqual(
    database.getUserData(result.user.id, 'cards')?.value,
    initialCards,
  );
  assert.deepEqual(
    initialCards.find((card) => card.id === 4)?.childIds,
    [1, 2, 3],
  );
  assert.deepEqual(
    initialCards.filter((card) => typeof card.id === 'number').map((card) => card.text),
    [
      'Swipe the white card to add a new card.',
      'Double-tap the white card to switch between leaf and tree views.',
      'Press and hold the stamp to delete the selected card.',
      'Welcome to Stack\nStart with these three gestures.',
    ],
  );
  assert.equal(database.getSessionUser(result.session.token)?.id, result.user.id);
});

test('logging in does not restore initial cards after the user clears them', () => {
  const result = database.createUser('cleared-user@example.com', 'test-password');
  database.setUserData(result.user.id, 'cards', []);

  database.loginUser('cleared-user@example.com', 'test-password');

  assert.deepEqual(database.getUserData(result.user.id, 'cards')?.value, []);
});

test('registration rolls back the user when initial card creation fails', () => {
  database.db.exec(`
    CREATE TRIGGER fail_initial_cards
    BEFORE INSERT ON user_data
    WHEN NEW.data_key = 'cards'
    BEGIN
      SELECT RAISE(ABORT, 'initial cards failed');
    END;
  `);

  assert.throws(
    () => database.createUser('rollback@example.com', 'test-password'),
    /initial cards failed/,
  );
  database.db.exec('DROP TRIGGER fail_initial_cards');

  const user = database.db.prepare('SELECT id FROM users WHERE email = ?')
    .get('rollback@example.com');
  assert.equal(user, undefined);
});

test('duplicate registration does not replace the existing initial data', () => {
  const result = database.createUser('duplicate@example.com', 'test-password');
  database.setUserData(result.user.id, 'cards', []);

  assert.throws(
    () => database.createUser('duplicate@example.com', 'another-password'),
    (error) => error.status === 409,
  );
  assert.deepEqual(database.getUserData(result.user.id, 'cards')?.value, []);
});
