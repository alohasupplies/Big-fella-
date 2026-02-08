import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { spacing, fontSize, fontWeight, borderRadius } from '../theme/spacing';
import { Card, Button } from '../components/common';
import { RootStackParamList, Workout, WorkoutTemplate } from '../types';
import { useSettings } from '../context/SettingsContext';
import {
  getRecentWorkouts,
  getWeeklyVolume,
  getTotalWorkoutCount,
  calculateWorkoutVolume,
} from '../services/workoutService';
import { getTemplates, deleteTemplate } from '../services/templateService';
import { parseLocalDate } from '../utils/date';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const LiftScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const { settings } = useSettings();

  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [weeklyVolume, setWeeklyVolume] = useState(0);
  const [totalWorkouts, setTotalWorkouts] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    try {
      const recentWorkouts = await getRecentWorkouts(10);
      setWorkouts(recentWorkouts);

      const volume = await getWeeklyVolume();
      setWeeklyVolume(volume);

      const count = await getTotalWorkoutCount();
      setTotalWorkouts(count);

      const loadedTemplates = await getTemplates();
      setTemplates(loadedTemplates);
    } catch (error) {
      console.error('Failed to load lift data:', error);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const formatVolume = (volume: number): string => {
    if (volume >= 1000000) {
      return `${(volume / 1000000).toFixed(1)}M`;
    }
    if (volume >= 1000) {
      return `${(volume / 1000).toFixed(1)}K`;
    }
    return volume.toLocaleString();
  };

  const getMuscleGroupsForWorkout = (workout: Workout): string => {
    const muscleGroups = new Set<string>();
    workout.exercises.forEach((exercise) => {
      exercise.muscleGroups.forEach((mg) => muscleGroups.add(mg));
    });
    return Array.from(muscleGroups)
      .slice(0, 3)
      .map((mg) => mg.charAt(0).toUpperCase() + mg.slice(1).replace('_', ' '))
      .join(', ');
  };

  const getTemplateMuscleGroups = (template: WorkoutTemplate): string => {
    const muscleGroups = new Set<string>();
    template.exercises.forEach((ex) => {
      ex.muscleGroups.forEach((mg) => muscleGroups.add(mg));
    });
    return Array.from(muscleGroups)
      .slice(0, 3)
      .map((mg) => mg.charAt(0).toUpperCase() + mg.slice(1).replace('_', ' '))
      .join(', ');
  };

  const handleDeleteTemplate = (template: WorkoutTemplate) => {
    Alert.alert(
      'Delete Template',
      `Are you sure you want to delete "${template.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteTemplate(template.id);
            setTemplates(templates.filter((t) => t.id !== template.id));
          },
        },
      ]
    );
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Quick Start Button */}
      <Button
        title="Start New Workout"
        onPress={() => navigation.navigate('LogWorkout', {})}
        size="large"
        icon={<Ionicons name="add" size={24} color={colors.white} />}
        style={styles.startButton}
      />

      {/* My Templates */}
      {templates.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>My Templates</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.templateScroll}
          >
            {templates.map((template) => (
              <TouchableOpacity
                key={template.id}
                onPress={() =>
                  navigation.navigate('LogWorkout', { templateId: template.id })
                }
                onLongPress={() => handleDeleteTemplate(template)}
              >
                <Card variant="outlined" style={styles.templateCard}>
                  <Text style={styles.templateName} numberOfLines={1}>
                    {template.name}
                  </Text>
                  <Text style={styles.templateMeta}>
                    {template.exercises.length} exercise{template.exercises.length !== 1 ? 's' : ''}
                  </Text>
                  <Text style={styles.templateMuscles} numberOfLines={1}>
                    {getTemplateMuscleGroups(template)}
                  </Text>
                </Card>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Stats Overview */}
      <View style={styles.statsRow}>
        <Card variant="outlined" style={styles.statCard}>
          <Text style={styles.statValue}>
            {formatVolume(weeklyVolume)}
          </Text>
          <Text style={styles.statUnit}>{settings.weightUnit}</Text>
          <Text style={styles.statLabel}>This Week</Text>
        </Card>

        <Card variant="outlined" style={styles.statCard}>
          <Text style={styles.statValue}>{totalWorkouts}</Text>
          <Text style={styles.statLabel}>Total Workouts</Text>
        </Card>
      </View>

      {/* Recent Workouts */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Workouts</Text>

        {workouts.length === 0 ? (
          <Card variant="outlined" style={styles.emptyCard}>
            <Ionicons name="barbell-outline" size={48} color={colors.textDisabled} />
            <Text style={styles.emptyText}>No workouts yet</Text>
            <Text style={styles.emptySubtext}>
              Tap the button above to log your first workout!
            </Text>
          </Card>
        ) : (
          workouts.map((workout) => (
            <TouchableOpacity
              key={workout.id}
              onPress={() =>
                navigation.navigate('WorkoutDetail', { workoutId: workout.id })
              }
            >
              <Card variant="outlined" style={styles.workoutCard}>
                <View style={styles.workoutHeader}>
                  <View>
                    <Text style={styles.workoutDate}>
                      {parseLocalDate(workout.date).toLocaleDateString('en-US', {
                        weekday: 'long',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </Text>
                    <Text style={styles.workoutMuscles}>
                      {getMuscleGroupsForWorkout(workout)}
                    </Text>
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={20}
                    color={colors.textSecondary}
                  />
                </View>

                <View style={styles.workoutStats}>
                  <View style={styles.workoutStat}>
                    <Text style={styles.workoutStatValue}>
                      {workout.exercises.length}
                    </Text>
                    <Text style={styles.workoutStatLabel}>Exercises</Text>
                  </View>
                  <View style={styles.workoutStat}>
                    <Text style={styles.workoutStatValue}>
                      {workout.exercises.reduce(
                        (sum, e) => sum + e.sets.length,
                        0
                      )}
                    </Text>
                    <Text style={styles.workoutStatLabel}>Sets</Text>
                  </View>
                  <View style={styles.workoutStat}>
                    <Text style={styles.workoutStatValue}>
                      {formatVolume(calculateWorkoutVolume(workout))}
                    </Text>
                    <Text style={styles.workoutStatLabel}>Volume ({settings.weightUnit})</Text>
                  </View>
                </View>

                {/* Exercise List Preview */}
                <View style={styles.exercisePreview}>
                  {workout.exercises.slice(0, 3).map((exercise, idx) => (
                    <Text key={idx} style={styles.exerciseName} numberOfLines={1}>
                      {exercise.exerciseName}
                    </Text>
                  ))}
                  {workout.exercises.length > 3 && (
                    <Text style={styles.moreExercises}>
                      +{workout.exercises.length - 3} more
                    </Text>
                  )}
                </View>
              </Card>
            </TouchableOpacity>
          ))
        )}
      </View>
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
  startButton: {
    marginBottom: spacing.lg,
  },
  templateScroll: {
    gap: spacing.sm,
  },
  templateCard: {
    width: 150,
    padding: spacing.md,
  },
  templateName: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  templateMeta: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
  templateMuscles: {
    fontSize: fontSize.xs,
    color: colors.primary,
    marginTop: spacing.xs,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    padding: spacing.md,
  },
  statValue: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    color: colors.accent,
  },
  statUnit: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  statLabel: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  emptyCard: {
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyText: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
  emptySubtext: {
    fontSize: fontSize.sm,
    color: colors.textDisabled,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  workoutCard: {
    marginBottom: spacing.md,
  },
  workoutHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  workoutDate: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  workoutMuscles: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  workoutStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  workoutStat: {
    alignItems: 'center',
  },
  workoutStatValue: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  workoutStatLabel: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
  exercisePreview: {
    gap: spacing.xs,
  },
  exerciseName: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  moreExercises: {
    fontSize: fontSize.sm,
    color: colors.primary,
    fontWeight: fontWeight.medium,
  },
});

export default LiftScreen;
