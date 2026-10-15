import { NativeModules, Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { RoutePoint } from '../types';

const LOCATION_TASK = 'big-fella-active-run-location';
const SESSION_FILE = `${FileSystem.documentDirectory}active-run.json`;

export type ActiveRunSession = {
  mode?: 'outdoor' | 'indoor';
  id: string;
  status: 'recording' | 'paused';
  startedAt: number;
  segmentStartedAt: number | null;
  elapsedBeforeSegment: number;
  points: RoutePoint[];
  updatedAt: number;
  distanceUnit: 'miles' | 'km';
};

const liveActivity = NativeModules.RunLiveActivity;

export const elapsedForSession = (session: ActiveRunSession, now = Date.now()) =>
  session.elapsedBeforeSegment + (session.status === 'recording' && session.segmentStartedAt
    ? Math.max(0, Math.floor((now - session.segmentStartedAt) / 1000))
    : 0);

export const readActiveRun = async (): Promise<ActiveRunSession | null> => {
  try {
    const info = await FileSystem.getInfoAsync(SESSION_FILE);
    if (!info.exists) return null;
    return JSON.parse(await FileSystem.readAsStringAsync(SESSION_FILE)) as ActiveRunSession;
  } catch {
    return null;
  }
};

const writeActiveRun = (session: ActiveRunSession) =>
  FileSystem.writeAsStringAsync(SESSION_FILE, JSON.stringify(session));

const updateLiveActivity = (session: ActiveRunSession) => {
  liveActivity?.update?.(elapsedForSession(session), session.points, session.status === 'paused');
};

const restoreLiveActivity = (session: ActiveRunSession) => {
  const args = [session.startedAt, session.distanceUnit || 'miles', elapsedForSession(session), session.points, session.status === 'paused'] as const;
  if (liveActivity?.restoreSession) liveActivity.restoreSession(...args, session.mode || 'outdoor');
  else if (session.mode !== 'indoor') liveActivity?.restore?.(...args);
};

const locationTaskHandler: TaskManager.TaskManagerTaskExecutor = async ({ data, error }) => {
  if (error || !data) return;
  const session = await readActiveRun();
  if (!session || session.mode === 'indoor' || session.status !== 'recording') return;
  const locations = (data as { locations?: Location.LocationObject[] }).locations || [];
  const accepted = locations.filter(location => !location.coords.accuracy || location.coords.accuracy <= 65);
  if (!accepted.length) return;
  session.points.push(...accepted.map(({ coords, timestamp }) => ({
    latitude: coords.latitude,
    longitude: coords.longitude,
    altitude: coords.altitude,
    timestamp,
    elapsedSeconds: session.elapsedBeforeSegment + Math.max(0, Math.floor((timestamp - (session.segmentStartedAt || timestamp)) / 1000)),
  })));
  session.updatedAt = Date.now();
  await writeActiveRun(session);
  updateLiveActivity(session);
};

if (!TaskManager.isTaskDefined(LOCATION_TASK)) {
  TaskManager.defineTask(LOCATION_TASK, locationTaskHandler);
}

const startLocationTask = async () => {
  if (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK)) return;
  await Location.startLocationUpdatesAsync(LOCATION_TASK, {
    accuracy: Location.Accuracy.BestForNavigation,
    activityType: Location.ActivityType.Fitness,
    timeInterval: 1000,
    distanceInterval: 4,
    deferredUpdatesDistance: 20,
    deferredUpdatesInterval: 5000,
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
    foregroundService: Platform.OS === 'android' ? {
      notificationTitle: 'Run in progress',
      notificationBody: 'Big Fella Athletics is recording your route.',
      notificationColor: '#C40000',
    } : undefined,
  });
};

export const requestRunLocationPermission = async () => {
  const foreground = await Location.requestForegroundPermissionsAsync();
  if (foreground.status !== 'granted') return false;
  if (Platform.OS === 'ios') {
    const background = await Location.requestBackgroundPermissionsAsync();
    return background.status === 'granted';
  }
  return true;
};

export const beginActiveRun = async (distanceUnit: 'miles' | 'km', mode: 'outdoor' | 'indoor' = 'outdoor'): Promise<ActiveRunSession> => {
  const existing = await readActiveRun();
  if (existing) { restoreLiveActivity(existing); return existing; }
  const now = Date.now();
  const session: ActiveRunSession = {
    id: `${now}`,
    status: 'recording',
    startedAt: now,
    segmentStartedAt: now,
    elapsedBeforeSegment: 0,
    points: [],
    updatedAt: now,
    distanceUnit,
    mode,
  };
  await writeActiveRun(session);
  if (mode === 'outdoor') {
    await startLocationTask();
  }
  if (liveActivity?.startSession) liveActivity.startSession(now, distanceUnit, mode);
  else if (mode === 'outdoor') liveActivity?.start?.(now, distanceUnit);
  return session;
};

export const pauseActiveRun = async () => {
  const session = await readActiveRun();
  if (!session || session.status === 'paused') return session;
  session.elapsedBeforeSegment = elapsedForSession(session);
  session.segmentStartedAt = null;
  session.status = 'paused';
  session.updatedAt = Date.now();
  await writeActiveRun(session);
  if (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK)) await Location.stopLocationUpdatesAsync(LOCATION_TASK);
  updateLiveActivity(session);
  return session;
};

export const resumeActiveRun = async () => {
  const session = await readActiveRun();
  if (!session || session.status === 'recording') return session;
  session.segmentStartedAt = Date.now();
  session.status = 'recording';
  session.updatedAt = Date.now();
  await writeActiveRun(session);
  if (session.mode !== 'indoor') await startLocationTask();
  updateLiveActivity(session);
  return session;
};

export const clearActiveRun = async () => {
  if (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK)) await Location.stopLocationUpdatesAsync(LOCATION_TASK);
  liveActivity?.end?.();
  await FileSystem.deleteAsync(SESSION_FILE, { idempotent: true });
};

export const reconcileRunTracking = async () => {
  const session = await readActiveRun();
  if (!session) {
    liveActivity?.end?.();
    return null;
  }
  if (session.mode !== 'indoor' && session.status === 'recording') await startLocationTask();
  restoreLiveActivity(session);
  return session;
};
