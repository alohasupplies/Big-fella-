import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { spacing, fontSize, fontWeight, borderRadius } from '../theme/spacing';
import { Card, Button } from '../components/common';
import { RootStackParamList, Workout } from '../types';
import { useSettings } from '../context/SettingsContext';
import { getWorkoutById, calculateWorkoutVolume, deleteWorkout } from '../services/workoutService';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type RouteProps = RouteProp<RootStackParamList, 'WorkoutDetail'>;

const WorkoutDetailScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();
  const { settings } = useSettings();
  const { workoutId } = route.params;

  const [workout, setWorkout] = useState<Workout | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadWorkout();
  }, [workoutId]);

  const loadWorkout = async () => {
    try {
      const data = await getWorkoutById(workoutId);
      setWorkout(data);
    } catch (error) {
      console.error('Failed to load workout:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Workout',
      'Are you sure you want to delete this workout? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteWorkout(workoutId);
            navigation.goBack();
          },
        },
      ]
    );
  };

  const formatVolume = (volume: number): string => {
    if (volume >= 1000) {
      return `${(volume / 1000).toFixed(1)}K`;
    }
    return volume.toLocaleString();
  };

  if (loading || !workout) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  const totalVolume = calculateWorkoutVolume(workout);
  const totalSets = workout.exercises.reduce((sum, e) => sum + e.sets.length, 0);
  const totalReps = workout.exercises.reduce(
    (sum, e) => sum + e.sets.reduce((s, set) => s + set.reps, 0),
    0
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header Stats */}
      <Card variant="elevated" style={styles.headerCard}>
        <Text style={styles.date}>
          {new Date(workout.date).toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </Text>

        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{workout.exercises.length}</Text>
            <Text style={styles.statLabel}>Exercises</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{totalSets}</Text>
            <Text style={styles.statLabel}>Sets</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{totalReps}</Text>
            <Text style={styles.statLabel}>Reps</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{formatVolume(totalVolume)}</Text>
            <Text style={styles.statLabel}>{settings.weightUnit}</Text>
          </View>
        </View>
      </Card>

      {/* Exercises */}
      {workout.exercises.map((exercise) => {
        const exerciseVolume = exercise.sets
          .filter((s) => !s.isWarmup)
          .reduce((sum, s) => sum + s.weight * s.reps, 0);

        return (
          <Card key={exercise.id} variant="outlined" style={styles.exerciseCard}>
            <Text style={styles.exerciseName}>{exercise.exerciseName}</Text>
            <Text style={styles.muscleGroups}>
              {exercise.muscleGroups
                .map((mg) => mg.charAt(0).toUpperCase() + mg.slice(1).replace('_', ' '))
                .join(', ')}
            </Text>

            <View style={styles.setsTable}>
              <View style={styles.setsHeader}>
                <Text style={[styles.setHeaderText, styles.setCol]}>Set</Text>
                <Text style={[styles.setHeaderText, styles.weightCol]}>
                  {settings.weightUnit}
                </Text>
                <Text style={[styles.setHeaderText, styles.repsCol]}>Reps</Text>
                <Text style={[styles.setHeaderText, styles.volumeCol]}>Volume</Text>
              </View>

              {exercise.sets.map((set, index) => (
                <View key={set.id} style={styles.setRow}>
                  <Text style={[styles.setText, styles.setCol]}>
                    {set.isWarmup ? 'W' : index + 1}
                  </Text>
                  <Text style={[styles.setText, styles.weightCol]}>{set.weight}</Text>
                  <Text style={[styles.setText, styles.repsCol]}>{set.reps}</Text>
                  <Text style={[styles.setText, styles.volumeCol]}>
                    {set.weight * set.reps}
                  </Text>
                </View>
              ))}
            </View>

            <View style={styles.exerciseFooter}>
              <Text style={styles.exerciseVolume}>
                Total: {formatVolume(exerciseVolume)} {settings.weightUnit}
              </Text>
            </View>
          </Card>
        );
      })}

      {/* Notes */}
      {workout.notes && (
        <Card variant="outlined" style={styles.notesCard}>
          <Text style={styles.notesLabel}>Notes</Text>
          <Text style={styles.notesText}>{workout.notes}</Text>
        </Card>
      )}

      {/* Delete Button */}
      <Button
        title="Delete Workout"
        onPress={handleDelete}
        variant="outline"
        style={styles.deleteButton}
        textStyle={styles.deleteButtonText}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
  },
  headerCard: {
    marginBottom: spacing.lg,
  },
  date: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  stat: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.accent,
  },
  statLabel: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  exerciseCard: {
    marginBottom: spacing.md,
  },
  exerciseName: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  muscleGroups: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  setsTable: {
    borderTopWidth: 1,
    borderColor: colors.border,
    paddingTop: spacing.sm,
  },
  setsHeader: {
    flexDirection: 'row',
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  setHeaderText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  setRow: {
    flexDirection: 'row',
    paddingVertical: spacing.sm,
  },
  setText: {
    fontSize: fontSize.sm,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  setCol: {
    width: 40,
  },
  weightCol: {
    flex: 1,
  },
  repsCol: {
    flex: 1,
  },
  volumeCol: {
    flex: 1,
  },
  exerciseFooter: {
    borderTopWidth: 1,
    borderColor: colors.border,
    paddingTop: spacing.sm,
    marginTop: spacing.sm,
    alignItems: 'flex-end',
  },
  exerciseVolume: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.textPrimary,
  },
  notesCard: {
    marginBottom: spacing.lg,
  },
  notesLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  notesText: {
    fontSize: fontSize.md,
    color: colors.textPrimary,
    lineHeight: 22,
  },
  deleteButton: {
    marginTop: spacing.lg,
    marginBottom: spacing.xl,
    borderColor: colors.error,
  },
  deleteButtonText: {
    color: colors.error,
  },
});

export default WorkoutDetailScreen;
