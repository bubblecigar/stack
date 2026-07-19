# iOS App Testing Plan

This project currently has no automated test setup. Before larger refactors, add tests in layers so the core behavior is protected without making every UI change expensive.

## Goal

The goal is not to test every pixel. The goal is to protect the workflows that make the app usable:

- Card tree structure changes preserve parent/child relationships.
- Leaf mode traversal stays scoped correctly.
- Treasure card behavior remains special where intended.
- Done, archive, delete, restore, and local UI persistence do not regress.
- Production iOS builds can be smoke-tested before installing on the phone.

## Test Layers

### 1. Pure Logic Unit Tests

Start here. These tests are fast, stable, and do not need iOS, Expo Go, or a simulator.

Good targets in this codebase:

- `src/lib/treeLayout.js`
- `src/lib/cardTraversal.js`
- `src/lib/previewCards.js`
- `src/lib/dailyReminder.js`
- `src/lib/uiStateStore.js`
- Pure helper functions in `App.js` that should be moved into `src/lib/`

Recommended tool:

- Jest

Why:

- Most risky app behavior is data transformation.
- These tests are cheap to run before every refactor.
- They avoid flakiness from animation, gestures, and native modules.

Example cases:

- Treasure root is ordered after normal roots.
- Collapsed tree still includes collapsed descendants in layout data as expected.
- Leaf traversal can enter treasure tree and return to normal tree correctly.
- Parent creation under treasure does not move a treasure subtree out of treasure scope.
- UI state restore ignores missing card IDs and falls back safely.

### 2. Component Tests

Use these for rendering decisions, not gesture physics.

Good targets:

- `StackCard`
- `LeafDeck`
- `TreeCanvas`
- `CompletionProgressTree`

Recommended tools:

- Jest
- React Native Testing Library

Example cases:

- Leaf treasure card renders the treasure icon and no edit control.
- Leaf treasure card does not render the draggable done stamp control.
- Done stamp overlay renders for a done normal card.
- Done stamp overlay does not render for a treasure card.
- Collapsed card corner uses treasure colors for treasure cards.
- Tree card edit button is hidden for treasure cards.

Implementation note:

- Add `testID` props to important controls where accessibility labels are not enough.
- Do not snapshot large components by default. Prefer explicit assertions like "this control exists" or "this control is absent".

### 3. Server/API Tests

The app depends on a remote API for auth, cards, and user data. Test the server separately from the UI.

Good targets:

- `server/authserver.mjs`
- `server/apiserver.mjs`
- `server/db.mjs`

Recommended tools:

- Node test runner or Jest
- Temporary SQLite database per test run

Example cases:

- Register, login, and `/auth/me` work.
- Saving cards and loading cards round-trips the exact tree data.
- `user-data` values such as `uiState`, treasure state, and completion data round-trip.
- Invalid token returns 401.

### 4. iOS Simulator Smoke Tests

Use this after unit/component tests exist. It verifies the app can run in an iOS-like environment.

Recommended flow:

1. Start the API server locally.
2. Start the Expo dev server.
3. Open the iOS simulator.
4. Verify login, card load, tree mode, leaf mode, treasure card, and done/delete basics.

This can begin as a manual checklist. Automate it later only when the flows stabilize.

### 5. End-to-End Tests

Use E2E sparingly. These tests are valuable, but slower and more fragile.

Recommended tool for React Native iOS:

- Detox

Use Detox for only the highest-value flows:

- App opens and shows tree mode.
- User can create a root card.
- User can focus a card, switch to leaf mode, swipe, and return to tree mode.
- Treasure card opens in leaf mode without edit/done controls.
- Delete hold removes a normal card.

Why not start here:

- Detox requires native build setup.
- Expo/EAS/iOS simulator setup adds overhead.
- Refactors are easier when pure logic tests already cover most behavior.

## Suggested First Test Milestone

Add a minimal Jest setup and test only pure logic first.

Current status: this milestone has been started. The repo now has Jest scripts and first-pass pure logic tests for:

- `src/lib/treeLayout.js`
- `src/lib/cardTraversal.js`
- `src/lib/previewCards.js`

Target files:

- `src/lib/treeLayout.js`
- `src/lib/cardTraversal.js`
- `src/lib/previewCards.js`

Useful first tests:

- `buildTreeLayout` puts treasure root after normal roots.
- `buildTreeLayout` marks collapsed descendants with `isCollapsedStacked`.
- Leaf traversal returns stable order for a simple tree.
- Preview card insertion creates the expected parent/child IDs.

This milestone should be small: roughly one test config, one npm script, and three test files.

## Suggested Second Test Milestone

Extract risky helpers from `App.js` into `src/lib/`.

Candidates:

- Treasure tree scoping helpers
- Root-tree collection helpers
- Focus fallback helpers
- Completion day calculation helpers

Then add tests around these extracted helpers before changing behavior.

## Suggested Manual iOS Regression Checklist

Run this after a refactor and before installing a production build on the phone.

1. Open app fresh.
2. Confirm app starts in tree mode.
3. Confirm existing cards load.
4. Focus a normal root card.
5. Create child, sibling, and parent.
6. Collapse a card and confirm the collapsed corner hint appears.
7. Switch to leaf mode.
8. Swipe through normal cards.
9. Mark a normal card done.
10. Archive a normal root and confirm focus drops.
11. Open treasure card in tree mode.
12. Switch treasure card to leaf mode.
13. Confirm treasure leaf card has no edit control.
14. Confirm treasure leaf card has no done stamp control.
15. Browse treasure subtree in leaf mode.
16. Return to normal card and confirm normal map scope returns.
17. Delete a normal card with hold progress.
18. Restart app and confirm last focus/mode restore works.
19. Confirm daily reminder permission does not block normal app use.
20. Confirm remote data reload does not leave tree mode empty.

## Recommended `package.json` Scripts

Eventually add:

```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:unit": "jest src/lib",
    "test:e2e:ios": "detox test --configuration ios.sim.debug"
  }
}
```

Do not add Detox first. Add it only after unit/component tests cover the core behavior.

## Practical Refactor Rule

Before refactoring a module, add tests for the behavior you intend to preserve. Then refactor. Then run the tests plus `npm run export:web`.

For this app, the best order is:

1. Test pure tree/card data logic.
2. Extract helpers from `App.js`.
3. Test treasure and leaf traversal behavior.
4. Add focused component tests for controls that must hide/show.
5. Add a small iOS simulator smoke test suite last.
