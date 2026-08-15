import {
  getAppDayDate,
  getAppDayKey,
  getNextAppDayBoundary,
  getPreviousAppDayKey,
  isTimestampInAppDay,
} from './appDay';

describe('app day', () => {
  it('changes the local day key exactly at 04:30', () => {
    const beforeBoundary = new Date(2026, 7, 15, 4, 29, 59).getTime();
    const atBoundary = new Date(2026, 7, 15, 4, 30, 0).getTime();

    expect(getAppDayKey(beforeBoundary)).toBe('2026-08-14');
    expect(getAppDayKey(atBoundary)).toBe('2026-08-15');
  });

  it('uses local calendar components instead of a UTC date', () => {
    const afternoon = new Date(2026, 7, 15, 12, 30, 0).getTime();

    expect(getAppDayKey(afternoon)).toBe('2026-08-15');
  });

  it('finds the previous day without subtracting a fixed 24 hours', () => {
    const reference = new Date(2026, 0, 1, 8, 0, 0).getTime();

    expect(getPreviousAppDayKey(reference)).toBe('2025-12-31');
  });

  it('returns the next local 04:30 boundary', () => {
    const beforeBoundary = new Date(2026, 7, 15, 4, 29, 59).getTime();
    const atBoundary = new Date(2026, 7, 15, 4, 30, 0).getTime();

    expect(getNextAppDayBoundary(beforeBoundary)).toBe(
      new Date(2026, 7, 15, 4, 30, 0).getTime(),
    );
    expect(getNextAppDayBoundary(atBoundary)).toBe(
      new Date(2026, 7, 16, 4, 30, 0).getTime(),
    );
  });

  it('provides the logical date used by calendar UI', () => {
    const beforeBoundary = new Date(2026, 7, 15, 2, 0, 0).getTime();
    const appDayDate = getAppDayDate(beforeBoundary);

    expect(appDayDate.getFullYear()).toBe(2026);
    expect(appDayDate.getMonth()).toBe(7);
    expect(appDayDate.getDate()).toBe(14);
  });

  it('rejects invalid values and compares valid app days', () => {
    const evening = new Date(2026, 7, 15, 22, 0, 0).getTime();
    const nextMorning = new Date(2026, 7, 16, 4, 0, 0).getTime();

    expect(isTimestampInAppDay(evening, nextMorning)).toBe(true);
    expect(isTimestampInAppDay(undefined, nextMorning)).toBe(false);
    expect(getAppDayKey(Number.NaN)).toBeNull();
  });
});
