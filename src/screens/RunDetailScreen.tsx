import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { spacing, fontSize, fontWeight, borderRadius } from '../theme/spacing';
import { Card, Button } from '../components/common';
import { RootStackParamList, Run } from '../types';
import { useSettings } from '../context/SettingsContext';
import { getRunById, deleteRun, formatPace, formatDuration } from '../services/runService';
import { parseLocalDate } from '../utils/date';

type RouteProps = RouteProp<RootStackParamList, 'RunDetail'>;

const RunDetailScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<RouteProps>();
  const { settings } = useSettings();
  const { runId } = route.params;

  const [run, setRun] = useState<Run | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRun();
  }, [runId]);

  const loadRun = async () => {
    try {
      const data = await getRunById(runId);
      setRun(data);
    } catch (error) {
      console.error('Failed to load run:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Run',
      'Are you sure you want to delete this run? This may affect your streak.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteRun(runId);
            navigation.goBack();
          },
        },
      ]
    );
  };

  if (loading || !run) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header Card */}
      <Card variant="elevated" style={styles.headerCard}>
        <Text style={styles.date}>
          {parseLocalDate(run.date).toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </Text>

        <View style={styles.badgeRow}>
          {run.runType && (
            <View style={styles.runTypeBadge}>
              <Text style={styles.runTypeText}>
                {run.runType === 'walk' ? 'Walk' : `${run.runType.charAt(0).toUpperCase() + run.runType.slice(1)} Run`}
              </Text>
            </View>
          )}
          {run.notes === 'Synced from Apple Health' && (
            <View style={styles.healthBadge}>
              <Ionicons name="heart" size={12} color="#FF2D55" />
              <Text style={styles.healthBadgeText}>Apple Health</Text>
            </View>
          )}
        </View>
      </Card>

      {/* Main Stats */}
      <View style={styles.statsGrid}>
        <Card variant="outlined" style={styles.statCard}>
          <Ionicons name="map" size={28} color={colors.primary} />
          <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
            {run.distance.toFixed(2)}
          </Text>
          <Text style={styles.statLabel}>{settings.distanceUnit}</Text>
        </Card>

        <Card variant="outlined" style={styles.statCard}>
          <Ionicons name="time" size={28} color={colors.primary} />
          <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
            {formatDuration(run.duration)}
          </Text>
          <Text style={styles.statLabel}>Duration</Text>
        </Card>

        <Card variant="outlined" style={styles.statCard}>
          <Ionicons name="speedometer" size={28} color={colors.primary} />
          <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
            {formatPace(run.pace)}
          </Text>
          <Text style={styles.statLabel}>
            /{settings.distanceUnit === 'miles' ? 'mi' : 'km'}
          </Text>
        </Card>
      </View>

      {/* Details */}
      <Card variant="outlined" style={styles.detailsCard}>
        <Text style={styles.sectionTitle}>Details</Text>

        {run.routeName && (
          <View style={styles.detailRow}>
            <Ionicons name="location" size={20} color={colors.textSecondary} />
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Route</Text>
              <Text style={styles.detailValue}>{run.routeName}</Text>
            </View>
          </View>
        )}

        {run.weather && (
          <View style={styles.detailRow}>
            <Ionicons name="cloud" size={20} color={colors.textSecondary} />
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Weather</Text>
              <Text style={styles.detailValue}>{run.weather}</Text>
            </View>
          </View>
        )}

        <View style={styles.detailRow}>
          <Ionicons name="calendar" size={20} color={colors.textSecondary} />
          <View style={styles.detailContent}>
            <Text style={styles.detailLabel}>Logged</Text>
            <Text style={styles.detailValue}>
              {new Date(run.createdAt).toLocaleString()}
            </Text>
          </View>
        </View>
      </Card>

      {/* Notes */}
      {run.notes && (
        <Card variant="outlined" style={styles.notesCard}>
          <Text style={styles.sectionTitle}>Notes</Text>
          <Text style={styles.notesText}>{run.notes}</Text>
        </Card>
      )}

      {/* Delete Button */}
      <Button
        title="Delete Run"
        onPress={handleDelete}
        variant="outline"
        style={styles.deleteButton}
        textStyle={styles.deleteButtonText}
      />
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
  date: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  runTypeBadge: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  runTypeText: {
    fontSize: fontSize.sm,
    color: colors.primaryDark,
    fontWeight: fontWeight.medium,
  },
  healthBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(255, 45, 85, 0.15)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  healthBadgeText: {
    fontSize: fontSize.sm,
    color: '#FF2D55',
    fontWeight: fontWeight.medium,
  },
  statsGrid: {
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
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    marginTop: spacing.sm,
  },
  statLabel: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  detailsCard: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  detailContent: {
    flex: 1,
    marginLeft: spacing.md,
  },
  detailLabel: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
  detailValue: {
    fontSize: fontSize.md,
    color: colors.textPrimary,
    marginTop: spacing.xs,
  },
  notesCard: {
    marginBottom: spacing.lg,
  },
  notesText: {
    fontSize: fontSize.md,
    color: colors.textPrimary,
    lineHeight: 22,
  },
  deleteButton: {
    marginTop: spacing.lg,
    marginBottom: spacing.xl,
    borderColor: colors.error,
  },
  deleteButtonText: {
    color: colors.error,
  },
});

export default RunDetailScreen;
