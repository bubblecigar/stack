import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

const DAILY_REMINDER_IDENTIFIER = 'papers.daily-planning-reminder';
const DAILY_REMINDER_HOUR = 8;
const DAILY_REMINDER_MINUTE = 0;

function getReminderBody(previousDayCompletedCount = 0) {
  const safeCount = Math.max(0, Number(previousDayCompletedCount) || 0);
  const taskLabel = safeCount === 1 ? 'task' : 'tasks';
  return `Yesterday you completed ${safeCount} ${taskLabel}. Plan today's stack.`;
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

function isPermissionGranted(permissionStatus) {
  if (permissionStatus?.granted || permissionStatus?.status === 'granted') {
    return true;
  }

  const iosStatus = permissionStatus?.ios?.status;
  return (
    iosStatus === Notifications.IosAuthorizationStatus.AUTHORIZED
    || iosStatus === Notifications.IosAuthorizationStatus.PROVISIONAL
    || iosStatus === Notifications.IosAuthorizationStatus.EPHEMERAL
  );
}

async function requestNotificationPermission() {
  const currentPermission = await Notifications.getPermissionsAsync();
  if (isPermissionGranted(currentPermission)) {
    return true;
  }

  if (currentPermission?.status === 'denied') {
    return false;
  }

  const requestedPermission = await Notifications.requestPermissionsAsync();
  return isPermissionGranted(requestedPermission);
}

export async function ensureDailyReminderScheduled({ previousDayCompletedCount = 0 } = {}) {
  if (Platform.OS === 'web') {
    return false;
  }

  const hasPermission = await requestNotificationPermission();
  if (!hasPermission) {
    return false;
  }

  await Notifications.cancelScheduledNotificationAsync(DAILY_REMINDER_IDENTIFIER);
  await Notifications.scheduleNotificationAsync({
    identifier: DAILY_REMINDER_IDENTIFIER,
    content: {
      title: 'Papers',
      body: getReminderBody(previousDayCompletedCount),
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: DAILY_REMINDER_HOUR,
      minute: DAILY_REMINDER_MINUTE,
    },
  });

  return true;
}
