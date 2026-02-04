import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { spacing, fontSize, fontWeight, borderRadius } from '../theme/spacing';
import { Card } from '../components/common';
import { useSettings } from '../context/SettingsContext';
import { seedDebugData, clearAllData } from '../utils/debugData';

const SettingsScreen: React.FC = () => {
  const { settings, updateSetting } = useSettings();
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const handleUnitChange = async (type: 'weight' | 'distance', value: string) => {
    setSaving(true);
    try {
      if (type === 'weight') {
        await updateSetting('weightUnit', value as 'lbs' | 'kg');
      } else {
        await updateSetting('distanceUnit', value as 'miles' | 'km');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update setting');
    } finally {
      setSaving(false);
    }
  };

  const handleNotificationToggle = async (
    type: 'runReminder' | 'workoutReminder',
    value: boolean
  ) => {
    setSaving(true);
    try {
      if (type === 'runReminder') {
        await updateSetting('runReminderEnabled', value);
      } else {
        await updateSetting('workoutReminderEnabled', value);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update setting');
    } finally {
      setSaving(false);
    }
  };

  const handleSeedDebugData = async () => {
    Alert.alert(
      'Seed Debug Data',
      'This will clear existing data and add test workouts, runs, and PRs. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Seed Data',
          style: 'destructive',
          onPress: async () => {
            setSeeding(true);
            try {
              await seedDebugData();
              Alert.alert('Success', 'Debug data has been seeded! Pull to refresh on Home screen.');
            } catch (error: any) {
              const errorMsg = error?.message || String(error);
              Alert.alert('Error', `Failed to seed debug data:\n\n${errorMsg}`);
              console.error('Seed error:', error);
            } finally {
              setSeeding(false);
            }
          },
        },
      ]
    );
  };

  const handleClearAllData = async () => {
    Alert.alert(
      'Clear All Data',
      'This will permanently delete all workouts, runs, streaks, and PRs. This cannot be undone!',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            setSeeding(true);
            try {
              await clearAllData();
              Alert.alert('Success', 'All data has been cleared!');
            } catch (error) {
              Alert.alert('Error', 'Failed to clear data');
              console.error(error);
            } finally {
              setSeeding(false);
            }
          },
        },
      ]
    );
  };

  const handleStreakMinChange = async (
    type: 'distance' | 'duration',
    value: number
  ) => {
    setSaving(true);
    try {
      if (type === 'distance') {
        await updateSetting('streakMinDistance', value);
      } else {
        await updateSetting('streakMinDuration', value);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update setting');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Units Section */}
      <Text style={styles.sectionTitle}>Units</Text>
      <Card variant="outlined" style={styles.card}>
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Weight Unit</Text>
          <View style={styles.segmentedControl}>
            {['lbs', 'kg'].map((unit) => (
              <TouchableOpacity
                key={unit}
                style={[
                  styles.segment,
                  settings.weightUnit === unit && styles.segmentActive,
                ]}
                onPress={() => handleUnitChange('weight', unit)}
              >
                <Text
                  style={[
                    styles.segmentText,
                    settings.weightUnit === unit && styles.segmentTextActive,
                  ]}
                >
                  {unit}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Distance Unit</Text>
          <View style={styles.segmentedControl}>
            {['miles', 'km'].map((unit) => (
              <TouchableOpacity
                key={unit}
                style={[
                  styles.segment,
                  settings.distanceUnit === unit && styles.segmentActive,
                ]}
                onPress={() => handleUnitChange('distance', unit)}
              >
                <Text
                  style={[
                    styles.segmentText,
                    settings.distanceUnit === unit && styles.segmentTextActive,
                  ]}
                >
                  {unit}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Card>

      {/* Streak Settings */}
      <Text style={styles.sectionTitle}>Streak Settings</Text>
      <Card variant="outlined" style={styles.card}>
        <View style={styles.settingRow}>
          <View style={styles.settingLabelContainer}>
            <Text style={styles.settingLabel}>Minimum Distance</Text>
            <Text style={styles.settingDescription}>
              Minimum distance required for a run to count toward your streak
            </Text>
          </View>
          <View style={styles.segmentedControl}>
            {[0, 1, 2].map((value) => (
              <TouchableOpacity
                key={value}
                style={[
                  styles.segment,
                  settings.streakMinDistance === value && styles.segmentActive,
                ]}
                onPress={() => handleStreakMinChange('distance', value)}
              >
                <Text
                  style={[
                    styles.segmentText,
                    settings.streakMinDistance === value && styles.segmentTextActive,
                  ]}
                >
                  {value === 0 ? 'Any' : `${value} ${settings.distanceUnit}`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.settingRow}>
          <View style={styles.settingLabelContainer}>
            <Text style={styles.settingLabel}>Minimum Duration</Text>
            <Text style={styles.settingDescription}>
              Minimum duration required for a run to count
            </Text>
          </View>
          <View style={styles.segmentedControl}>
            {[0, 10, 20].map((value) => (
              <TouchableOpacity
                key={value}
                style={[
                  styles.segment,
                  settings.streakMinDuration === value && styles.segmentActive,
                ]}
                onPress={() => handleStreakMinChange('duration', value)}
              >
                <Text
                  style={[
                    styles.segmentText,
                    settings.streakMinDuration === value && styles.segmentTextActive,
                  ]}
                >
                  {value === 0 ? 'Any' : `${value}m`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Card>

      {/* Notifications */}
      <Text style={styles.sectionTitle}>Notifications</Text>
      <Card variant="outlined" style={styles.card}>
        <View style={styles.settingRow}>
          <View style={styles.settingLabelContainer}>
            <Text style={styles.settingLabel}>Run Reminder</Text>
            <Text style={styles.settingDescription}>
              Get reminded if you haven't logged a run today
            </Text>
          </View>
          <Switch
            value={settings.runReminderEnabled}
            onValueChange={(value) =>
              handleNotificationToggle('runReminder', value)
            }
            trackColor={{ false: colors.border, true: colors.primaryLight }}
            thumbColor={settings.runReminderEnabled ? colors.primary : colors.textDisabled}
          />
        </View>

        <View style={styles.divider} />

        <View style={styles.settingRow}>
          <View style={styles.settingLabelContainer}>
            <Text style={styles.settingLabel}>Workout Reminder</Text>
            <Text style={styles.settingDescription}>
              Get reminded on scheduled workout days
            </Text>
          </View>
          <Switch
            value={settings.workoutReminderEnabled}
            onValueChange={(value) =>
              handleNotificationToggle('workoutReminder', value)
            }
            trackColor={{ false: colors.border, true: colors.primaryLight }}
            thumbColor={settings.workoutReminderEnabled ? colors.primary : colors.textDisabled}
          />
        </View>
      </Card>

      {/* Privacy Section */}
      <Text style={styles.sectionTitle}>Privacy</Text>
      <Card variant="outlined" style={styles.card}>
        <View style={styles.infoRow}>
          <Ionicons name="shield-checkmark" size={24} color={colors.success} />
          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>Your Data is Private</Text>
            <Text style={styles.infoDescription}>
              All your workout and run data is stored locally on your device.
              We never collect, transmit, or store your data on any server.
              Your fitness journey is 100% private.
            </Text>
          </View>
        </View>
      </Card>

      {/* Debug Mode (only in __DEV__) */}
      {__DEV__ && (
        <>
          <Text style={styles.sectionTitle}>DEBUG MODE</Text>
          <Card variant="outlined" style={styles.card}>
            <TouchableOpacity
              style={styles.debugButton}
              onPress={handleSeedDebugData}
              disabled={seeding}
            >
              <View style={styles.debugButtonContent}>
                <Ionicons name="flask" size={24} color={colors.primary} />
                <View style={styles.debugButtonText}>
                  <Text style={styles.settingLabel}>Seed Test Data</Text>
                  <Text style={styles.settingDescription}>
                    Add sample workouts, runs, and PRs for testing
                  </Text>
                </View>
              </View>
              {seeding && <ActivityIndicator color={colors.primary} />}
            </TouchableOpacity>

            <View style={styles.divider} />

            <TouchableOpacity
              style={styles.debugButton}
              onPress={handleClearAllData}
              disabled={seeding}
            >
              <View style={styles.debugButtonContent}>
                <Ionicons name="trash" size={24} color={colors.error} />
                <View style={styles.debugButtonText}>
                  <Text style={[styles.settingLabel, { color: colors.error }]}>
                    Clear All Data
                  </Text>
                  <Text style={styles.settingDescription}>
                    Delete all workouts, runs, and progress
                  </Text>
                </View>
              </View>
              {seeding && <ActivityIndicator color={colors.error} />}
            </TouchableOpacity>
          </Card>
        </>
      )}

      {/* App Info */}
      <Card variant="outlined" style={styles.card}>
        <View style={styles.infoRow}>
          <Ionicons name="information-circle" size={24} color={colors.accent} />
          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>Athleticcs | Forge</Text>
            <Text style={styles.infoDescription}>
              Version 1.0.0{'\n'}
              Built with React Native + Expo{'\n'}
              Local-first fitness tracking
            </Text>
          </View>
        </View>
      </Card>
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
  sectionTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    marginLeft: spacing.sm,
  },
  card: {
    marginBottom: spacing.md,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  settingLabelContainer: {
    flex: 1,
    marginRight: spacing.md,
  },
  settingLabel: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
    color: colors.textPrimary,
  },
  settingDescription: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    padding: 2,
  },
  segment: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md - 2,
  },
  segmentActive: {
    backgroundColor: colors.primary,
  },
  segmentText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  segmentTextActive: {
    color: colors.white,
    fontWeight: fontWeight.medium,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  infoContent: {
    flex: 1,
    marginLeft: spacing.md,
  },
  infoTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
    color: colors.textPrimary,
  },
  infoDescription: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    lineHeight: 20,
  },
  debugButton: {
    paddingVertical: spacing.md,
  },
  debugButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  debugButtonText: {
    flex: 1,
    marginLeft: spacing.md,
  },
});

export default SettingsScreen;
