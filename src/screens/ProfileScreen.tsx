import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { spacing, fontSize, fontWeight, borderRadius } from '../theme/spacing';
import { Card } from '../components/common';
import { RootStackParamList } from '../types';
import { useSettings } from '../context/SettingsContext';
import { getTotalWorkoutCount, getTotalLifetimeVolume } from '../services/workoutService';
import { getLifetimeRunStats } from '../services/runService';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const ProfileScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const { settings } = useSettings();

  const [totalWorkouts, setTotalWorkouts] = useState(0);
  const [totalVolume, setTotalVolume] = useState(0);
  const [totalRuns, setTotalRuns] = useState(0);
  const [totalDistance, setTotalDistance] = useState(0);

  const loadData = async () => {
    try {
      const workoutCount = await getTotalWorkoutCount();
      setTotalWorkouts(workoutCount);

      const volume = await getTotalLifetimeVolume();
      setTotalVolume(volume);

      const runStats = await getLifetimeRunStats();
      setTotalRuns(runStats.totalRuns);
      setTotalDistance(runStats.totalDistance);
    } catch (error) {
      console.error('Failed to load profile data:', error);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const formatVolume = (volume: number): string => {
    if (volume >= 1000000) {
      return `${(volume / 1000000).toFixed(1)}M`;
    }
    if (volume >= 1000) {
      return `${(volume / 1000).toFixed(1)}K`;
    }
    return volume.toLocaleString();
  };

  const menuItems = [
    {
      icon: 'settings-outline' as const,
      title: 'Settings',
      subtitle: 'Units, notifications, preferences',
      onPress: () => navigation.navigate('Settings'),
    },
    {
      icon: 'download-outline' as const,
      title: 'Export Data',
      subtitle: 'Export workouts and runs to CSV',
      onPress: () => navigation.navigate('DataExport'),
    },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* User Stats Summary */}
      <Card variant="elevated" style={styles.statsCard}>
        <Text style={styles.cardTitle}>Your Journey</Text>

        <View style={styles.statsGrid}>
          <View style={styles.statItem}>
            <Ionicons name="barbell" size={28} color={colors.accent} />
            <Text style={styles.statValue}>{totalWorkouts}</Text>
            <Text style={styles.statLabel}>Workouts</Text>
          </View>

          <View style={styles.statItem}>
            <Ionicons name="fitness" size={28} color={colors.accent} />
            <Text style={styles.statValue}>{formatVolume(totalVolume)}</Text>
            <Text style={styles.statLabel}>{settings.weightUnit} Lifted</Text>
          </View>

          <View style={styles.statItem}>
            <Ionicons name="walk" size={28} color={colors.primary} />
            <Text style={styles.statValue}>{totalRuns}</Text>
            <Text style={styles.statLabel}>Runs</Text>
          </View>

          <View style={styles.statItem}>
            <Ionicons name="map" size={28} color={colors.primary} />
            <Text style={styles.statValue}>{totalDistance.toFixed(0)}</Text>
            <Text style={styles.statLabel}>{settings.distanceUnit}</Text>
          </View>
        </View>
      </Card>

      {/* Menu Items */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Settings & Data</Text>

        {menuItems.map((item, index) => (
          <TouchableOpacity key={index} onPress={item.onPress}>
            <Card variant="outlined" style={styles.menuItem}>
              <View style={styles.menuItemContent}>
                <Ionicons name={item.icon} size={24} color={colors.textPrimary} />
                <View style={styles.menuItemText}>
                  <Text style={styles.menuItemTitle}>{item.title}</Text>
                  <Text style={styles.menuItemSubtitle}>{item.subtitle}</Text>
                </View>
              </View>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={colors.textSecondary}
              />
            </Card>
          </TouchableOpacity>
        ))}
      </View>

      {/* App Info */}
      <View style={styles.appInfo}>
        <Text style={styles.appName}>Big Fella Athleticcs</Text>
        <Text style={styles.appVersion}>Version 1.0.0</Text>
        <Text style={styles.appTagline}>
          Your data stays on your device. Always.
        </Text>
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
  statsCard: {
    marginBottom: spacing.lg,
  },
  cardTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
  },
  statItem: {
    width: '45%',
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  statValue: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    marginTop: spacing.xs,
  },
  statLabel: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
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
  },
  badgesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  badgeCard: {
    width: '31%',
    alignItems: 'center',
    padding: spacing.sm,
  },
  badgeName: {
    fontSize: fontSize.xs,
    color: colors.textPrimary,
    textAlign: 'center',
    marginTop: spacing.xs,
    fontWeight: fontWeight.medium,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  badgeCount: {
    fontSize: fontSize.md,
    color: colors.primary,
    fontWeight: fontWeight.bold,
  },
  subsectionTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  lockedSection: {
    marginTop: spacing.md,
  },
  lockedBadge: {
    opacity: 0.6,
  },
  lockedBadgeName: {
    color: colors.textSecondary,
  },
  badgeDescription: {
    fontSize: fontSize.xs,
    color: colors.textDisabled,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  moreBadgesText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.md,
    fontStyle: 'italic',
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
    gap: spacing.xs,
  },
  viewAllText: {
    fontSize: fontSize.sm,
    color: colors.primary,
    fontWeight: fontWeight.medium,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  menuItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  menuItemText: {
    flex: 1,
  },
  menuItemTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
    color: colors.textPrimary,
  },
  menuItemSubtitle: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  appInfo: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  appName: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  appVersion: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  appTagline: {
    fontSize: fontSize.xs,
    color: colors.textDisabled,
    marginTop: spacing.sm,
    fontStyle: 'italic',
  },
});

export default ProfileScreen;
