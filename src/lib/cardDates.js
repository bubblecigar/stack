import { isTimestampInAppDay } from './appDay';

export function isTimestampToday(timestamp, now = Date.now()) {
  return isTimestampInAppDay(timestamp, now);
}
