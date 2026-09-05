import {
  chooseDoneVisualId,
  DEFAULT_DONE_VISUAL_ID,
  getDoneMonsterPath,
  getFirstMonsterDoneVisualId,
  getMonsterDoneVisualIds,
  normalizeDoneVisualId,
  SUMMON_CHANCE,
} from './doneStampVisual';

describe('done stamp visuals', () => {
  it('uses the classic Done stamp for the common outcome', () => {
    expect(chooseDoneVisualId(() => SUMMON_CHANCE)).toBe(DEFAULT_DONE_VISUAL_ID);
  });

  it('chooses and resolves a persisted monster for a rare hatch', () => {
    const monsterIds = getMonsterDoneVisualIds();
    const randomValues = [SUMMON_CHANCE / 2, 0];
    const visualId = chooseDoneVisualId(() => randomValues.shift());

    expect(monsterIds.length).toBeGreaterThan(0);
    expect(monsterIds.every((monsterId) => monsterId.startsWith('monster-'))).toBe(true);
    expect(visualId).toBe(monsterIds[0]);
    expect(getDoneMonsterPath(visualId)).toBe(`/api/monster-stamps/${visualId}.webp`);
  });

  it('rejects unknown persisted visuals', () => {
    expect(normalizeDoneVisualId('unknown-monster')).toBeNull();
    expect(getDoneMonsterPath('unknown-monster')).toBeNull();
  });

  it('selects only the first monster from a completed card group', () => {
    const [firstMonsterId, secondMonsterId] = getMonsterDoneVisualIds();

    expect(getFirstMonsterDoneVisualId([
      { doneVisualId: DEFAULT_DONE_VISUAL_ID },
      { doneVisualId: firstMonsterId },
      { doneVisualId: secondMonsterId },
    ])).toBe(firstMonsterId);
    expect(getFirstMonsterDoneVisualId([
      { doneVisualId: DEFAULT_DONE_VISUAL_ID },
    ])).toBeNull();
  });
});
