import {
  chooseDoneVisualId,
  DEFAULT_DONE_VISUAL_ID,
  getCollectionDoneVisualIds,
  getDoneCollectionPath,
  getFirstCollectionDoneVisualId,
  normalizeDoneVisualId,
  SUMMON_CHANCE,
} from './doneStampVisual';

describe('done stamp visuals', () => {
  it('uses the classic Done stamp for the common outcome', () => {
    expect(chooseDoneVisualId(() => SUMMON_CHANCE)).toBe(DEFAULT_DONE_VISUAL_ID);
  });

  it('chooses and resolves a persisted collection for a rare summon', () => {
    const collectionIds = getCollectionDoneVisualIds();
    const randomValues = [SUMMON_CHANCE / 2, 0];
    const visualId = chooseDoneVisualId(() => randomValues.shift());

    expect(collectionIds.length).toBeGreaterThan(0);
    expect(collectionIds.some((collectionId) => collectionId.startsWith('monster-'))).toBe(true);
    expect(collectionIds.some((collectionId) => collectionId.startsWith('food-'))).toBe(true);
    expect(visualId).toBe(collectionIds[0]);
    expect(getDoneCollectionPath(visualId)).toBe(`/api/collection-assets/${visualId}.webp`);
  });

  it('can summon food from the collection manifest', () => {
    const collectionIds = getCollectionDoneVisualIds();
    const foodIndex = collectionIds.findIndex((collectionId) => collectionId.startsWith('food-'));
    const randomValues = [SUMMON_CHANCE / 2, (foodIndex + 0.5) / collectionIds.length];

    expect(foodIndex).toBeGreaterThanOrEqual(0);
    expect(chooseDoneVisualId(() => randomValues.shift())).toBe(collectionIds[foodIndex]);
  });

  it('rejects unknown persisted visuals', () => {
    expect(normalizeDoneVisualId('unknown-monster')).toBeNull();
    expect(getDoneCollectionPath('unknown-collection')).toBeNull();
  });

  it('selects only the first collection from a completed card group', () => {
    const [firstCollectionId, secondCollectionId] = getCollectionDoneVisualIds();

    expect(getFirstCollectionDoneVisualId([
      { doneVisualId: DEFAULT_DONE_VISUAL_ID },
      { doneVisualId: firstCollectionId },
      { doneVisualId: secondCollectionId },
    ])).toBe(firstCollectionId);
    expect(getFirstCollectionDoneVisualId([
      { doneVisualId: DEFAULT_DONE_VISUAL_ID },
    ])).toBeNull();
  });
});
