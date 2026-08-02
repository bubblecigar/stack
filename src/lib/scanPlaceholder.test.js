import {
  getSnapshot,
  insertRelativeTo,
  loadCards,
  push,
  removeAt,
  updateAt,
} from '../../stackStore';
import {
  appendFlatScanResultToPlaceholder,
  findScanPlaceholderIndex,
  SCAN_PLACEHOLDER_TEXT,
  updatePendingScanPlaceholder,
} from './scanPlaceholder';

function createPlaceholder() {
  const index = push(SCAN_PLACEHOLDER_TEXT);
  return getSnapshot()[index].id;
}

function updatePlaceholder(placeholderId, text) {
  return updatePendingScanPlaceholder({
    getCards: getSnapshot,
    placeholderId,
    text,
    updateCardAt: updateAt,
  });
}

function appendResult(placeholderId, title, texts) {
  return appendFlatScanResultToPlaceholder({
    getCards: getSnapshot,
    insertChildAt: (index, text) => insertRelativeTo(index, 'child', text),
    placeholderId,
    scannedCards: texts.map((text) => ({ text })),
    title,
    updateCardAt: updateAt,
  });
}

describe('scan placeholder coordination', () => {
  beforeEach(() => {
    loadCards([]);
  });

  it('finds a placeholder after it is moved under a new parent', () => {
    const placeholderId = createPlaceholder();
    const originalIndex = findScanPlaceholderIndex(getSnapshot(), placeholderId);
    const parentIndex = insertRelativeTo(originalIndex, 'parent', 'Reading queue');
    const parentId = getSnapshot()[parentIndex].id;

    expect(appendResult(placeholderId, 'Scan result', ['First idea'])).not.toBe(-1);

    const placeholder = getSnapshot().find((card) => card.id === placeholderId);
    const child = getSnapshot().find((card) => card.text === 'First idea');
    expect(placeholder.parentIds).toEqual([parentId]);
    expect(placeholder.childIds).toEqual([child.id]);
    expect(child.parentIds).toEqual([placeholderId]);
  });

  it('ignores a result when its placeholder was deleted', () => {
    const placeholderId = createPlaceholder();
    removeAt(findScanPlaceholderIndex(getSnapshot(), placeholderId));

    expect(appendResult(placeholderId, 'Deleted scan', ['Should not exist'])).toBe(-1);
    expect(getSnapshot().some((card) => card.text === 'Should not exist')).toBe(false);
  });

  it('keeps concurrent results attached to their own placeholders', () => {
    const firstPlaceholderId = createPlaceholder();
    const secondPlaceholderId = createPlaceholder();

    appendResult(secondPlaceholderId, 'Second scan', ['Second result']);
    appendResult(firstPlaceholderId, 'First scan', ['First result']);

    const cards = getSnapshot();
    const firstPlaceholder = cards.find((card) => card.id === firstPlaceholderId);
    const secondPlaceholder = cards.find((card) => card.id === secondPlaceholderId);
    const firstResult = cards.find((card) => card.text === 'First result');
    const secondResult = cards.find((card) => card.text === 'Second result');

    expect(firstPlaceholder.childIds).toEqual([firstResult.id]);
    expect(secondPlaceholder.childIds).toEqual([secondResult.id]);
    expect(firstResult.parentIds).toEqual([firstPlaceholderId]);
    expect(secondResult.parentIds).toEqual([secondPlaceholderId]);
  });

  it('records an empty result without adding children', () => {
    const placeholderId = createPlaceholder();
    const emptyResultText = 'Scan result\nNo readable cards found.';

    expect(updatePlaceholder(placeholderId, emptyResultText)).not.toBe(-1);

    const placeholder = getSnapshot().find((card) => card.id === placeholderId);
    expect(placeholder.text).toBe(emptyResultText);
    expect(placeholder.childIds).toEqual([]);
  });

  it('records a failed result without adding children', () => {
    const placeholderId = createPlaceholder();
    const failureText = 'Scan result\nScan failed: request timed out';

    expect(updatePlaceholder(placeholderId, failureText)).not.toBe(-1);

    const placeholder = getSnapshot().find((card) => card.id === placeholderId);
    expect(placeholder.text).toBe(failureText);
    expect(placeholder.childIds).toEqual([]);
  });

  it('does not overwrite a placeholder title edited by the user', () => {
    const placeholderId = createPlaceholder();
    const placeholderIndex = findScanPlaceholderIndex(getSnapshot(), placeholderId);
    updateAt(placeholderIndex, 'My book notes');

    appendResult(placeholderId, 'Generated title', ['Generated child']);

    const placeholder = getSnapshot().find((card) => card.id === placeholderId);
    expect(placeholder.text).toBe('My book notes');
    expect(placeholder.childIds).toHaveLength(1);
  });
});
