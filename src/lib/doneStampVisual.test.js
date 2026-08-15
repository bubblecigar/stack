import {
  chooseDoneVisualId,
  DEFAULT_DONE_VISUAL_ID,
  getDoneMonsterPath,
  getMonsterDoneVisualIds,
  normalizeDoneVisualId,
} from './doneStampVisual';

describe('done stamp visuals', () => {
  it('uses the classic Done stamp for the common outcome', () => {
    expect(chooseDoneVisualId(() => 0.5)).toBe(DEFAULT_DONE_VISUAL_ID);
  });

  it('chooses and resolves a persisted monster for a rare hatch', () => {
    const monsterIds = getMonsterDoneVisualIds();
    const randomValues = [0.01, 0];
    const visualId = chooseDoneVisualId(() => randomValues.shift());

    expect(monsterIds.length).toBeGreaterThan(0);
    expect(visualId).toBe(monsterIds[0]);
    expect(getDoneMonsterPath(visualId)).toBe(`/api/monster-stamps/${visualId}.webp`);
  });

  it('rejects unknown persisted visuals', () => {
    expect(normalizeDoneVisualId('unknown-monster')).toBeNull();
    expect(getDoneMonsterPath('unknown-monster')).toBeNull();
  });
});
