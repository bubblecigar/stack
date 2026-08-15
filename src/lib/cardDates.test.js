import { isTimestampToday } from './cardDates';

describe('isTimestampToday', () => {
  it('matches timestamps from the same app day', () => {
    const morning = new Date(2026, 6, 25, 8, 0, 0).getTime();
    const evening = new Date(2026, 6, 25, 21, 30, 0).getTime();

    expect(isTimestampToday(morning, evening)).toBe(true);
  });

  it('keeps the previous app day active until 04:30 local time', () => {
    const previousEvening = new Date(2026, 6, 24, 23, 59, 59).getTime();
    const beforeBoundary = new Date(2026, 6, 25, 4, 29, 59).getTime();
    const atBoundary = new Date(2026, 6, 25, 4, 30, 0).getTime();

    expect(isTimestampToday(previousEvening, beforeBoundary)).toBe(true);
    expect(isTimestampToday(previousEvening, atBoundary)).toBe(false);
    expect(isTimestampToday(undefined, atBoundary)).toBe(false);
  });
});
