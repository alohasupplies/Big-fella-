import * as SQLite from 'expo-sqlite';

let db: SQLite.WebSQLDatabase | null = null;

export const getDatabase = (): SQLite.WebSQLDatabase => {
  if (!db) {
    db = SQLite.openDatabase('bigfella.db');
  }
  return db;
};

const executeSqlBatch = (database: SQLite.WebSQLDatabase, sqlStatements: string[]): Promise<void> => {
  return new Promise((resolve, reject) => {
    database.transaction(
      tx => {
        sqlStatements.forEach(sql => {
          tx.executeSql(sql);
        });
      },
      error => reject(error),
      () => resolve()
    );
  });
};

export const executeSql = (database: SQLite.WebSQLDatabase, sql: string, params: any[] = []): Promise<any> => {
  return new Promise((resolve, reject) => {
    database.transaction(
      tx => {
        tx.executeSql(
          sql,
          params,
          (_, result) => resolve(result),
          (_, error) => {
            reject(error);
            return false;
          }
        );
      },
      error => reject(error)
    );
  });
};

export const initDatabase = async (): Promise<void> => {
  const database = getDatabase();

  // Create tables - split into individual statements
  const createTableStatements = [
    `CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS exercise_library (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      alternativeNames TEXT,
      primaryMuscleGroup TEXT NOT NULL,
      secondaryMuscleGroups TEXT,
      equipment TEXT NOT NULL,
      category TEXT NOT NULL,
      tags TEXT,
      videoUrl TEXT,
      isCustom INTEGER DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS workouts (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      duration INTEGER,
      notes TEXT,
      tags TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS exercises (
      id TEXT PRIMARY KEY,
      workoutId TEXT NOT NULL,
      exerciseLibraryId TEXT NOT NULL,
      exerciseName TEXT NOT NULL,
      muscleGroups TEXT NOT NULL,
      orderIndex INTEGER NOT NULL,
      notes TEXT,
      FOREIGN KEY (workoutId) REFERENCES workouts(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS sets (
      id TEXT PRIMARY KEY,
      exerciseId TEXT NOT NULL,
      setNumber INTEGER NOT NULL,
      weight REAL NOT NULL,
      reps INTEGER NOT NULL,
      rpe INTEGER,
      isWarmup INTEGER DEFAULT 0,
      notes TEXT,
      timestamp TEXT NOT NULL,
      FOREIGN KEY (exerciseId) REFERENCES exercises(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS runs (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      distance REAL NOT NULL,
      duration INTEGER NOT NULL,
      pace REAL NOT NULL,
      routeName TEXT,
      runType TEXT NOT NULL,
      weather TEXT,
      notes TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS streaks (
      id TEXT PRIMARY KEY,
      startDate TEXT NOT NULL,
      endDate TEXT,
      currentLength INTEGER NOT NULL,
      isActive INTEGER NOT NULL,
      freezesUsed INTEGER DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS streak_freezes (
      id TEXT PRIMARY KEY,
      streakId TEXT NOT NULL,
      date TEXT NOT NULL,
      reason TEXT,
      FOREIGN KEY (streakId) REFERENCES streaks(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS personal_records (
      id TEXT PRIMARY KEY,
      exerciseLibraryId TEXT NOT NULL,
      recordType TEXT NOT NULL,
      value REAL NOT NULL,
      weight REAL,
      reps INTEGER,
      date TEXT NOT NULL,
      workoutId TEXT,
      setId TEXT,
      FOREIGN KEY (workoutId) REFERENCES workouts(id) ON DELETE SET NULL
    )`,
    `CREATE TABLE IF NOT EXISTS favorite_exercises (
      id TEXT PRIMARY KEY,
      exerciseLibraryId TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (exerciseLibraryId) REFERENCES exercise_library(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS challenges (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      type TEXT NOT NULL,
      targetValue REAL NOT NULL,
      currentValue REAL DEFAULT 0,
      unit TEXT NOT NULL,
      startDate TEXT NOT NULL,
      endDate TEXT NOT NULL,
      isCompleted INTEGER DEFAULT 0,
      isActive INTEGER DEFAULT 1,
      createdAt TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS badges (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      category TEXT NOT NULL,
      iconName TEXT NOT NULL,
      earnedDate TEXT,
      isEarned INTEGER DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS synced_health_runs (
      id TEXT PRIMARY KEY,
      healthKitId TEXT NOT NULL UNIQUE,
      runId TEXT NOT NULL,
      syncedAt TEXT NOT NULL,
      FOREIGN KEY (runId) REFERENCES runs(id) ON DELETE CASCADE
    )`,
    `CREATE INDEX IF NOT EXISTS idx_workouts_date ON workouts(date)`,
    `CREATE INDEX IF NOT EXISTS idx_exercises_workout ON exercises(workoutId)`,
    `CREATE INDEX IF NOT EXISTS idx_sets_exercise ON sets(exerciseId)`,
    `CREATE INDEX IF NOT EXISTS idx_runs_date ON runs(date)`,
    `CREATE INDEX IF NOT EXISTS idx_personal_records_exercise ON personal_records(exerciseLibraryId)`,
    `CREATE INDEX IF NOT EXISTS idx_synced_health_runs_hkid ON synced_health_runs(healthKitId)`,
    `CREATE TABLE IF NOT EXISTS workout_templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS template_exercises (
      id TEXT PRIMARY KEY,
      templateId TEXT NOT NULL,
      exerciseLibraryId TEXT NOT NULL,
      exerciseName TEXT NOT NULL,
      muscleGroups TEXT NOT NULL,
      orderIndex INTEGER NOT NULL,
      defaultSets INTEGER DEFAULT 3,
      defaultReps INTEGER,
      defaultWeight REAL,
      FOREIGN KEY (templateId) REFERENCES workout_templates(id) ON DELETE CASCADE
    )`,
    `CREATE INDEX IF NOT EXISTS idx_template_exercises_template ON template_exercises(templateId)`
  ];

  await executeSqlBatch(database, createTableStatements);

  // Initialize default settings if not exists
  await initializeDefaultSettings(database);

  // Initialize exercise library if empty
  await initializeExerciseLibrary(database);

  // Initialize badges if empty
  await initializeBadges(database);
};

const initializeDefaultSettings = async (database: SQLite.WebSQLDatabase) => {
  const defaultSettings = [
    { key: 'weightUnit', value: 'lbs' },
    { key: 'distanceUnit', value: 'miles' },
    { key: 'streakMinDistance', value: '0' },
    { key: 'streakMinDuration', value: '0' },
    { key: 'streakGracePeriod', value: '2' },
    { key: 'runReminderEnabled', value: 'true' },
    { key: 'runReminderTime', value: '20:00' },
    { key: 'workoutReminderEnabled', value: 'false' },
    { key: 'darkMode', value: 'system' },
    { key: 'monthlyFreezes', value: '2' },
    { key: 'healthSyncEnabled', value: 'false' },
  ];

  for (const setting of defaultSettings) {
    await executeSql(
      database,
      'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)',
      [setting.key, setting.value]
    );
  }
};

const initializeExerciseLibrary = async (database: SQLite.WebSQLDatabase) => {
  const result = await executeSql(
    database,
    'SELECT COUNT(*) as count FROM exercise_library'
  );

  const count = result.rows.item(0).count;

  if (count === 0) {
    // Import exercises from the exercise data file
    const { exerciseLibrary } = require('../data/exerciseLibrary');

    for (const exercise of exerciseLibrary) {
      await executeSql(
        database,
        `INSERT INTO exercise_library (id, name, alternativeNames, primaryMuscleGroup,
         secondaryMuscleGroups, equipment, category, tags, videoUrl, isCustom)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          exercise.id,
          exercise.name,
          exercise.alternativeNames?.join(',') || null,
          exercise.primaryMuscleGroup,
          exercise.secondaryMuscleGroups?.join(',') || null,
          exercise.equipment,
          exercise.category,
          exercise.tags?.join(',') || null,
          exercise.videoUrl || null,
          0,
        ]
      );
    }
  }
};

const initializeBadges = async (database: SQLite.WebSQLDatabase) => {
  const result = await executeSql(
    database,
    'SELECT COUNT(*) as count FROM badges'
  );

  const count = result.rows.item(0).count;

  if (count === 0) {
    const { badges } = require('../data/badges');

    for (const badge of badges) {
      await executeSql(
        database,
        `INSERT INTO badges (id, name, description, category, iconName, isEarned)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [badge.id, badge.name, badge.description, badge.category, badge.iconName, 0]
      );
    }
  }
};

// Generic query helper functions
export const runQuery = async (sql: string, params: any[] = []) => {
  const database = getDatabase();
  return executeSql(database, sql, params);
};

export const getAll = async <T>(sql: string, params: any[] = []): Promise<T[]> => {
  const database = getDatabase();
  const result = await executeSql(database, sql, params);
  const items: T[] = [];
  for (let i = 0; i < result.rows.length; i++) {
    items.push(result.rows.item(i));
  }
  return items;
};

export const getFirst = async <T>(sql: string, params: any[] = []): Promise<T | null> => {
  const database = getDatabase();
  const result = await executeSql(database, sql, params);
  return result.rows.length > 0 ? result.rows.item(0) : null;
};

// Favorite Exercises Functions
export const addFavoriteExercise = async (exerciseLibraryId: string): Promise<void> => {
  const database = getDatabase();
  const { v4: uuidv4 } = require('uuid');
  const id = uuidv4();
  const createdAt = new Date().toISOString();
  
  await executeSql(
    database,
    `INSERT INTO favorite_exercises (id, exerciseLibraryId, createdAt) VALUES (?, ?, ?)`,
    [id, exerciseLibraryId, createdAt]
  );
};

export const removeFavoriteExercise = async (exerciseLibraryId: string): Promise<void> => {
  const database = getDatabase();
  await executeSql(
    database,
    `DELETE FROM favorite_exercises WHERE exerciseLibraryId = ?`,
    [exerciseLibraryId]
  );
};

export const isFavoriteExercise = async (exerciseLibraryId: string): Promise<boolean> => {
  const database = getDatabase();
  const result = await executeSql(
    database,
    `SELECT COUNT(*) as count FROM favorite_exercises WHERE exerciseLibraryId = ?`,
    [exerciseLibraryId]
  );
  return result.rows.item(0).count > 0;
};

export const getFavoriteExercises = async (): Promise<any[]> => {
  const database = getDatabase();
  const result = await executeSql(
    database,
    `SELECT el.* FROM exercise_library el
     INNER JOIN favorite_exercises fe ON el.id = fe.exerciseLibraryId
     ORDER BY fe.createdAt DESC`,
    []
  );
  const items: any[] = [];
  for (let i = 0; i < result.rows.length; i++) {
    items.push(result.rows.item(i));
  }
  return items;
};
