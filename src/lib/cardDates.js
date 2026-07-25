export function isTimestampToday(timestamp, now = Date.now()) {
  const timestampDate = new Date(Number(timestamp));
  const currentDate = new Date(Number(now));

  if (Number.isNaN(timestampDate.getTime()) || Number.isNaN(currentDate.getTime())) {
    return false;
  }

  return timestampDate.getFullYear() === currentDate.getFullYear()
    && timestampDate.getMonth() === currentDate.getMonth()
    && timestampDate.getDate() === currentDate.getDate();
}
