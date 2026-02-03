import { ProgressionRecommendation, ProgressionAction, ExerciseHistory, ExerciseLibraryItem } from '../types';
import { getExerciseHistory } from './workoutService';

// Progressive overload recommendation algorithm
export const calculateProgressionRecommendation = async (
  exerciseLibraryId: string,
  exerciseName: string,
  isCompound: boolean = true
): Promise<ProgressionRecommendation | null> => {
  const history = await getExerciseHistory(exerciseLibraryId, 5);

  if (history.length < 2) {
    return {
      exerciseId: exerciseLibraryId,
      exerciseName,
      action: 'maintain',
      reason: 'Not enough data yet. Keep training to get personalized recommendations.',
    };
  }

  // Analyze recent performance
  const recentSessions = history.slice(0, 3);
  const avgMaxWeight = recentSessions.reduce((sum, h) => sum + h.maxWeight, 0) / recentSessions.length;
  const avgVolume = recentSessions.reduce((sum, h) => sum + h.totalVolume, 0) / recentSessions.length;
  const avgReps = recentSessions.reduce((sum, h) => sum + h.totalReps, 0) / recentSessions.length;

  // Get the most recent sets to analyze RPE
  const recentSets = recentSessions.flatMap((h) => h.sets);
  const setsWithRPE = recentSets.filter((s) => s.rpe !== null && s.rpe !== undefined);
  const avgRPE = setsWithRPE.length > 0
    ? setsWithRPE.reduce((sum, s) => sum + (s.rpe || 0), 0) / setsWithRPE.length
    : 7; // Default assumption

  // Check for consistency (hit similar numbers for 2+ sessions)
  const isConsistent = checkConsistency(recentSessions);

  // Check for volume trend
  const volumeTrend = calculateVolumeTrend(history);

  // Check for regression
  const isRegressing = volumeTrend < -0.1;

  // Determine recommendation
  let action: ProgressionAction;
  let reason: string;
  let suggestedWeight: number | undefined;
  let suggestedReps: number | undefined;
  let suggestedSets: number | undefined;

  if (isRegressing) {
    // Performance is declining
    if (avgRPE > 8.5) {
      action = 'deload';
      reason = 'Your performance has decreased and fatigue seems high. Consider a deload week with 50-60% of your working weight.';
      suggestedWeight = Math.round(avgMaxWeight * 0.6);
    } else {
      action = 'maintain';
      reason = 'Performance has dipped slightly. Focus on recovery and maintain current weights for another session or two.';
    }
  } else if (isConsistent && avgRPE < 8) {
    // Consistent performance and manageable difficulty
    if (avgRPE < 7) {
      // Weight progression
      action = 'add_weight';
      const increment = isCompound ? 5 : 2.5;
      suggestedWeight = Math.round((avgMaxWeight + increment) * 2) / 2; // Round to nearest 2.5
      reason = `You've been consistent and the weight feels manageable. Try adding ${increment} lbs to your working sets.`;
    } else {
      // Rep progression
      action = 'add_reps';
      suggestedReps = Math.round(avgReps / recentSessions.length) + 1;
      reason = 'Add 1 rep to each set while keeping the weight the same. Once you hit your rep target consistently, increase weight.';
    }
  } else if (isConsistent && avgRPE >= 8 && avgRPE < 9) {
    // Consistent but challenging
    action = 'add_sets';
    suggestedSets = 1;
    reason = 'The weight is challenging but you\'re consistent. Try adding one more set to increase total volume.';
  } else if (avgRPE >= 9) {
    // Very difficult
    action = 'maintain';
    reason = 'Current intensity is high. Focus on maintaining this weight until it feels more manageable (RPE 7-8).';
  } else {
    // Default: need more consistency
    action = 'maintain';
    reason = 'Keep working at current weights to build consistency before progressing.';
  }

  return {
    exerciseId: exerciseLibraryId,
    exerciseName,
    action,
    reason,
    suggestedWeight,
    suggestedReps,
    suggestedSets,
  };
};

// Check if recent sessions show consistent performance
const checkConsistency = (sessions: ExerciseHistory[]): boolean => {
  if (sessions.length < 2) return false;

  const maxWeights = sessions.map((s) => s.maxWeight);
  const avgWeight = maxWeights.reduce((a, b) => a + b, 0) / maxWeights.length;

  // Check if all sessions are within 5% of average
  return maxWeights.every((w) => Math.abs(w - avgWeight) / avgWeight < 0.05);
};

// Calculate volume trend (positive = improving, negative = declining)
const calculateVolumeTrend = (history: ExerciseHistory[]): number => {
  if (history.length < 3) return 0;

  const recentAvg = (history[0].totalVolume + history[1].totalVolume) / 2;
  const olderAvg = (history[history.length - 2].totalVolume + history[history.length - 1].totalVolume) / 2;

  return (recentAvg - olderAvg) / olderAvg;
};

// Calculate estimated 1RM using Brzycki formula
export const calculateEstimated1RM = (weight: number, reps: number): number => {
  if (reps === 1) return weight;
  if (reps > 12) return weight * (1 + reps / 30); // Modified for higher reps
  return weight * (36 / (37 - reps));
};

// Calculate estimated reps at a given weight based on 1RM
export const calculateEstimatedReps = (oneRM: number, weight: number): number => {
  if (weight >= oneRM) return 1;
  return Math.round(37 - (36 * weight) / oneRM);
};

// Get recommended warm-up sets
export const getWarmupRecommendation = (
  workingWeight: number
): { weight: number; reps: number }[] => {
  const warmups: { weight: number; reps: number }[] = [];

  // Empty bar or very light
  if (workingWeight >= 95) {
    warmups.push({ weight: 45, reps: 10 });
  }

  // Progressive warm-up sets
  const percentages = [0.4, 0.6, 0.75, 0.85];

  for (const pct of percentages) {
    const warmupWeight = Math.round((workingWeight * pct) / 5) * 5; // Round to nearest 5
    if (warmupWeight > 45 && warmupWeight < workingWeight) {
      const reps = pct < 0.7 ? 8 : pct < 0.8 ? 5 : 3;
      warmups.push({ weight: warmupWeight, reps });
    }
  }

  return warmups;
};

// Analyze muscle group volume distribution
export const analyzeMuscleGroupVolume = async (
  exercises: { exerciseLibraryId: string; primaryMuscleGroup: string; volume: number }[]
): Promise<Map<string, number>> => {
  const volumeByMuscle = new Map<string, number>();

  for (const exercise of exercises) {
    const current = volumeByMuscle.get(exercise.primaryMuscleGroup) || 0;
    volumeByMuscle.set(exercise.primaryMuscleGroup, current + exercise.volume);
  }

  return volumeByMuscle;
};

// Get training frequency recommendation
export const getFrequencyRecommendation = (
  currentFrequency: number, // sessions per week
  experienceLevel: 'beginner' | 'intermediate' | 'advanced'
): string => {
  const recommendations = {
    beginner: {
      min: 2,
      max: 3,
      message: 'As a beginner, 2-3 full-body sessions per week is optimal for recovery and learning.',
    },
    intermediate: {
      min: 3,
      max: 5,
      message: '3-5 sessions per week allows for good volume distribution across muscle groups.',
    },
    advanced: {
      min: 4,
      max: 6,
      message: 'Higher frequency training (4-6 days) allows for optimal volume and intensity management.',
    },
  };

  const rec = recommendations[experienceLevel];

  if (currentFrequency < rec.min) {
    return `Consider increasing to at least ${rec.min} sessions per week. ${rec.message}`;
  } else if (currentFrequency > rec.max) {
    return `You might be overtraining. Consider reducing to ${rec.max} sessions max. ${rec.message}`;
  } else {
    return `Your current frequency is good! ${rec.message}`;
  }
};
