import { isTimestampToday } from './cardDates';

describe('isTimestampToday', () => {
  it('matches timestamps from the same local calendar day', () => {
    const morning = new Date(2026, 6, 25, 8, 0, 0).getTime();
    const evening = new Date(2026, 6, 25, 21, 30, 0).getTime();

    expect(isTimestampToday(morning, evening)).toBe(true);
  });

  it('rejects timestamps from another local calendar day', () => {
    const previousDay = new Date(2026, 6, 24, 23, 59, 59).getTime();
    const currentDay = new Date(2026, 6, 25, 0, 0, 0).getTime();

    expect(isTimestampToday(previousDay, currentDay)).toBe(false);
    expect(isTimestampToday(undefined, currentDay)).toBe(false);
  });
});
