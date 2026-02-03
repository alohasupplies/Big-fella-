import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors } from '../theme/colors';
import { spacing, fontSize, fontWeight, borderRadius, touchTarget } from '../theme/spacing';
import { Card, Button, Input } from '../components/common';
import { RootStackParamList, ExerciseLibraryItem, Set, Exercise } from '../types';
import { useSettings } from '../context/SettingsContext';
import { createWorkout, getWorkoutById } from '../services/workoutService';
import { v4 as uuidv4 } from 'uuid';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type RouteProps = RouteProp<RootStackParamList, 'LogWorkout'>;

interface WorkoutExercise {
  id: string;
  exerciseLibraryId: string;
  exerciseName: string;
  muscleGroups: string[];
  sets: SetEntry[];
}

interface SetEntry {
  id: string;
  weight: string;
  reps: string;
  rpe: string;
  isWarmup: boolean;
  completed: boolean;
}

const LogWorkoutScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();
  const { settings } = useSettings();

  const [exercises, setExercises] = useState<WorkoutExercise[]>([]);
  const [notes, setNotes] = useState('');
  const [restTimer, setRestTimer] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isTimerRunning && restTimer > 0) {
      interval = setInterval(() => {
        setRestTimer((prev) => {
          if (prev <= 1) {
            setIsTimerRunning(false);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, restTimer]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      if (route.params?.selectedExercise) {
        const exercise = route.params.selectedExercise;
        const newExercise: WorkoutExercise = {
          id: uuidv4(),
          exerciseLibraryId: exercise.id,
          exerciseName: exercise.name,
          muscleGroups: [exercise.primaryMuscleGroup, ...(exercise.secondaryMuscleGroups || [])],
          sets: [
            {
              id: uuidv4(),
              weight: '',
              reps: '',
              rpe: '',
              isWarmup: false,
              completed: false,
            },
          ],
        };
        setExercises([...exercises, newExercise]);
        // Clear the param after using it
        navigation.setParams({ selectedExercise: undefined } as any);
      }
    });
    return unsubscribe;
  }, [navigation, route.params?.selectedExercise]);

  const removeExercise = (exerciseId: string) => {
    Alert.alert(
      'Remove Exercise',
      'Are you sure you want to remove this exercise?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            setExercises(exercises.filter((e) => e.id !== exerciseId));
          },
        },
      ]
    );
  };

  const addSet = (exerciseId: string) => {
    setExercises(
      exercises.map((e) => {
        if (e.id === exerciseId) {
          const lastSet = e.sets[e.sets.length - 1];
          return {
            ...e,
            sets: [
              ...e.sets,
              {
                id: uuidv4(),
                weight: lastSet?.weight || '',
                reps: lastSet?.reps || '',
                rpe: '',
                isWarmup: false,
                completed: false,
              },
            ],
          };
        }
        return e;
      })
    );
  };

  const removeSet = (exerciseId: string, setId: string) => {
    setExercises(
      exercises.map((e) => {
        if (e.id === exerciseId && e.sets.length > 1) {
          return {
            ...e,
            sets: e.sets.filter((s) => s.id !== setId),
          };
        }
        return e;
      })
    );
  };

  const updateSet = (
    exerciseId: string,
    setId: string,
    field: keyof SetEntry,
    value: string | boolean
  ) => {
    setExercises(
      exercises.map((e) => {
        if (e.id === exerciseId) {
          return {
            ...e,
            sets: e.sets.map((s) => {
              if (s.id === setId) {
                return { ...s, [field]: value };
              }
              return s;
            }),
          };
        }
        return e;
      })
    );
  };

  const completeSet = (exerciseId: string, setId: string) => {
    updateSet(exerciseId, setId, 'completed', true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Start rest timer (default 90 seconds)
    setRestTimer(90);
    setIsTimerRunning(true);
  };

  const formatTimer = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${String(secs).padStart(2, '0')}`;
  };

  const saveWorkout = async () => {
    if (exercises.length === 0) {
      Alert.alert('No Exercises', 'Add at least one exercise to save the workout.');
      return;
    }

    // Check if all sets have weight and reps
    const incompleteSets = exercises.some((e) =>
      e.sets.some((s) => !s.weight || !s.reps)
    );

    if (incompleteSets) {
      Alert.alert(
        'Incomplete Sets',
        'Some sets are missing weight or reps. Save anyway?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Save', onPress: () => performSave() },
        ]
      );
    } else {
      performSave();
    }
  };

  const performSave = async () => {
    setSaving(true);
    try {
      const exercisesToSave: Omit<Exercise, 'id' | 'workoutId'>[] = exercises.map(
        (e, index) => ({
          exerciseLibraryId: e.exerciseLibraryId,
          exerciseName: e.exerciseName,
          muscleGroups: e.muscleGroups as any,
          orderIndex: index,
          sets: e.sets
            .filter((s) => s.weight && s.reps)
            .map((s, setIndex) => ({
              id: uuidv4(),
              exerciseId: '',
              setNumber: setIndex + 1,
              weight: parseFloat(s.weight) || 0,
              reps: parseInt(s.reps) || 0,
              rpe: s.rpe ? parseInt(s.rpe) : undefined,
              isWarmup: s.isWarmup,
              timestamp: new Date().toISOString(),
            })),
        })
      );

      await createWorkout(exercisesToSave, notes || undefined);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      navigation.goBack();
    } catch (error) {
      console.error('Failed to save workout:', error);
      Alert.alert('Error', 'Failed to save workout. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content}>
        {/* Rest Timer */}
        {restTimer > 0 && (
          <Card variant="elevated" style={styles.timerCard}>
            <Text style={styles.timerLabel}>Rest Timer</Text>
            <Text style={styles.timerValue}>{formatTimer(restTimer)}</Text>
            <View style={styles.timerButtons}>
              <TouchableOpacity
                style={styles.timerButton}
                onPress={() => setRestTimer((prev) => prev + 30)}
              >
                <Text style={styles.timerButtonText}>+30s</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.timerButton}
                onPress={() => setIsTimerRunning(!isTimerRunning)}
              >
                <Ionicons
                  name={isTimerRunning ? 'pause' : 'play'}
                  size={24}
                  color={colors.primary}
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.timerButton}
                onPress={() => {
                  setRestTimer(0);
                  setIsTimerRunning(false);
                }}
              >
                <Text style={styles.timerButtonText}>Skip</Text>
              </TouchableOpacity>
            </View>
          </Card>
        )}

        {/* Add Exercise Button */}
        <Button
          title="Add Exercise"
          onPress={() => navigation.navigate('ExerciseSearch', {})}
          variant="outline"
          icon={<Ionicons name="add" size={20} color={colors.primary} />}
          style={styles.addExerciseButton}
        />

        {/* Exercises List */}
        {exercises.map((exercise, exerciseIndex) => (
          <Card key={exercise.id} variant="outlined" style={styles.exerciseCard}>
            <View style={styles.exerciseHeader}>
              <Text style={styles.exerciseName}>{exercise.exerciseName}</Text>
              <TouchableOpacity onPress={() => removeExercise(exercise.id)}>
                <Ionicons name="trash-outline" size={20} color={colors.error} />
              </TouchableOpacity>
            </View>

            {/* Sets Table Header */}
            <View style={styles.setsHeader}>
              <Text style={[styles.setHeaderText, styles.setCol]}>Set</Text>
              <Text style={[styles.setHeaderText, styles.weightCol]}>
                {settings.weightUnit}
              </Text>
              <Text style={[styles.setHeaderText, styles.repsCol]}>Reps</Text>
              <Text style={[styles.setHeaderText, styles.rpeCol]}>RPE</Text>
              <View style={styles.actionCol} />
            </View>

            {/* Sets */}
            {exercise.sets.map((set, setIndex) => (
              <View
                key={set.id}
                style={[styles.setRow, set.completed && styles.completedSetRow]}
              >
                <Text style={[styles.setText, styles.setCol]}>
                  {set.isWarmup ? 'W' : setIndex + 1}
                </Text>
                <TextInput
                  style={[styles.setInput, styles.weightCol]}
                  value={set.weight}
                  onChangeText={(v) => updateSet(exercise.id, set.id, 'weight', v)}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor={colors.textDisabled}
                />
                <TextInput
                  style={[styles.setInput, styles.repsCol]}
                  value={set.reps}
                  onChangeText={(v) => updateSet(exercise.id, set.id, 'reps', v)}
                  keyboardType="number-pad"
                  placeholder="0"
                  placeholderTextColor={colors.textDisabled}
                />
                <TextInput
                  style={[styles.setInput, styles.rpeCol]}
                  value={set.rpe}
                  onChangeText={(v) => updateSet(exercise.id, set.id, 'rpe', v)}
                  keyboardType="number-pad"
                  placeholder="-"
                  placeholderTextColor={colors.textDisabled}
                  maxLength={2}
                />
                <View style={styles.actionCol}>
                  {!set.completed ? (
                    <TouchableOpacity
                      style={styles.completeButton}
                      onPress={() => completeSet(exercise.id, set.id)}
                    >
                      <Ionicons
                        name="checkmark-circle-outline"
                        size={28}
                        color={colors.success}
                      />
                    </TouchableOpacity>
                  ) : (
                    <Ionicons
                      name="checkmark-circle"
                      size={28}
                      color={colors.success}
                    />
                  )}
                </View>
              </View>
            ))}

            {/* Add Set Button */}
            <TouchableOpacity
              style={styles.addSetButton}
              onPress={() => addSet(exercise.id)}
            >
              <Ionicons name="add" size={20} color={colors.primary} />
              <Text style={styles.addSetText}>Add Set</Text>
            </TouchableOpacity>
          </Card>
        ))}

        {/* Notes */}
        {exercises.length > 0 && (
          <Card variant="outlined" style={styles.notesCard}>
            <Text style={styles.notesLabel}>Workout Notes</Text>
            <TextInput
              style={styles.notesInput}
              value={notes}
              onChangeText={setNotes}
              placeholder="How did the workout feel? Any form cues?"
              placeholderTextColor={colors.textDisabled}
              multiline
              numberOfLines={3}
            />
          </Card>
        )}

        {/* Empty State */}
        {exercises.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="barbell-outline" size={64} color={colors.textDisabled} />
            <Text style={styles.emptyText}>No exercises added yet</Text>
            <Text style={styles.emptySubtext}>
              Tap "Add Exercise" to start your workout
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Save Button */}
      {exercises.length > 0 && (
        <View style={styles.footer}>
          <Button
            title="Save Workout"
            onPress={saveWorkout}
            loading={saving}
            size="large"
          />
        </View>
      )}
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
    paddingBottom: 100,
  },
  timerCard: {
    alignItems: 'center',
    marginBottom: spacing.md,
    backgroundColor: colors.primaryLight,
  },
  timerLabel: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  timerValue: {
    fontSize: fontSize.hero,
    fontWeight: fontWeight.bold,
    color: colors.primary,
    marginVertical: spacing.sm,
  },
  timerButtons: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  timerButton: {
    padding: spacing.sm,
  },
  timerButtonText: {
    fontSize: fontSize.sm,
    color: colors.primary,
    fontWeight: fontWeight.medium,
  },
  addExerciseButton: {
    marginBottom: spacing.md,
  },
  exerciseCard: {
    marginBottom: spacing.md,
  },
  exerciseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  exerciseName: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
    flex: 1,
  },
  setsHeader: {
    flexDirection: 'row',
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  setHeaderText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  setCol: {
    width: 40,
  },
  weightCol: {
    flex: 1,
    marginHorizontal: spacing.xs,
  },
  repsCol: {
    flex: 1,
    marginHorizontal: spacing.xs,
  },
  rpeCol: {
    width: 50,
  },
  actionCol: {
    width: 40,
    alignItems: 'center',
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
  },
  completedSetRow: {
    backgroundColor: colors.successLight,
  },
  setText: {
    fontSize: fontSize.md,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  setInput: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    fontSize: fontSize.md,
    color: colors.textPrimary,
    textAlign: 'center',
    minHeight: touchTarget.min,
  },
  completeButton: {
    padding: spacing.xs,
  },
  addSetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  addSetText: {
    fontSize: fontSize.sm,
    color: colors.primary,
    fontWeight: fontWeight.medium,
  },
  notesCard: {
    marginTop: spacing.md,
  },
  notesLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  notesInput: {
    fontSize: fontSize.md,
    color: colors.textPrimary,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  emptyText: {
    fontSize: fontSize.lg,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
  emptySubtext: {
    fontSize: fontSize.sm,
    color: colors.textDisabled,
    marginTop: spacing.xs,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
});

export default LogWorkoutScreen;
