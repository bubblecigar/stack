import {
  chooseDoneVisualId,
  DEFAULT_DONE_VISUAL_ID,
  getCollectionDoneVisualIds,
  getDoneCollectionPath,
  normalizeDoneVisualId,
  SUMMON_CHANCE,
} from './doneStampVisual';

describe('done stamp visuals', () => {
  it('uses the classic Done stamp for the common outcome', () => {
    expect(chooseDoneVisualId(() => SUMMON_CHANCE)).toBe(DEFAULT_DONE_VISUAL_ID);
  });

  it('resolves collection artwork that is already persisted', () => {
    const collectionIds = getCollectionDoneVisualIds();
    const [visualId] = collectionIds;

    expect(collectionIds.length).toBeGreaterThan(0);
    expect(getDoneCollectionPath(visualId)).toBe(`/api/collection-assets/${visualId}.webp`);
  });

  it('rejects unknown persisted visuals', () => {
    expect(normalizeDoneVisualId('unknown-monster')).toBeNull();
    expect(getDoneCollectionPath('unknown-collection')).toBeNull();
  });
});
