import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Request notification permissions
export const requestNotificationPermissions = async (): Promise<boolean> => {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('Notification permission not granted');
    return false;
  }

  // Configure for Android
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Big Fella Athletics',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF6B35',
    });
  }

  return true;
};

// Schedule a daily run reminder
export const scheduleRunReminder = async (hour: number, minute: number): Promise<string | null> => {
  try {
    // Cancel existing run reminders
    await cancelRunReminder();

    const identifier = await Notifications.scheduleNotificationAsync({
      content: {
        title: "Don't Break Your Streak!",
        body: "You haven't logged a run today. Keep your streak alive!",
        data: { type: 'run_reminder' },
        sound: true,
      },
      trigger: {
        hour,
        minute,
        repeats: true,
      },
    });

    return identifier;
  } catch (error) {
    console.error('Failed to schedule run reminder:', error);
    return null;
  }
};

// Cancel run reminder
export const cancelRunReminder = async (): Promise<void> => {
  const notifications = await Notifications.getAllScheduledNotificationsAsync();

  for (const notification of notifications) {
    if (notification.content.data?.type === 'run_reminder') {
      await Notifications.cancelScheduledNotificationAsync(notification.identifier);
    }
  }
};

// Send a streak milestone notification
export const sendStreakMilestoneNotification = async (streakLength: number): Promise<void> => {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `${streakLength} Day Streak!`,
        body: `Amazing! You've maintained a ${streakLength}-day run streak. Keep it going!`,
        data: { type: 'streak_milestone', streakLength },
        sound: true,
      },
      trigger: null, // Send immediately
    });
  } catch (error) {
    console.error('Failed to send streak notification:', error);
  }
};

// Send a PR notification
export const sendPRNotification = async (
  exerciseName: string,
  weight: number,
  reps: number,
  unit: string
): Promise<void> => {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'New Personal Record!',
        body: `You just hit ${weight} ${unit} x ${reps} on ${exerciseName}!`,
        data: { type: 'pr', exerciseName, weight, reps },
        sound: true,
      },
      trigger: null, // Send immediately
    });
  } catch (error) {
    console.error('Failed to send PR notification:', error);
  }
};

// Send workout reminder
export const sendWorkoutReminder = async (
  workoutName?: string
): Promise<void> => {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Time to Lift!',
        body: workoutName
          ? `Your scheduled ${workoutName} workout is waiting for you.`
          : "Don't skip your workout today!",
        data: { type: 'workout_reminder' },
        sound: true,
      },
      trigger: null,
    });
  } catch (error) {
    console.error('Failed to send workout reminder:', error);
  }
};

// Cancel all notifications
export const cancelAllNotifications = async (): Promise<void> => {
  await Notifications.cancelAllScheduledNotificationsAsync();
};

// Get all scheduled notifications
export const getScheduledNotifications = async () => {
  return Notifications.getAllScheduledNotificationsAsync();
};

// Add notification listener
export const addNotificationListener = (
  handler: (notification: Notifications.Notification) => void
) => {
  return Notifications.addNotificationReceivedListener(handler);
};

// Add response listener (when user taps notification)
export const addNotificationResponseListener = (
  handler: (response: Notifications.NotificationResponse) => void
) => {
  return Notifications.addNotificationResponseReceivedListener(handler);
};
