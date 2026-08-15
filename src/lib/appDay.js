export const APP_DAY_START_HOUR = 4;
export const APP_DAY_START_MINUTE = 30;

function getValidDate(timestamp) {
  const numericTimestamp = Number(timestamp);
  if (timestamp === null || !Number.isFinite(numericTimestamp)) {
    return null;
  }

  const date = new Date(numericTimestamp);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getAppDayParts(timestamp) {
  const date = getValidDate(timestamp);
  if (!date) {
    return null;
  }

  const isBeforeDayStart = date.getHours() < APP_DAY_START_HOUR
    || (
      date.getHours() === APP_DAY_START_HOUR
      && date.getMinutes() < APP_DAY_START_MINUTE
    );

  if (isBeforeDayStart) {
    date.setDate(date.getDate() - 1);
  }

  return {
    day: date.getDate(),
    month: date.getMonth(),
    year: date.getFullYear(),
  };
}

function formatAppDayParts(parts) {
  if (!parts) {
    return null;
  }

  return [
    String(parts.year).padStart(4, '0'),
    String(parts.month + 1).padStart(2, '0'),
    String(parts.day).padStart(2, '0'),
  ].join('-');
}

export function getAppDayKey(timestamp = Date.now()) {
  return formatAppDayParts(getAppDayParts(timestamp));
}

export function getPreviousAppDayKey(timestamp = Date.now()) {
  const appDayDate = getAppDayDate(timestamp);
  if (!appDayDate) {
    return null;
  }

  appDayDate.setDate(appDayDate.getDate() - 1);
  return getAppDayKey(appDayDate.getTime());
}

export function getAppDayDate(timestamp = Date.now()) {
  const parts = getAppDayParts(timestamp);
  if (!parts) {
    return null;
  }

  return new Date(parts.year, parts.month, parts.day, 12, 0, 0, 0);
}

export function isTimestampInAppDay(timestamp, referenceTimestamp = Date.now()) {
  if (timestamp === null || timestamp === undefined || !Number.isFinite(Number(timestamp))) {
    return false;
  }

  const timestampKey = getAppDayKey(timestamp);
  const referenceKey = getAppDayKey(referenceTimestamp);
  return timestampKey !== null && timestampKey === referenceKey;
}

export function getNextAppDayBoundary(timestamp = Date.now()) {
  const current = getValidDate(timestamp) || new Date();
  const boundary = new Date(
    current.getFullYear(),
    current.getMonth(),
    current.getDate(),
    APP_DAY_START_HOUR,
    APP_DAY_START_MINUTE,
    0,
    0,
  );

  if (current.getTime() >= boundary.getTime()) {
    boundary.setDate(boundary.getDate() + 1);
  }

  return boundary.getTime();
}
