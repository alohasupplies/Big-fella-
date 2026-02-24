import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Image,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { spacing, fontSize, fontWeight, borderRadius } from '../theme/spacing';
import { Card, Button } from '../components/common';
import { RootStackParamList, Workout, Run } from '../types';
import { useSettings } from '../context/SettingsContext';
import {
  getRecentWorkouts,
  getWeeklyVolume,
  getMonthlyWorkoutCount,
} from '../services/workoutService';
import {
  getRecentRuns,
  getCurrentStreak,
  calculateCurrentStreak,
  getWeeklyRunStats,
} from '../services/runService';
import { parseLocalDate } from '../utils/date';
import { useHealthSyncContext } from '../context/HealthSyncContext';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const HomeScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const { settings } = useSettings();
  const { syncVersion, triggerSync } = useHealthSyncContext();

  const [currentStreak, setCurrentStreak] = useState(0);
  const [weeklyVolume, setWeeklyVolume] = useState(0);
  const [weeklyDistance, setWeeklyDistance] = useState(0);
  const [workoutCount, setWorkoutCount] = useState(0);
  const [runCount, setRunCount] = useState(0);
  const [recentActivity, setRecentActivity] = useState<(Workout | Run)[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    try {
      // Load streak
      const streak = await calculateCurrentStreak(
        settings.streakMinDistance,
        settings.streakMinDuration
      );
      setCurrentStreak(streak);

      // Load weekly stats
      const volume = await getWeeklyVolume();
      setWeeklyVolume(volume);

      const runStats = await getWeeklyRunStats();
      setWeeklyDistance(runStats.totalDistance);
      setRunCount(runStats.runCount);

      // Load monthly workout count
      const monthlyCount = await getMonthlyWorkoutCount();
      setWorkoutCount(monthlyCount);

      // Load recent activity
      const [workouts, runs] = await Promise.all([
        getRecentWorkouts(3),
        getRecentRuns(3),
      ]);

      // Combine and sort by date
      const combined = [...workouts, ...runs].sort((a, b) => {
        const dateA = parseLocalDate(a.date).getTime();
        const dateB = parseLocalDate(b.date).getTime();
        return dateB - dateA;
      }).slice(0, 5);

      setRecentActivity(combined);
    } catch (error) {
      console.error('Failed to load home data:', error);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [settings.streakMinDistance, settings.streakMinDuration, syncVersion])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    triggerSync();
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

  const isWorkout = (item: Workout | Run): item is Workout => {
    return 'exercises' in item;
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Logo */}
      <View style={styles.logoContainer}>
        <Image
          source={require('../../assets/logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
      </View>

      {/* Quick Actions */}
      <View style={styles.quickActions}>
        <TouchableOpacity
          style={[styles.actionButton, styles.workoutButton]}
          onPress={() => navigation.navigate('LogWorkout', {})}
        >
          <Ionicons name="barbell" size={32} color={colors.white} />
          <Text style={styles.actionButtonText}>Log Workout</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.runButton]}
          onPress={() => navigation.navigate('LogRun', {})}
        >
          <Ionicons name="walk" size={32} color={colors.white} />
          <Text style={styles.actionButtonText}>Log Run</Text>
        </TouchableOpacity>
      </View>

      {/* Streak Card */}
      <Card variant="elevated" style={styles.streakCard}>
        <Text style={styles.streakNumber}>{currentStreak}</Text>
        <Text style={styles.streakLabel}>Day Run Streak</Text>
        {currentStreak > 0 && (
          <Text style={styles.streakMotivation}>
            Keep it going! Don't break the chain!
          </Text>
        )}
        {currentStreak === 0 && (
          <Text style={styles.streakMotivation}>
            Start your streak today! Log a run to begin.
          </Text>
        )}
      </Card>

      {/* Weekly Stats */}
      <View style={styles.statsRow}>
        <Card variant="outlined" style={styles.statCard}>
          <Text style={styles.statValue}>
            {formatVolume(weeklyVolume)} {settings.weightUnit}
          </Text>
          <Text style={styles.statLabel}>Weekly Volume</Text>
        </Card>

        <Card variant="outlined" style={styles.statCard}>
          <Text style={styles.statValue}>
            {weeklyDistance.toFixed(1)} {settings.distanceUnit}
          </Text>
          <Text style={styles.statLabel}>Weekly Distance</Text>
        </Card>
      </View>

      <View style={styles.statsRow}>
        <Card variant="outlined" style={styles.statCard}>
          <Text style={styles.statValue}>{workoutCount}</Text>
          <Text style={styles.statLabel}>Workouts This Month</Text>
        </Card>

        <Card variant="outlined" style={styles.statCard}>
          <Text style={styles.statValue}>{runCount}</Text>
          <Text style={styles.statLabel}>Runs This Week</Text>
        </Card>
      </View>

      {/* Recent Activity */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Activity</Text>

        {recentActivity.length === 0 ? (
          <Card variant="outlined" style={styles.emptyCard}>
            <Text style={styles.emptyText}>No activity yet</Text>
            <Text style={styles.emptySubtext}>
              Log a workout or run to get started!
            </Text>
          </Card>
        ) : (
          recentActivity.map((item) => (
            <TouchableOpacity
              key={item.id}
              onPress={() => {
                if (isWorkout(item)) {
                  navigation.navigate('WorkoutDetail', { workoutId: item.id });
                } else {
                  navigation.navigate('RunDetail', { runId: item.id, run: item as Run });
                }
              }}
            >
              <Card variant="outlined" style={styles.activityCard}>
                <View style={styles.activityRow}>
                  <Ionicons
                    name={isWorkout(item) ? 'barbell' : 'walk'}
                    size={24}
                    color={isWorkout(item) ? colors.accent : colors.primary}
                  />
                  <View style={styles.activityInfo}>
                    <Text style={styles.activityTitle}>
                      {isWorkout(item)
                        ? `${item.exercises.length} exercises`
                        : `${item.distance.toFixed(1)} ${settings.distanceUnit}`}
                    </Text>
                    <Text style={styles.activityDate}>
                      {parseLocalDate(item.date).toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </Text>
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={20}
                    color={colors.textSecondary}
                  />
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
  logoContainer: {
    alignItems: 'center',
    marginBottom: spacing.lg,
    marginTop: spacing.md,
  },
  logo: {
    width: 200,
    height: 120,
  },
  quickActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    gap: spacing.sm,
  },
  workoutButton: {
    backgroundColor: colors.primary,
  },
  runButton: {
    backgroundColor: colors.primary,
  },
  actionButtonText: {
    color: colors.white,
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
  streakCard: {
    marginBottom: spacing.lg,
    alignItems: 'center',
  },
  streakContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  streakInfo: {
    alignItems: 'center',
  },
  streakNumber: {
    fontSize: fontSize.hero,
    fontWeight: fontWeight.bold,
    color: colors.primary,
  },
  streakLabel: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
  },
  streakMotivation: {
    marginTop: spacing.md,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    padding: spacing.md,
  },
  statValue: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  statLabel: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  section: {
    marginTop: spacing.md,
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
  },
  activityCard: {
    marginBottom: spacing.sm,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  activityInfo: {
    flex: 1,
  },
  activityTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
    color: colors.textPrimary,
  },
  activityDate: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
});

export default HomeScreen;
