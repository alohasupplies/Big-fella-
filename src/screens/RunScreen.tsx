import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { spacing, fontSize, fontWeight, borderRadius } from '../theme/spacing';
import { Card, Button } from '../components/common';
import { StreakCalendar } from '../components/streak/StreakCalendar';
import { RootStackParamList, Run } from '../types';
import { useSettings } from '../context/SettingsContext';
import {
  getRecentRuns,
  calculateCurrentStreak,
  getLifetimeRunStats,
  formatPace,
  formatDuration,
  useStreakFreeze,
} from '../services/runService';
import {
  isHealthKitAvailable,
  syncRunsFromHealthKit,
} from '../services/healthService';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const RunScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const { settings } = useSettings();

  const [runs, setRuns] = useState<Run[]>([]);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [lifetimeStats, setLifetimeStats] = useState({
    totalDistance: 0,
    totalRuns: 0,
    totalDuration: 0,
    longestStreak: 0,
  });
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const syncFromHealth = async () => {
    if (!settings.healthSyncEnabled || !isHealthKitAvailable()) return;
    setSyncing(true);
    try {
      await syncRunsFromHealthKit(settings.distanceUnit);
    } catch (error) {
      console.error('Health sync failed:', error);
    } finally {
      setSyncing(false);
    }
  };

  const loadData = async () => {
    try {
      // Sync from Apple Health first if enabled
      await syncFromHealth();

      const recentRuns = await getRecentRuns(10);
      setRuns(recentRuns);

      const streak = await calculateCurrentStreak(
        settings.streakMinDistance,
        settings.streakMinDuration
      );
      setCurrentStreak(streak);

      const stats = await getLifetimeRunStats();
      setLifetimeStats(stats);
    } catch (error) {
      console.error('Failed to load run data:', error);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [settings.streakMinDistance, settings.streakMinDuration])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleDayPress = (date: string, dayRuns: Run[]) => {
    if (dayRuns.length > 0) {
      navigation.navigate('RunDetail', { runId: dayRuns[0].id });
    } else {
      // Option to log a run for this date
      Alert.alert(
        'No Run Logged',
        `Would you like to log a run for ${new Date(date).toLocaleDateString()}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Log Run',
            onPress: () => navigation.navigate('LogRun', {}),
          },
        ]
      );
    }
  };

  const handleUseFreeze = async () => {
    const today = new Date().toISOString().split('T')[0];
    Alert.alert(
      'Use Streak Freeze?',
      'This will use one of your monthly freeze passes to protect your streak for today. You have 2 freezes per month.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Use Freeze',
          onPress: async () => {
            const success = await useStreakFreeze(today, 'Manual freeze');
            if (success) {
              Alert.alert('Success', 'Streak freeze activated for today!');
            } else {
              Alert.alert(
                'Failed',
                'Could not use freeze. You may have used all your monthly freezes.'
              );
            }
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
      {/* Log Run Button */}
      <Button
        title="Log Run"
        onPress={() => navigation.navigate('LogRun', {})}
        size="large"
        icon={<Ionicons name="add" size={24} color={colors.white} />}
        style={styles.logButton}
      />

      {/* Apple Health Sync Indicator */}
      {settings.healthSyncEnabled && syncing && (
        <View style={styles.syncBanner}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.syncText}>Syncing from Apple Health...</Text>
        </View>
      )}

      {/* Streak Calendar */}
      <StreakCalendar
        currentStreak={currentStreak}
        onDayPress={handleDayPress}
      />

      {/* Streak Freeze Button */}
      {currentStreak > 0 && (
        <TouchableOpacity style={styles.freezeButton} onPress={handleUseFreeze}>
          <Ionicons name="snow" size={20} color={colors.accent} />
          <Text style={styles.freezeText}>Use Streak Freeze</Text>
        </TouchableOpacity>
      )}

      {/* Lifetime Stats */}
      <View style={styles.statsSection}>
        <Text style={styles.sectionTitle}>Lifetime Stats</Text>
        <View style={styles.statsGrid}>
          <Card variant="outlined" style={styles.statCard}>
            <Text style={styles.statValue}>
              {lifetimeStats.totalDistance.toFixed(1)}
            </Text>
            <Text style={styles.statLabel}>
              Total {settings.distanceUnit}
            </Text>
          </Card>
          <Card variant="outlined" style={styles.statCard}>
            <Text style={styles.statValue}>{lifetimeStats.totalRuns}</Text>
            <Text style={styles.statLabel}>Total Runs</Text>
          </Card>
          <Card variant="outlined" style={styles.statCard}>
            <Text style={styles.statValue}>{lifetimeStats.longestStreak}</Text>
            <Text style={styles.statLabel}>Longest Streak</Text>
          </Card>
          <Card variant="outlined" style={styles.statCard}>
            <Text style={styles.statValue}>
              {formatDuration(lifetimeStats.totalDuration)}
            </Text>
            <Text style={styles.statLabel}>Total Time</Text>
          </Card>
        </View>
      </View>

      {/* Recent Runs */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Runs</Text>

        {runs.length === 0 ? (
          <Card variant="outlined" style={styles.emptyCard}>
            <Ionicons name="walk-outline" size={48} color={colors.textDisabled} />
            <Text style={styles.emptyText}>No runs yet</Text>
            <Text style={styles.emptySubtext}>
              Log your first run to start your streak!
            </Text>
          </Card>
        ) : (
          runs.map((run) => (
            <TouchableOpacity
              key={run.id}
              onPress={() => navigation.navigate('RunDetail', { runId: run.id })}
            >
              <Card variant="outlined" style={styles.runCard}>
                <View style={styles.runHeader}>
                  <View style={styles.runDateContainer}>
                    <Text style={styles.runDate}>
                      {new Date(run.date).toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </Text>
                    {run.runType && (
                      <View style={styles.runTypeBadge}>
                        <Text style={styles.runTypeText}>
                          {run.runType.charAt(0).toUpperCase() + run.runType.slice(1)}
                        </Text>
                      </View>
                    )}
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={20}
                    color={colors.textSecondary}
                  />
                </View>

                <View style={styles.runStats}>
                  <View style={styles.runStat}>
                    <Text style={styles.runStatValue}>
                      {run.distance.toFixed(2)}
                    </Text>
                    <Text style={styles.runStatLabel}>{settings.distanceUnit}</Text>
                  </View>
                  <View style={styles.runStat}>
                    <Text style={styles.runStatValue}>
                      {formatDuration(run.duration)}
                    </Text>
                    <Text style={styles.runStatLabel}>Time</Text>
                  </View>
                  <View style={styles.runStat}>
                    <Text style={styles.runStatValue}>
                      {formatPace(run.pace)}
                    </Text>
                    <Text style={styles.runStatLabel}>
                      /{settings.distanceUnit === 'miles' ? 'mi' : 'km'}
                    </Text>
                  </View>
                </View>

                {run.routeName && (
                  <View style={styles.routeContainer}>
                    <Ionicons name="location" size={14} color={colors.textSecondary} />
                    <Text style={styles.routeName}>{run.routeName}</Text>
                  </View>
                )}
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
  logButton: {
    marginBottom: spacing.lg,
  },
  freezeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    marginTop: spacing.md,
  },
  freezeText: {
    color: colors.accent,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
  },
  statsSection: {
    marginTop: spacing.lg,
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  statCard: {
    width: '48%',
    alignItems: 'center',
    padding: spacing.md,
  },
  statValue: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.primary,
  },
  statLabel: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  section: {
    marginBottom: spacing.lg,
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
  runCard: {
    marginBottom: spacing.md,
  },
  runHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  runDateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  runDate: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  runTypeBadge: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  runTypeText: {
    fontSize: fontSize.xs,
    color: colors.primaryDark,
    fontWeight: fontWeight.medium,
  },
  runStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  runStat: {
    alignItems: 'center',
  },
  runStatValue: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  runStatLabel: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
  routeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  routeName: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  syncBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
  },
  syncText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
});

export default RunScreen;
