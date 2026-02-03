import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { colors } from '../theme/colors';
import { spacing, fontSize, fontWeight, borderRadius } from '../theme/spacing';
import { Card, Button } from '../components/common';
import { useSettings } from '../context/SettingsContext';
import { getAll } from '../database/database';

const DataExportScreen: React.FC = () => {
  const { settings } = useSettings();
  const [exporting, setExporting] = useState(false);

  const exportWorkouts = async () => {
    setExporting(true);
    try {
      // Fetch all workouts with exercises and sets
      const workouts = await getAll<any>('SELECT * FROM workouts ORDER BY date DESC');

      if (workouts.length === 0) {
        Alert.alert('No Data', 'No workouts to export.');
        return;
      }

      // Build CSV content
      let csv = 'Date,Exercise,Set,Weight,Reps,RPE,Is Warmup,Notes\n';

      for (const workout of workouts) {
        const exercises = await getAll<any>(
          'SELECT * FROM exercises WHERE workoutId = ? ORDER BY orderIndex',
          [workout.id]
        );

        for (const exercise of exercises) {
          const sets = await getAll<any>(
            'SELECT * FROM sets WHERE exerciseId = ? ORDER BY setNumber',
            [exercise.id]
          );

          for (const set of sets) {
            csv += `"${workout.date}","${exercise.exerciseName}",${set.setNumber},${set.weight},${set.reps},${set.rpe || ''},${set.isWarmup ? 'Yes' : 'No'},"${set.notes || ''}"\n`;
          }
        }
      }

      // Save and share
      const filename = `big-fella-workouts-${new Date().toISOString().split('T')[0]}.csv`;
      const filepath = `${FileSystem.documentDirectory}${filename}`;
      await FileSystem.writeAsStringAsync(filepath, csv, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(filepath, {
          mimeType: 'text/csv',
          dialogTitle: 'Export Workouts',
        });
      } else {
        Alert.alert('Success', `Exported ${workouts.length} workouts to ${filename}`);
      }
    } catch (error) {
      console.error('Export failed:', error);
      Alert.alert('Error', 'Failed to export workouts. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const exportRuns = async () => {
    setExporting(true);
    try {
      const runs = await getAll<any>('SELECT * FROM runs ORDER BY date DESC');

      if (runs.length === 0) {
        Alert.alert('No Data', 'No runs to export.');
        return;
      }

      let csv = `Date,Distance (${settings.distanceUnit}),Duration (seconds),Pace (min/${settings.distanceUnit}),Type,Route,Weather,Notes\n`;

      for (const run of runs) {
        csv += `"${run.date}",${run.distance},${run.duration},${run.pace.toFixed(2)},"${run.runType}","${run.routeName || ''}","${run.weather || ''}","${run.notes || ''}"\n`;
      }

      const filename = `big-fella-runs-${new Date().toISOString().split('T')[0]}.csv`;
      const filepath = `${FileSystem.documentDirectory}${filename}`;
      await FileSystem.writeAsStringAsync(filepath, csv, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(filepath, {
          mimeType: 'text/csv',
          dialogTitle: 'Export Runs',
        });
      } else {
        Alert.alert('Success', `Exported ${runs.length} runs to ${filename}`);
      }
    } catch (error) {
      console.error('Export failed:', error);
      Alert.alert('Error', 'Failed to export runs. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const exportAll = async () => {
    setExporting(true);
    try {
      // Export everything as JSON
      const workouts = await getAll<any>('SELECT * FROM workouts ORDER BY date DESC');
      const runs = await getAll<any>('SELECT * FROM runs ORDER BY date DESC');
      const streaks = await getAll<any>('SELECT * FROM streaks');
      const prs = await getAll<any>('SELECT * FROM personal_records');

      const exportData = {
        exportDate: new Date().toISOString(),
        appVersion: '1.0.0',
        workouts: [],
        runs,
        streaks,
        personalRecords: prs,
      };

      // Include full workout details
      for (const workout of workouts) {
        const exercises = await getAll<any>(
          'SELECT * FROM exercises WHERE workoutId = ?',
          [workout.id]
        );

        const fullExercises = [];
        for (const exercise of exercises) {
          const sets = await getAll<any>(
            'SELECT * FROM sets WHERE exerciseId = ?',
            [exercise.id]
          );
          fullExercises.push({ ...exercise, sets });
        }

        (exportData.workouts as any[]).push({ ...workout, exercises: fullExercises });
      }

      const filename = `big-fella-backup-${new Date().toISOString().split('T')[0]}.json`;
      const filepath = `${FileSystem.documentDirectory}${filename}`;
      await FileSystem.writeAsStringAsync(filepath, JSON.stringify(exportData, null, 2), {
        encoding: FileSystem.EncodingType.UTF8,
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(filepath, {
          mimeType: 'application/json',
          dialogTitle: 'Export All Data',
        });
      } else {
        Alert.alert('Success', `Exported all data to ${filename}`);
      }
    } catch (error) {
      console.error('Export failed:', error);
      Alert.alert('Error', 'Failed to export data. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Info Card */}
      <Card variant="elevated" style={styles.infoCard}>
        <Ionicons name="information-circle" size={32} color={colors.accent} />
        <Text style={styles.infoTitle}>Export Your Data</Text>
        <Text style={styles.infoText}>
          Your data belongs to you. Export your workouts and runs to CSV files
          or create a full JSON backup that can be imported later.
        </Text>
      </Card>

      {/* Export Options */}
      <Text style={styles.sectionTitle}>Export Options</Text>

      <Card variant="outlined" style={styles.exportCard}>
        <View style={styles.exportOption}>
          <View style={styles.exportIcon}>
            <Ionicons name="barbell" size={24} color={colors.accent} />
          </View>
          <View style={styles.exportInfo}>
            <Text style={styles.exportTitle}>Workouts (CSV)</Text>
            <Text style={styles.exportDescription}>
              Export all workout data including exercises, sets, weights, and reps
            </Text>
          </View>
        </View>
        <Button
          title="Export Workouts"
          onPress={exportWorkouts}
          variant="outline"
          size="small"
          loading={exporting}
        />
      </Card>

      <Card variant="outlined" style={styles.exportCard}>
        <View style={styles.exportOption}>
          <View style={styles.exportIcon}>
            <Ionicons name="walk" size={24} color={colors.primary} />
          </View>
          <View style={styles.exportInfo}>
            <Text style={styles.exportTitle}>Runs (CSV)</Text>
            <Text style={styles.exportDescription}>
              Export all run data including distance, duration, pace, and notes
            </Text>
          </View>
        </View>
        <Button
          title="Export Runs"
          onPress={exportRuns}
          variant="outline"
          size="small"
          loading={exporting}
        />
      </Card>

      <Card variant="outlined" style={styles.exportCard}>
        <View style={styles.exportOption}>
          <View style={styles.exportIcon}>
            <Ionicons name="download" size={24} color={colors.success} />
          </View>
          <View style={styles.exportInfo}>
            <Text style={styles.exportTitle}>Full Backup (JSON)</Text>
            <Text style={styles.exportDescription}>
              Complete backup of all data including streaks, personal records,
              and settings. Use this for device migration.
            </Text>
          </View>
        </View>
        <Button
          title="Export All"
          onPress={exportAll}
          variant="primary"
          size="small"
          loading={exporting}
        />
      </Card>

      {/* Privacy Note */}
      <Card variant="outlined" style={styles.privacyCard}>
        <Ionicons name="shield-checkmark" size={20} color={colors.success} />
        <Text style={styles.privacyText}>
          Exported files are saved locally to your device. Your data is never
          uploaded to any server.
        </Text>
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
  infoCard: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  infoTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
    marginTop: spacing.md,
  },
  infoText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 20,
  },
  sectionTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  exportCard: {
    marginBottom: spacing.md,
  },
  exportOption: {
    flexDirection: 'row',
    marginBottom: spacing.md,
  },
  exportIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  exportInfo: {
    flex: 1,
  },
  exportTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
    color: colors.textPrimary,
  },
  exportDescription: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    lineHeight: 18,
  },
  privacyCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: spacing.lg,
    backgroundColor: colors.successLight,
  },
  privacyText: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.textPrimary,
    marginLeft: spacing.sm,
    lineHeight: 18,
  },
});

export default DataExportScreen;
