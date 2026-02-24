import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { LineChart } from 'react-native-chart-kit';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { spacing, fontSize, fontWeight, borderRadius } from '../theme/spacing';
import { Card } from '../components/common';
import { useSettings } from '../context/SettingsContext';
import { useHealthSyncContext } from '../context/HealthSyncContext';
import {
  getWeeklyVolume,
  getTotalLifetimeVolume,
  getWorkoutsByDateRange,
  calculateWorkoutVolume,
} from '../services/workoutService';
import {
  getWeeklyRunStats,
  getLifetimeRunStats,
  calculateCurrentStreak,
  getRunsByDateRange,
} from '../services/runService';

const screenWidth = Dimensions.get('window').width;

const ProgressScreen: React.FC = () => {
  const { settings } = useSettings();
  const { syncVersion } = useHealthSyncContext();
  const [activeTab, setActiveTab] = useState<'lift' | 'run' | 'combined'>('combined');
  const [refreshing, setRefreshing] = useState(false);

  // Lift stats
  const [weeklyVolume, setWeeklyVolume] = useState(0);
  const [lifetimeVolume, setLifetimeVolume] = useState(0);
  const [volumeData, setVolumeData] = useState<number[]>([0, 0, 0, 0, 0, 0, 0]);

  // Run stats
  const [weeklyDistance, setWeeklyDistance] = useState(0);
  const [lifetimeDistance, setLifetimeDistance] = useState(0);
  const [lifetimeRuns, setLifetimeRuns] = useState(0);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [distanceData, setDistanceData] = useState<number[]>([0, 0, 0, 0, 0, 0, 0]);

  const loadData = async () => {
    try {
      // Load lift data
      const weekVol = await getWeeklyVolume();
      setWeeklyVolume(weekVol);

      const lifetime = await getTotalLifetimeVolume();
      setLifetimeVolume(lifetime);

      // Load run data
      const runStats = await getWeeklyRunStats();
      setWeeklyDistance(runStats.totalDistance);

      const lifetimeRunStats = await getLifetimeRunStats();
      setLifetimeDistance(lifetimeRunStats.totalDistance);
      setLifetimeRuns(lifetimeRunStats.totalRuns);

      const streak = await calculateCurrentStreak(
        settings.streakMinDistance,
        settings.streakMinDuration
      );
      setCurrentStreak(streak);

      // Load chart data (last 7 weeks)
      await loadChartData();
    } catch (error) {
      console.error('Failed to load progress data:', error);
    }
  };

  const loadChartData = async () => {
    const volumeWeekly: number[] = [];
    const distanceWeekly: number[] = [];
    const today = new Date();

    for (let i = 6; i >= 0; i--) {
      const weekEnd = new Date(today);
      weekEnd.setDate(today.getDate() - i * 7);
      const weekStart = new Date(weekEnd);
      weekStart.setDate(weekEnd.getDate() - 7);

      const startStr = weekStart.toISOString().split('T')[0];
      const endStr = weekEnd.toISOString().split('T')[0];

      // Get workouts for this week
      const workouts = await getWorkoutsByDateRange(startStr, endStr);
      const weekVolume = workouts.reduce(
        (sum, w) => sum + calculateWorkoutVolume(w),
        0
      );
      volumeWeekly.push(weekVolume / 1000); // Convert to thousands

      // Get runs for this week
      const runs = await getRunsByDateRange(startStr, endStr);
      const weekDistance = runs.reduce((sum, r) => sum + r.distance, 0);
      distanceWeekly.push(weekDistance);
    }

    setVolumeData(volumeWeekly);
    setDistanceData(distanceWeekly);
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [settings.streakMinDistance, settings.streakMinDuration, syncVersion])
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

  const chartConfig = {
    backgroundColor: colors.surface,
    backgroundGradientFrom: colors.surface,
    backgroundGradientTo: colors.surface,
    decimalPlaces: 1,
    color: (opacity = 1) => `rgba(255, 107, 53, ${opacity})`,
    labelColor: () => colors.textSecondary,
    style: {
      borderRadius: 16,
    },
    propsForDots: {
      r: '4',
      strokeWidth: '2',
      stroke: colors.primary,
    },
  };

  const weekLabels = ['6w', '5w', '4w', '3w', '2w', '1w', 'Now'];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Tab Selector */}
      <View style={styles.tabs}>
        {(['combined', 'lift', 'run'] as const).map((tab) => (
          <View
            key={tab}
            style={[styles.tab, activeTab === tab && styles.activeTab]}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === tab && styles.activeTabText,
              ]}
              onPress={() => setActiveTab(tab)}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </View>
        ))}
      </View>

      {/* Combined Stats */}
      {activeTab === 'combined' && (
        <>
          <Card variant="elevated" style={styles.summaryCard}>
            <Text style={styles.cardTitle}>This Week</Text>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Ionicons name="barbell" size={24} color={colors.accent} />
                <Text style={styles.summaryValue}>
                  {formatVolume(weeklyVolume)} {settings.weightUnit}
                </Text>
                <Text style={styles.summaryLabel}>Volume</Text>
              </View>
              <View style={styles.summaryItem}>
                <Ionicons name="walk" size={24} color={colors.primary} />
                <Text style={styles.summaryValue}>
                  {weeklyDistance.toFixed(1)} {settings.distanceUnit}
                </Text>
                <Text style={styles.summaryLabel}>Distance</Text>
              </View>
              <View style={styles.summaryItem}>
                <Ionicons name="flame" size={24} color={colors.warning} />
                <Text style={styles.summaryValue}>{currentStreak}</Text>
                <Text style={styles.summaryLabel}>Streak</Text>
              </View>
            </View>
          </Card>

          <Card variant="outlined" style={styles.chartCard}>
            <Text style={styles.chartTitle}>Weekly Volume (K {settings.weightUnit})</Text>
            <LineChart
              data={{
                labels: weekLabels,
                datasets: [{ data: volumeData.map((v) => v || 0.1) }],
              }}
              width={screenWidth - spacing.md * 4}
              height={180}
              chartConfig={{
                ...chartConfig,
                color: (opacity = 1) => `rgba(33, 150, 243, ${opacity})`,
              }}
              bezier
              style={styles.chart}
            />
          </Card>

          <Card variant="outlined" style={styles.chartCard}>
            <Text style={styles.chartTitle}>Weekly Distance ({settings.distanceUnit})</Text>
            <LineChart
              data={{
                labels: weekLabels,
                datasets: [{ data: distanceData.map((d) => d || 0.1) }],
              }}
              width={screenWidth - spacing.md * 4}
              height={180}
              chartConfig={chartConfig}
              bezier
              style={styles.chart}
            />
          </Card>
        </>
      )}

      {/* Lift Stats */}
      {activeTab === 'lift' && (
        <>
          <View style={styles.statsRow}>
            <Card variant="outlined" style={styles.statCard}>
              <Text style={styles.statValue}>
                {formatVolume(weeklyVolume)}
              </Text>
              <Text style={styles.statLabel}>
                Weekly Volume ({settings.weightUnit})
              </Text>
            </Card>
            <Card variant="outlined" style={styles.statCard}>
              <Text style={styles.statValue}>
                {formatVolume(lifetimeVolume)}
              </Text>
              <Text style={styles.statLabel}>
                Lifetime Volume ({settings.weightUnit})
              </Text>
            </Card>
          </View>

          <Card variant="outlined" style={styles.chartCard}>
            <Text style={styles.chartTitle}>7-Week Volume Trend</Text>
            <LineChart
              data={{
                labels: weekLabels,
                datasets: [{ data: volumeData.map((v) => v || 0.1) }],
              }}
              width={screenWidth - spacing.md * 4}
              height={220}
              chartConfig={{
                ...chartConfig,
                color: (opacity = 1) => `rgba(33, 150, 243, ${opacity})`,
              }}
              bezier
              style={styles.chart}
            />
          </Card>
        </>
      )}

      {/* Run Stats */}
      {activeTab === 'run' && (
        <>
          <View style={styles.statsRow}>
            <Card variant="outlined" style={styles.statCard}>
              <Text style={styles.statValue}>
                {weeklyDistance.toFixed(1)}
              </Text>
              <Text style={styles.statLabel}>
                This Week ({settings.distanceUnit})
              </Text>
            </Card>
            <Card variant="outlined" style={styles.statCard}>
              <Text style={styles.statValue}>
                {lifetimeDistance.toFixed(1)}
              </Text>
              <Text style={styles.statLabel}>
                Lifetime ({settings.distanceUnit})
              </Text>
            </Card>
          </View>

          <View style={styles.statsRow}>
            <Card variant="outlined" style={styles.statCard}>
              <Text style={styles.statValue}>{currentStreak}</Text>
              <Text style={styles.statLabel}>Current Streak</Text>
            </Card>
            <Card variant="outlined" style={styles.statCard}>
              <Text style={styles.statValue}>{lifetimeRuns}</Text>
              <Text style={styles.statLabel}>Days Running</Text>
            </Card>
          </View>

          <Card variant="outlined" style={styles.chartCard}>
            <Text style={styles.chartTitle}>7-Week Distance Trend</Text>
            <LineChart
              data={{
                labels: weekLabels,
                datasets: [{ data: distanceData.map((d) => d || 0.1) }],
              }}
              width={screenWidth - spacing.md * 4}
              height={220}
              chartConfig={chartConfig}
              bezier
              style={styles.chart}
            />
          </Card>
        </>
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
  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.xs,
    marginBottom: spacing.lg,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: borderRadius.md,
  },
  activeTab: {
    backgroundColor: colors.primary,
  },
  tabText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.textSecondary,
  },
  activeTabText: {
    color: colors.white,
  },
  summaryCard: {
    marginBottom: spacing.lg,
  },
  cardTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  summaryItem: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  summaryValue: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  summaryLabel: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
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
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    color: colors.primary,
  },
  statLabel: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    textAlign: 'center',
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
});

export default ProgressScreen;
