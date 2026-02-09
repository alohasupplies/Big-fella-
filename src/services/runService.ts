import { v4 as uuidv4 } from 'uuid';
import { Run, RunType, Streak } from '../types';
import { getAll, getFirst, runQuery } from '../database/database';

// Create a new run
export const createRun = async (
  distance: number,
  duration: number, // in seconds
  runType: RunType,
  routeName?: string,
  weather?: string,
  notes?: string,
  date?: string
): Promise<Run> => {
  const runId = uuidv4();
  const now = new Date().toISOString();
  const runDate = date || now.split('T')[0];

  // Calculate pace (minutes per mile/km)
  const pace = duration / 60 / distance;

  await runQuery(
    `INSERT INTO runs (id, date, distance, duration, pace, routeName, runType, weather, notes, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [runId, runDate, distance, duration, pace, routeName || null, runType, weather || null, notes || null, now, now]
  );

  // Update streak after logging a run
  await updateStreak(runDate);

  return (await getRunById(runId)) as Run;
};

// Get run by ID
export const getRunById = async (runId: string): Promise<Run | null> => {
  return getFirst<Run>('SELECT * FROM runs WHERE id = ?', [runId]);
};

// Get recent runs
export const getRecentRuns = async (limit: number = 10): Promise<Run[]> => {
  return getAll<Run>(
    'SELECT * FROM runs ORDER BY date DESC, createdAt DESC LIMIT ?',
    [limit]
  );
};

// Get runs by date range
export const getRunsByDateRange = async (startDate: string, endDate: string): Promise<Run[]> => {
  console.log(`[Calendar] getRunsByDateRange: ${startDate} to ${endDate}`);
  const results = await getAll<Run>(
    'SELECT * FROM runs WHERE date >= ? AND date <= ? ORDER BY date DESC',
    [startDate, endDate]
  );
  console.log(`[Calendar] getRunsByDateRange: returned ${results.length} runs, dates: ${results.map(r => r.date).join(', ')}`);
  return results;
};

// Get runs for a specific month (for calendar)
export const getRunsForMonth = async (year: number, month: number): Promise<Run[]> => {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  console.log(`[Calendar] getRunsForMonth: year=${year}, month=${month}, range=${startDate} to ${endDate}`);
  const runs = await getRunsByDateRange(startDate, endDate);
  console.log(`[Calendar] getRunsForMonth: found ${runs.length} runs for ${year}-${month}`);
  return runs;
};

// Get weekly stats
export const getWeeklyRunStats = async (): Promise<{
  totalDistance: number;
  runCount: number;
  totalDuration: number;
  averagePace: number;
}> => {
  const today = new Date();
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

  const runs = await getRunsByDateRange(
    weekAgo.toISOString().split('T')[0],
    today.toISOString().split('T')[0]
  );

  const totalDistance = runs.reduce((sum, run) => sum + run.distance, 0);
  const totalDuration = runs.reduce((sum, run) => sum + run.duration, 0);
  const averagePace = runs.length > 0 ? totalDuration / 60 / totalDistance : 0;

  return {
    totalDistance,
    runCount: runs.length,
    totalDuration,
    averagePace,
  };
};

// Get monthly stats
export const getMonthlyRunStats = async (): Promise<{
  totalDistance: number;
  runCount: number;
  longestRun: number;
  fastestPace: number;
}> => {
  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  const runs = await getRunsByDateRange(
    firstOfMonth.toISOString().split('T')[0],
    today.toISOString().split('T')[0]
  );

  const totalDistance = runs.reduce((sum, run) => sum + run.distance, 0);
  const longestRun = runs.length > 0 ? Math.max(...runs.map((r) => r.distance)) : 0;
  const fastestPace = runs.length > 0 ? Math.min(...runs.map((r) => r.pace)) : 0;

  return {
    totalDistance,
    runCount: runs.length,
    longestRun,
    fastestPace,
  };
};

// Get lifetime stats
export const getLifetimeRunStats = async (): Promise<{
  totalDistance: number;
  totalRuns: number;
  totalDuration: number;
  longestStreak: number;
}> => {
  const distanceResult = await getFirst<{ total: number }>(
    'SELECT SUM(distance) as total FROM runs'
  );

  const countResult = await getFirst<{ count: number }>(
    'SELECT COUNT(*) as count FROM runs'
  );

  const durationResult = await getFirst<{ total: number }>(
    'SELECT SUM(duration) as total FROM runs'
  );

  const longestStreakResult = await getFirst<{ maxLength: number }>(
    'SELECT MAX(currentLength) as maxLength FROM streaks'
  );

  return {
    totalDistance: distanceResult?.total || 0,
    totalRuns: countResult?.count || 0,
    totalDuration: durationResult?.total || 0,
    longestStreak: longestStreakResult?.maxLength || 0,
  };
};

// Streak management
export const getCurrentStreak = async (): Promise<Streak | null> => {
  return getFirst<Streak>(
    'SELECT * FROM streaks WHERE isActive = 1 ORDER BY startDate DESC LIMIT 1'
  );
};

export const calculateCurrentStreak = async (
  minDistance: number = 0,
  minDuration: number = 0
): Promise<number> => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let streakCount = 0;
  let currentDate = new Date(today);

  while (true) {
    const dateStr = currentDate.toISOString().split('T')[0];

    // Check if there's a qualifying run on this date
    const run = await getFirst<Run>(
      `SELECT * FROM runs
       WHERE date = ?
       AND distance >= ?
       AND duration >= ?
       LIMIT 1`,
      [dateStr, minDistance, minDuration]
    );

    // Check if there's a freeze on this date
    const freeze = await getFirst<any>(
      `SELECT * FROM streak_freezes sf
       JOIN streaks s ON sf.streakId = s.id
       WHERE sf.date = ? AND s.isActive = 1`,
      [dateStr]
    );

    if (run) {
      streakCount++;
    } else if (freeze) {
      // Day is covered by a freeze, continue checking
    } else {
      // No run and no freeze - streak is broken (unless it's today)
      if (currentDate.getTime() === today.getTime()) {
        // Today hasn't ended yet, check yesterday
      } else {
        break;
      }
    }

    // Move to previous day
    currentDate.setDate(currentDate.getDate() - 1);

    // Safety limit
    if (streakCount > 3650) break; // 10 years max
  }

  return streakCount;
};

export const updateStreak = async (runDate: string): Promise<void> => {
  const currentStreak = await getCurrentStreak();

  if (!currentStreak) {
    // Start a new streak
    await runQuery(
      `INSERT INTO streaks (id, startDate, currentLength, isActive, freezesUsed)
       VALUES (?, ?, ?, ?, ?)`,
      [uuidv4(), runDate, 1, 1, 0]
    );
  } else {
    // Calculate the new streak length
    const newLength = await calculateCurrentStreak();

    await runQuery(
      'UPDATE streaks SET currentLength = ?, endDate = NULL WHERE id = ?',
      [newLength, currentStreak.id]
    );
  }
};

export const useStreakFreeze = async (date: string, reason?: string): Promise<boolean> => {
  const currentStreak = await getCurrentStreak();

  if (!currentStreak) return false;

  // Check how many freezes used this month
  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  const freezesThisMonth = await getFirst<{ count: number }>(
    `SELECT COUNT(*) as count FROM streak_freezes
     WHERE streakId = ? AND date >= ?`,
    [currentStreak.id, firstOfMonth.toISOString().split('T')[0]]
  );

  // Default 2 freezes per month
  if ((freezesThisMonth?.count || 0) >= 2) {
    return false;
  }

  await runQuery(
    `INSERT INTO streak_freezes (id, streakId, date, reason)
     VALUES (?, ?, ?, ?)`,
    [uuidv4(), currentStreak.id, date, reason || null]
  );

  await runQuery(
    'UPDATE streaks SET freezesUsed = freezesUsed + 1 WHERE id = ?',
    [currentStreak.id]
  );

  return true;
};

// End current streak
export const endStreak = async (): Promise<void> => {
  const currentStreak = await getCurrentStreak();

  if (currentStreak) {
    const today = new Date().toISOString().split('T')[0];
    await runQuery(
      'UPDATE streaks SET isActive = 0, endDate = ? WHERE id = ?',
      [today, currentStreak.id]
    );
  }
};

// Delete a run
export const deleteRun = async (runId: string): Promise<void> => {
  await runQuery('DELETE FROM runs WHERE id = ?', [runId]);
};

// Format pace for display (mm:ss per mile/km)
export const formatPace = (pace: number): string => {
  const minutes = Math.floor(pace);
  const seconds = Math.round((pace - minutes) * 60);
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

// Format duration for display (HH:MM:SS or MM:SS)
export const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${minutes}:${String(secs).padStart(2, '0')}`;
};
