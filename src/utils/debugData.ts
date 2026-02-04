import { executeSql, getDatabase } from '../database/database';
import { v4 as uuidv4 } from 'uuid';

export const seedDebugData = async (): Promise<void> => {
  const database = getDatabase();
  
  try {
    console.log('Starting debug data seeding...');
    
    // Clear existing data (except exercise library and settings)
    await executeSql(database, 'DELETE FROM sets', []);
    await executeSql(database, 'DELETE FROM exercises', []);
    await executeSql(database, 'DELETE FROM workouts', []);
    await executeSql(database, 'DELETE FROM runs', []);
    await executeSql(database, 'DELETE FROM streaks', []);
    await executeSql(database, 'DELETE FROM personal_records', []);
    await executeSql(database, 'DELETE FROM favorite_exercises', []);
    
    console.log('Cleared existing data');
    
    // Get some exercise IDs from the library
    const benchPress = await executeSql(database, "SELECT id FROM exercise_library WHERE name = 'Bench Press'", []);
    const squat = await executeSql(database, "SELECT id FROM exercise_library WHERE name = 'Barbell Back Squat'", []);
    const deadlift = await executeSql(database, "SELECT id FROM exercise_library WHERE name = 'Conventional Deadlift'", []);
    const overheadPress = await executeSql(database, "SELECT id FROM exercise_library WHERE name = 'Overhead Press'", []);
    const barbellRow = await executeSql(database, "SELECT id FROM exercise_library WHERE name = 'Barbell Row'", []);
    
    const benchPressId = benchPress.rows.item(0)?.id;
    const squatId = squat.rows.item(0)?.id;
    const deadliftId = deadlift.rows.item(0)?.id;
    const overheadPressId = overheadPress.rows.item(0)?.id;
    const barbellRowId = barbellRow.rows.item(0)?.id;
    
    // Add favorite exercises
    if (benchPressId) {
      await executeSql(database, 'INSERT INTO favorite_exercises (id, exerciseLibraryId, createdAt) VALUES (?, ?, ?)', 
        [uuidv4(), benchPressId, new Date().toISOString()]);
    }
    if (squatId) {
      await executeSql(database, 'INSERT INTO favorite_exercises (id, exerciseLibraryId, createdAt) VALUES (?, ?, ?)', 
        [uuidv4(), squatId, new Date().toISOString()]);
    }
    if (deadliftId) {
      await executeSql(database, 'INSERT INTO favorite_exercises (id, exerciseLibraryId, createdAt) VALUES (?, ?, ?)', 
        [uuidv4(), deadliftId, new Date().toISOString()]);
    }
    
    console.log('Added favorite exercises');
    
    // Create workouts over the past 30 days
    const today = new Date();
    const workoutDates = [];
    
    // Create 12 workouts over the past month
    for (let i = 0; i < 12; i++) {
      const daysAgo = Math.floor(Math.random() * 30);
      const workoutDate = new Date(today);
      workoutDate.setDate(workoutDate.getDate() - daysAgo);
      workoutDates.push(workoutDate);
    }
    
    // Sort by date
    workoutDates.sort((a, b) => a.getTime() - b.getTime());
    
    for (let i = 0; i < workoutDates.length; i++) {
      const workoutId = uuidv4();
      const workoutDate = workoutDates[i];
      const workoutType = i % 3; // Rotate between workout types
      
      // Create workout
      const createdAt = workoutDate.toISOString();
      const updatedAt = workoutDate.toISOString();
      await executeSql(database, 
        'INSERT INTO workouts (id, date, notes, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)',
        [workoutId, workoutDate.toISOString(), `Debug workout ${i + 1}`, createdAt, updatedAt]
      );
      
      // Add exercises based on workout type
      if (workoutType === 0 && benchPressId && barbellRowId) {
        // Push day
        const benchExerciseId = uuidv4();
        await executeSql(database,
          'INSERT INTO exercises (id, workoutId, exerciseLibraryId, exerciseName, muscleGroups, orderIndex) VALUES (?, ?, ?, ?, ?, ?)',
          [benchExerciseId, workoutId, benchPressId, 'Bench Press', 'chest,triceps,shoulders', 0]
        );
        
        // Add sets for bench press
        const benchWeight = 185 + (i * 5); // Progressive overload
        for (let setNum = 0; setNum < 4; setNum++) {
          const reps = 8 - setNum;
          await executeSql(database,
            'INSERT INTO sets (id, exerciseId, setNumber, weight, reps, rpe, isWarmup, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [uuidv4(), benchExerciseId, setNum + 1, benchWeight, reps, 8, 0, workoutDate.toISOString()]
          );
        }
        
        // Add barbell row
        const rowExerciseId = uuidv4();
        await executeSql(database,
          'INSERT INTO exercises (id, workoutId, exerciseLibraryId, exerciseName, muscleGroups, orderIndex) VALUES (?, ?, ?, ?, ?, ?)',
          [rowExerciseId, workoutId, barbellRowId, 'Barbell Row', 'back,biceps', 1]
        );
        
        const rowWeight = 155 + (i * 5);
        for (let setNum = 0; setNum < 4; setNum++) {
          const reps = 10 - setNum;
          await executeSql(database,
            'INSERT INTO sets (id, exerciseId, setNumber, weight, reps, rpe, isWarmup, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [uuidv4(), rowExerciseId, setNum + 1, rowWeight, reps, 7, 0, workoutDate.toISOString()]
          );
        }
      } else if (workoutType === 1 && squatId) {
        // Leg day
        const squatExerciseId = uuidv4();
        await executeSql(database,
          'INSERT INTO exercises (id, workoutId, exerciseLibraryId, exerciseName, muscleGroups, orderIndex) VALUES (?, ?, ?, ?, ?, ?)',
          [squatExerciseId, workoutId, squatId, 'Barbell Back Squat', 'quadriceps,glutes,hamstrings', 0]
        );
        
        const squatWeight = 225 + (i * 10);
        for (let setNum = 0; setNum < 5; setNum++) {
          const reps = 6 - Math.floor(setNum / 2);
          await executeSql(database,
            'INSERT INTO sets (id, exerciseId, setNumber, weight, reps, rpe, isWarmup, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [uuidv4(), squatExerciseId, setNum + 1, squatWeight, reps, 8, 0, workoutDate.toISOString()]
          );
        }
      } else if (workoutType === 2 && deadliftId && overheadPressId) {
        // Pull/Press day
        const deadliftExerciseId = uuidv4();
        await executeSql(database,
          'INSERT INTO exercises (id, workoutId, exerciseLibraryId, exerciseName, muscleGroups, orderIndex) VALUES (?, ?, ?, ?, ?, ?)',
          [deadliftExerciseId, workoutId, deadliftId, 'Conventional Deadlift', 'back,glutes,hamstrings', 0]
        );
        
        const deadliftWeight = 275 + (i * 10);
        for (let setNum = 0; setNum < 3; setNum++) {
          const reps = 5;
          await executeSql(database,
            'INSERT INTO sets (id, exerciseId, setNumber, weight, reps, rpe, isWarmup, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [uuidv4(), deadliftExerciseId, setNum + 1, deadliftWeight, reps, 9, 0, workoutDate.toISOString()]
          );
        }
        
        // Add overhead press
        const ohpExerciseId = uuidv4();
        await executeSql(database,
          'INSERT INTO exercises (id, workoutId, exerciseLibraryId, exerciseName, muscleGroups, orderIndex) VALUES (?, ?, ?, ?, ?, ?)',
          [ohpExerciseId, workoutId, overheadPressId, 'Overhead Press', 'shoulders,triceps', 1]
        );
        
        const ohpWeight = 115 + (i * 5);
        for (let setNum = 0; setNum < 4; setNum++) {
          const reps = 8 - setNum;
          await executeSql(database,
            'INSERT INTO sets (id, exerciseId, setNumber, weight, reps, rpe, isWarmup, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [uuidv4(), ohpExerciseId, setNum + 1, ohpWeight, reps, 7, 0, workoutDate.toISOString()]
          );
        }
      }
    }
    
    console.log('Created debug workouts');
    
    // Create runs over the past 30 days
    for (let i = 0; i < 15; i++) {
      const runId = uuidv4();
      const daysAgo = Math.floor(Math.random() * 30);
      const runDate = new Date(today);
      runDate.setDate(runDate.getDate() - daysAgo);
      
      const distance = 3 + Math.random() * 7; // 3-10 miles
      const minutes = Math.floor(distance * 8) + Math.floor(Math.random() * 10); // ~8-10 min/mile pace
      const seconds = Math.floor(Math.random() * 60);
      
      const duration = minutes * 60 + seconds; // Total duration in seconds
      const pace = duration / distance; // Pace in seconds per mile
      const createdAt = runDate.toISOString();
      const updatedAt = runDate.toISOString();
      
      await executeSql(database,
        'INSERT INTO runs (id, date, distance, duration, pace, runType, notes, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [runId, runDate.toISOString(), distance, duration, pace, 'easy', `Debug run ${i + 1}`, createdAt, updatedAt]
      );
    }
    
    console.log('Created debug runs');
    
    // Create a current streak
    const streakId = uuidv4();
    const streakStartDate = new Date(today);
    streakStartDate.setDate(streakStartDate.getDate() - 7); // 7-day streak
    
    await executeSql(database,
      'INSERT INTO streaks (id, startDate, endDate, currentLength, isActive, freezesUsed) VALUES (?, ?, ?, ?, ?, ?)',
      [streakId, streakStartDate.toISOString(), today.toISOString(), 7, 1, 0]
    );
    
    console.log('Created debug streak');
    
    // Add some personal records
    if (benchPressId) {
      await executeSql(database,
        'INSERT INTO personal_records (id, exerciseLibraryId, recordType, value, weight, reps, date, workoutId) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [uuidv4(), benchPressId, 'max_weight', 225, 225, 5, today.toISOString(), null]
      );
    }
    
    if (squatId) {
      await executeSql(database,
        'INSERT INTO personal_records (id, exerciseLibraryId, recordType, value, weight, reps, date, workoutId) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [uuidv4(), squatId, 'max_weight', 315, 315, 3, today.toISOString(), null]
      );
    }
    
    if (deadliftId) {
      await executeSql(database,
        'INSERT INTO personal_records (id, exerciseLibraryId, recordType, value, weight, reps, date, workoutId) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [uuidv4(), deadliftId, 'max_weight', 405, 405, 1, today.toISOString(), null]
      );
    }
    
    console.log('Created debug personal records');
    console.log('Debug data seeding completed successfully!');
    
  } catch (error) {
    console.error('Error seeding debug data:', error);
    throw error;
  }
};

export const clearAllData = async (): Promise<void> => {
  const database = getDatabase();
  
  try {
    console.log('Clearing all user data...');
    
    await executeSql(database, 'DELETE FROM sets', []);
    await executeSql(database, 'DELETE FROM exercises', []);
    await executeSql(database, 'DELETE FROM workouts', []);
    await executeSql(database, 'DELETE FROM runs', []);
    await executeSql(database, 'DELETE FROM streaks', []);
    await executeSql(database, 'DELETE FROM personal_records', []);
    await executeSql(database, 'DELETE FROM favorite_exercises', []);
    
    console.log('All user data cleared successfully!');
  } catch (error) {
    console.error('Error clearing data:', error);
    throw error;
  }
};
