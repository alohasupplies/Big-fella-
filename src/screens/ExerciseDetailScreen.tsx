import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
} from 'react-native';
import { useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import { LineChart } from 'react-native-chart-kit';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { spacing, fontSize, fontWeight, borderRadius } from '../theme/spacing';
import { Card } from '../components/common';
import { RootStackParamList, ExerciseLibraryItem, ExerciseHistory, PersonalRecord, ProgressionRecommendation } from '../types';
import { useSettings } from '../context/SettingsContext';
import { getFirst, getAll } from '../database/database';
import { getExerciseHistory, getExercisePRs } from '../services/workoutService';
import { calculateProgressionRecommendation } from '../services/progressionService';
import { parseLocalDate } from '../utils/date';

type RouteProps = RouteProp<RootStackParamList, 'ExerciseDetail'>;

const screenWidth = Dimensions.get('window').width;

const ExerciseDetailScreen: React.FC = () => {
  const route = useRoute<RouteProps>();
  const { settings } = useSettings();
  const { exerciseLibraryId } = route.params;

  const [exercise, setExercise] = useState<ExerciseLibraryItem | null>(null);
  const [history, setHistory] = useState<ExerciseHistory[]>([]);
  const [prs, setPrs] = useState<PersonalRecord[]>([]);
  const [recommendation, setRecommendation] = useState<ProgressionRecommendation | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      // Load exercise info
      const exerciseData = await getFirst<any>(
        'SELECT * FROM exercise_library WHERE id = ?',
        [exerciseLibraryId]
      );

      if (exerciseData) {
        setExercise({
          id: exerciseData.id,
          name: exerciseData.name,
          alternativeNames: exerciseData.alternativeNames?.split(','),
          primaryMuscleGroup: exerciseData.primaryMuscleGroup,
          secondaryMuscleGroups: exerciseData.secondaryMuscleGroups?.split(','),
          equipment: exerciseData.equipment,
          category: exerciseData.category,
          tags: exerciseData.tags?.split(','),
          isCustom: exerciseData.isCustom === 1,
        });

        // Load history
        const historyData = await getExerciseHistory(exerciseLibraryId, 20);
        setHistory(historyData);

        // Load PRs
        const prData = await getExercisePRs(exerciseLibraryId);
        setPrs(prData);

        // Get progression recommendation
        const isCompound = exerciseData.category === 'compound';
        const rec = await calculateProgressionRecommendation(
          exerciseLibraryId,
          exerciseData.name,
          isCompound
        );
        setRecommendation(rec);
      }
    } catch (error) {
      console.error('Failed to load exercise data:', error);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [exerciseLibraryId])
  );

  const chartConfig = {
    backgroundColor: colors.surface,
    backgroundGradientFrom: colors.surface,
    backgroundGradientTo: colors.surface,
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(33, 150, 243, ${opacity})`,
    labelColor: () => colors.textSecondary,
    style: { borderRadius: 16 },
    propsForDots: { r: '4', strokeWidth: '2', stroke: colors.accent },
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'add_weight':
        return 'trending-up';
      case 'add_reps':
        return 'add-circle';
      case 'add_sets':
        return 'layers';
      case 'deload':
        return 'trending-down';
      default:
        return 'pause-circle';
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'add_weight':
      case 'add_reps':
      case 'add_sets':
        return colors.success;
      case 'deload':
        return colors.warning;
      default:
        return colors.accent;
    }
  };

  if (loading || !exercise) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  const weightData = history.slice(0, 10).reverse().map((h) => h.maxWeight);
  const volumeData = history.slice(0, 10).reverse().map((h) => h.totalVolume / 1000);
  const labels = history.slice(0, 10).reverse().map((h) =>
    parseLocalDate(h.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  );

  const best1RM = prs.find((p) => p.recordType === '1rm');
  const bestMaxWeight = prs.find((p) => p.recordType === 'max_weight');

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Exercise Info */}
      <Card variant="elevated" style={styles.headerCard}>
        <Text style={styles.exerciseName}>{exercise.name}</Text>
        <Text style={styles.muscleGroups}>
          {exercise.primaryMuscleGroup.charAt(0).toUpperCase() +
            exercise.primaryMuscleGroup.slice(1).replace('_', ' ')}
          {exercise.secondaryMuscleGroups && exercise.secondaryMuscleGroups.length > 0 && (
            <Text style={styles.secondaryMuscles}>
              {' '}+ {exercise.secondaryMuscleGroups.slice(0, 2).join(', ')}
            </Text>
          )}
        </Text>
        <View style={styles.tags}>
          <View style={styles.tag}>
            <Text style={styles.tagText}>{exercise.equipment}</Text>
          </View>
          <View style={styles.tag}>
            <Text style={styles.tagText}>{exercise.category}</Text>
          </View>
        </View>
      </Card>

      {/* PRs */}
      {(best1RM || bestMaxWeight) && (
        <View style={styles.prRow}>
          {best1RM && (
            <Card variant="outlined" style={styles.prCard}>
              <Ionicons name="trophy" size={24} color={colors.liftPR} />
              <Text style={styles.prValue}>
                {Math.round(best1RM.value)} {settings.weightUnit}
              </Text>
              <Text style={styles.prLabel}>Est. 1RM</Text>
            </Card>
          )}
          {bestMaxWeight && (
            <Card variant="outlined" style={styles.prCard}>
              <Ionicons name="barbell" size={24} color={colors.accent} />
              <Text style={styles.prValue}>
                {bestMaxWeight.value} {settings.weightUnit}
              </Text>
              <Text style={styles.prLabel}>Max Weight</Text>
            </Card>
          )}
        </View>
      )}

      {/* Progression Recommendation */}
      {recommendation && (
        <Card variant="elevated" style={styles.recommendationCard}>
          <View style={styles.recommendationHeader}>
            <Ionicons
              name={getActionIcon(recommendation.action) as any}
              size={28}
              color={getActionColor(recommendation.action)}
            />
            <Text style={styles.recommendationTitle}>
              {recommendation.action === 'add_weight' && 'Ready to Progress!'}
              {recommendation.action === 'add_reps' && 'Add More Reps'}
              {recommendation.action === 'add_sets' && 'Increase Volume'}
              {recommendation.action === 'maintain' && 'Keep Building'}
              {recommendation.action === 'deload' && 'Time for Recovery'}
            </Text>
          </View>
          <Text style={styles.recommendationText}>{recommendation.reason}</Text>
          {recommendation.suggestedWeight && (
            <Text style={styles.suggestionText}>
              Try: {recommendation.suggestedWeight} {settings.weightUnit}
            </Text>
          )}
        </Card>
      )}

      {/* Weight Progress Chart */}
      {history.length > 1 && weightData.some((w) => w > 0) && (
        <Card variant="outlined" style={styles.chartCard}>
          <Text style={styles.chartTitle}>Weight Progress ({settings.weightUnit})</Text>
          <LineChart
            data={{
              labels: labels.length > 6 ? labels.filter((_, i) => i % 2 === 0) : labels,
              datasets: [{ data: weightData.map((w) => w || 0.1) }],
            }}
            width={screenWidth - spacing.md * 4}
            height={180}
            chartConfig={chartConfig}
            bezier
            style={styles.chart}
          />
        </Card>
      )}

      {/* Volume Progress Chart */}
      {history.length > 1 && volumeData.some((v) => v > 0) && (
        <Card variant="outlined" style={styles.chartCard}>
          <Text style={styles.chartTitle}>Volume Progress (K {settings.weightUnit})</Text>
          <LineChart
            data={{
              labels: labels.length > 6 ? labels.filter((_, i) => i % 2 === 0) : labels,
              datasets: [{ data: volumeData.map((v) => v || 0.1) }],
            }}
            width={screenWidth - spacing.md * 4}
            height={180}
            chartConfig={{
              ...chartConfig,
              color: (opacity = 1) => `rgba(255, 107, 53, ${opacity})`,
            }}
            bezier
            style={styles.chart}
          />
        </Card>
      )}

      {/* Recent History */}
      <Text style={styles.sectionTitle}>Recent History</Text>
      {history.length === 0 ? (
        <Card variant="outlined" style={styles.emptyCard}>
          <Text style={styles.emptyText}>No history yet</Text>
          <Text style={styles.emptySubtext}>
            Log a workout with this exercise to see your progress
          </Text>
        </Card>
      ) : (
        history.slice(0, 5).map((entry, index) => (
          <Card key={index} variant="outlined" style={styles.historyCard}>
            <View style={styles.historyHeader}>
              <Text style={styles.historyDate}>
                {parseLocalDate(entry.date).toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                })}
              </Text>
              <Text style={styles.historyVolume}>
                {(entry.totalVolume / 1000).toFixed(1)}K {settings.weightUnit}
              </Text>
            </View>
            <View style={styles.historySets}>
              {entry.sets.slice(0, 5).map((set, setIdx) => (
                <Text key={setIdx} style={styles.historySetText}>
                  {set.weight} x {set.reps}
                </Text>
              ))}
              {entry.sets.length > 5 && (
                <Text style={styles.moreSets}>+{entry.sets.length - 5} more</Text>
              )}
            </View>
          </Card>
        ))
      )}
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
    alignItems: 'center',
  },
  exerciseName: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  muscleGroups: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  secondaryMuscles: {
    color: colors.textDisabled,
  },
  tags: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  tag: {
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  tagText: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
  prRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  prCard: {
    flex: 1,
    alignItems: 'center',
    padding: spacing.md,
  },
  prValue: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    marginTop: spacing.sm,
  },
  prLabel: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  recommendationCard: {
    marginBottom: spacing.lg,
    backgroundColor: colors.successLight,
  },
  recommendationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  recommendationTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  recommendationText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  suggestionText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.success,
    marginTop: spacing.sm,
  },
  chartCard: {
    marginBottom: spacing.lg,
    padding: spacing.md,
  },
  chartTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  chart: {
    marginLeft: -spacing.md,
    borderRadius: borderRadius.lg,
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
  },
  emptySubtext: {
    fontSize: fontSize.sm,
    color: colors.textDisabled,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  historyCard: {
    marginBottom: spacing.sm,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  historyDate: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.textPrimary,
  },
  historyVolume: {
    fontSize: fontSize.sm,
    color: colors.accent,
    fontWeight: fontWeight.medium,
  },
  historySets: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  historySetText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  moreSets: {
    fontSize: fontSize.sm,
    color: colors.primary,
  },
});

export default ExerciseDetailScreen;
