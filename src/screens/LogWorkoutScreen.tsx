import React, { useState, useEffect, useRef } from 'react';
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
  ActivityIndicator,
  AppState,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import { spacing, fontSize, fontWeight, borderRadius, touchTarget } from '../theme/spacing';
import { Card, Button } from '../components/common';
import { RootStackParamList, Exercise, MuscleGroup } from '../types';
import { useSettings } from '../context/SettingsContext';
import { createWorkout } from '../services/workoutService';
import { createTemplate, getTemplateById } from '../services/templateService';
import { clearWorkoutDraft, readWorkoutDraft, saveWorkoutDraft, WorkoutDraft, DraftExercise, DraftSet } from '../services/workoutDraftService';
import { v4 as uuidv4 } from 'uuid';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type RouteProps = RouteProp<RootStackParamList, 'LogWorkout'>;

type WorkoutExercise = DraftExercise;
type SetEntry = DraftSet;

const LogWorkoutScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();
  const { settings } = useSettings();
  const insets = useSafeAreaInsets();

  const [draft, setDraft] = useState<WorkoutDraft>({ exercises: [], notes: '', weightUnit: settings.weightUnit });
  const draftRef = useRef(draft);
  const mounted = useRef(true);
  const savingRef = useRef(false);
  const finished = useRef(false);
  const revision = useRef(0);
  const scrollView = useRef<ScrollView>(null);
  const scrollToAddedExercise = useRef(false);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [draftStatus, setDraftStatus] = useState<'saved' | 'saving' | 'error'>('saved');
  const { exercises, notes } = draft;
  const [restTimer, setRestTimer] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [saving, setSaving] = useState(false);

  const persist = (next: WorkoutDraft) => {
    const currentRevision = ++revision.current;
    setDraftStatus('saving');
    return saveWorkoutDraft(next).then(() => {
      if (mounted.current && currentRevision === revision.current) setDraftStatus('saved');
    }).catch((error) => {
      console.error('Failed to save workout draft:', error);
      if (mounted.current && currentRevision === revision.current) setDraftStatus('error');
      throw error;
    });
  };
  const updateDraft = (next: WorkoutDraft) => {
    if (savingRef.current || finished.current) return;
    draftRef.current = next;
    setDraft(next);
    // Start storage immediately, without waiting for a debounce or unmount.
    void persist(next).catch(() => undefined);
  };
  const setExercises = (next: WorkoutExercise[] | ((previous: WorkoutExercise[]) => WorkoutExercise[])) => {
    updateDraft({ ...draftRef.current, exercises: typeof next === 'function' ? next(draftRef.current.exercises) : next });
  };
  const setNotes = (next: string) => updateDraft({ ...draftRef.current, notes: next });

  useEffect(() => {
    mounted.current = true;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active' && !finished.current && draftRef.current.exercises.length > 0) {
        void persist(draftRef.current).catch(() => undefined);
      }
    });
    return () => { mounted.current = false; subscription.remove(); };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const initialize = async () => {
      try {
        const restored = await readWorkoutDraft();
        let next = restored;
        if (!next && route.params?.templateId) {
          const template = await getTemplateById(route.params.templateId);
          if (template) next = {
            notes: '', weightUnit: settings.weightUnit,
            exercises: template.exercises.map((te) => ({
              id: uuidv4(), exerciseLibraryId: te.exerciseLibraryId,
              exerciseName: te.exerciseName, muscleGroups: te.muscleGroups,
              sets: Array.from({ length: te.defaultSets }, () => ({
                id: uuidv4(), weight: te.defaultWeight?.toString() || '',
                reps: te.defaultReps?.toString() || '', rpe: '', isWarmup: false, completed: false,
              })),
            })),
          };
        }
        if (cancelled) return;
        if (next) {
          draftRef.current = next;
          setDraft(next);
          if (!restored) await persist(next);
        }
        if (cancelled) return;
        navigation.setParams({ templateId: undefined });
        setLoadError(false);
        setReady(true);
        if (restored && route.params?.templateId) {
          Alert.alert('Workout resumed', 'Your unfinished workout has been restored. Save or discard this draft before starting a new template.');
        }
      } catch (error) {
        console.error('Failed to restore workout draft:', error);
        if (!cancelled) setLoadError(true);
      }
    };
    void initialize();
    return () => { cancelled = true; };
  }, [loadAttempt]);

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
      if (ready && route.params?.selectedExercises && route.params.selectedExercises.length > 0) {
        const newExercises: WorkoutExercise[] = route.params.selectedExercises.map((exercise) => ({
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
        }));
        setExercises((prev) => [...prev, ...newExercises]);
        scrollToAddedExercise.current = true;
        navigation.setParams({ selectedExercises: undefined });
      }
  }, [ready, navigation, route.params?.selectedExercises]);

  const discardDraft = () => Alert.alert('Discard workout draft?', 'This will remove the exercises, sets, and notes in this unfinished workout.', [
    { text: 'Keep draft', style: 'cancel' },
    { text: 'Discard', style: 'destructive', onPress: async () => {
      if (savingRef.current || finished.current) return;
      savingRef.current = true;
      setSaving(true);
      try {
        await clearWorkoutDraft();
        finished.current = true;
        navigation.goBack();
      } catch {
        Alert.alert('Could not discard draft', 'Your workout has been kept. Please try again.');
        savingRef.current = false;
        setSaving(false);
      }
    } },
  ]);

  const saveAsTemplate = () => {
    if (exercises.length === 0) {
      Alert.alert('No Exercises', 'Add at least one exercise before saving a template.');
      return;
    }
    Alert.prompt(
      'Save as Template',
      'Give this workout template a name:',
      async (name) => {
        if (!name?.trim()) return;
        await createTemplate(
          name.trim(),
          exercises.map((e) => ({
            exerciseLibraryId: e.exerciseLibraryId,
            exerciseName: e.exerciseName,
            muscleGroups: e.muscleGroups as MuscleGroup[],
            defaultSets: e.sets.length,
          }))
        );
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Saved', `Template "${name.trim()}" has been saved.`);
      },
      'plain-text'
    );
  };

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
    setRestTimer(settings.restTimerDefault);
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
    if (savingRef.current || finished.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      await persist(draftRef.current);
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
              weight: (parseFloat(s.weight) || 0) * (draft.weightUnit === settings.weightUnit ? 1 : draft.weightUnit === 'lbs' ? 0.45359237 : 1 / 0.45359237),
              reps: parseInt(s.reps) || 0,
              rpe: s.rpe ? parseInt(s.rpe) : undefined,
              isWarmup: s.isWarmup,
              timestamp: new Date().toISOString(),
            })),
        })
      );

      await createWorkout(exercisesToSave, notes || undefined);
      finished.current = true;
      await clearWorkoutDraft();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      navigation.goBack();
    } catch (error) {
      console.error('Failed to save workout:', error);
      if (finished.current) {
        Alert.alert('Workout saved', 'Your workout was saved, but the draft could not be cleared. You can discard the draft when you reopen it.');
        navigation.goBack();
      } else Alert.alert('Error', 'Failed to save workout. Your draft has been kept. Please try again.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  if (!ready) return <View style={styles.loading}>
    {loadError ? <>
      <Text style={styles.emptyText}>Could not restore your workout draft</Text>
      <Button title="Try again" onPress={() => { setLoadError(false); setLoadAttempt((value) => value + 1); }} />
    </> : <ActivityIndicator color={colors.primary} />}
  </View>;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView ref={scrollView} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => {
          if (scrollToAddedExercise.current) {
            scrollToAddedExercise.current = false;
            scrollView.current?.scrollToEnd({ animated: true });
          }
        }}>
        {exercises.length > 0 && <View style={styles.draftNotice}>
          <TouchableOpacity disabled={saving} onPress={() => { void persist(draftRef.current).catch(() => undefined); }} style={{ flex: 1 }}>
            <Text style={styles.draftText}>{draftStatus === 'error' ? 'Draft not saved — tap to retry' : draftStatus === 'saving' ? 'Saving draft…' : 'Draft saved · Reopen to continue'}</Text>
          </TouchableOpacity>
          <TouchableOpacity disabled={saving} onPress={discardDraft}><Text style={styles.discardText}>Discard</Text></TouchableOpacity>
        </View>}
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
          disabled={saving}
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
                {draft.weightUnit}
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
                  editable={!saving}
                  onChangeText={(v) => updateSet(exercise.id, set.id, 'weight', v)}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor={colors.textDisabled}
                />
                <TextInput
                  style={[styles.setInput, styles.repsCol]}
                  value={set.reps}
                  editable={!saving}
                  onChangeText={(v) => updateSet(exercise.id, set.id, 'reps', v)}
                  keyboardType="number-pad"
                  placeholder="0"
                  placeholderTextColor={colors.textDisabled}
                />
                <TextInput
                  style={[styles.setInput, styles.rpeCol]}
                  value={set.rpe}
                  editable={!saving}
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
              editable={!saving}
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

      {/* Footer Buttons */}
      {exercises.length > 0 && (
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
          <View style={styles.footerActions}>
            <Button
              title="Add Exercise"
              onPress={() => navigation.navigate('ExerciseSearch', {})}
              disabled={saving}
              variant="outline"
              size="small"
              style={{ flex: 1 }}
              icon={<Ionicons name="add" size={20} color={colors.primary} />}
            />
            <TouchableOpacity disabled={saving} style={styles.saveTemplateButton} onPress={saveAsTemplate}>
              <Ionicons name="bookmark-outline" size={20} color={colors.primary} />
              <Text style={styles.saveTemplateText}>Save as Template</Text>
            </TouchableOpacity>
          </View>
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
  loading: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  draftNotice: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
  draftText: { color: colors.textSecondary, fontSize: fontSize.xs },
  discardText: { color: colors.primary, fontSize: fontSize.xs, paddingVertical: spacing.sm },
  footerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.lg,
  },
  timerCard: {
    alignItems: 'center',
    marginBottom: spacing.md,
    backgroundColor: colors.primaryLight,
  },
  timerLabel: {
    fontSize: fontSize.sm,
    color: colors.white,
  },
  timerValue: {
    fontSize: fontSize.hero,
    fontWeight: fontWeight.bold,
    color: colors.white,
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
    color: colors.white,
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
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  saveTemplateButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
  },
  saveTemplateText: {
    fontSize: fontSize.sm,
    color: colors.primary,
    fontWeight: fontWeight.medium,
  },
});

export default LogWorkoutScreen;
