import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors } from '../theme/colors';
import { spacing, fontSize, fontWeight, borderRadius, touchTarget } from '../theme/spacing';
import { Card, Button, Input } from '../components/common';
import { RootStackParamList, RunType } from '../types';
import { useSettings } from '../context/SettingsContext';
import { createRun } from '../services/runService';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const RUN_TYPES: { value: RunType; label: string; icon: string }[] = [
  { value: 'easy', label: 'Easy', icon: 'walk-outline' },
  { value: 'tempo', label: 'Tempo', icon: 'speedometer-outline' },
  { value: 'intervals', label: 'Intervals', icon: 'timer-outline' },
  { value: 'long', label: 'Long', icon: 'map-outline' },
  { value: 'recovery', label: 'Recovery', icon: 'heart-outline' },
  { value: 'race', label: 'Race', icon: 'trophy-outline' },
];

const LogRunScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const { settings } = useSettings();

  const [distance, setDistance] = useState('');
  const [hours, setHours] = useState('');
  const [minutes, setMinutes] = useState('');
  const [seconds, setSeconds] = useState('');
  const [runType, setRunType] = useState<RunType>('easy');
  const [routeName, setRouteName] = useState('');
  const [weather, setWeather] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const calculatePace = (): string => {
    const dist = parseFloat(distance);
    const totalSeconds =
      (parseInt(hours) || 0) * 3600 +
      (parseInt(minutes) || 0) * 60 +
      (parseInt(seconds) || 0);

    if (!dist || !totalSeconds) return '--:--';

    const paceSeconds = totalSeconds / dist;
    const paceMins = Math.floor(paceSeconds / 60);
    const paceSecs = Math.round(paceSeconds % 60);

    return `${paceMins}:${String(paceSecs).padStart(2, '0')}`;
  };

  const saveRun = async () => {
    const dist = parseFloat(distance);
    const totalSeconds =
      (parseInt(hours) || 0) * 3600 +
      (parseInt(minutes) || 0) * 60 +
      (parseInt(seconds) || 0);

    if (!dist || dist <= 0) {
      Alert.alert('Invalid Distance', 'Please enter a valid distance.');
      return;
    }

    if (!totalSeconds || totalSeconds <= 0) {
      Alert.alert('Invalid Duration', 'Please enter a valid duration.');
      return;
    }

    setSaving(true);
    try {
      await createRun(
        dist,
        totalSeconds,
        runType,
        routeName || undefined,
        weather || undefined,
        notes || undefined
      );

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      navigation.goBack();
    } catch (error) {
      console.error('Failed to save run:', error);
      Alert.alert('Error', 'Failed to save run. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content}>
        {/* Distance Input */}
        <Card variant="outlined" style={styles.inputCard}>
          <Text style={styles.inputLabel}>Distance</Text>
          <View style={styles.distanceRow}>
            <Input
              containerStyle={styles.distanceInput}
              value={distance}
              onChangeText={setDistance}
              keyboardType="decimal-pad"
              placeholder="0.00"
            />
            <Text style={styles.unitLabel}>{settings.distanceUnit}</Text>
          </View>
        </Card>

        {/* Duration Input */}
        <Card variant="outlined" style={styles.inputCard}>
          <Text style={styles.inputLabel}>Duration</Text>
          <View style={styles.durationRow}>
            <View style={styles.durationInput}>
              <Input
                containerStyle={styles.timeInput}
                value={hours}
                onChangeText={setHours}
                keyboardType="number-pad"
                placeholder="0"
                maxLength={2}
              />
              <Text style={styles.timeLabel}>hr</Text>
            </View>
            <View style={styles.durationInput}>
              <Input
                containerStyle={styles.timeInput}
                value={minutes}
                onChangeText={setMinutes}
                keyboardType="number-pad"
                placeholder="0"
                maxLength={2}
              />
              <Text style={styles.timeLabel}>min</Text>
            </View>
            <View style={styles.durationInput}>
              <Input
                containerStyle={styles.timeInput}
                value={seconds}
                onChangeText={setSeconds}
                keyboardType="number-pad"
                placeholder="0"
                maxLength={2}
              />
              <Text style={styles.timeLabel}>sec</Text>
            </View>
          </View>
        </Card>

        {/* Calculated Pace */}
        <Card variant="elevated" style={styles.paceCard}>
          <Text style={styles.paceLabel}>Pace</Text>
          <Text style={styles.paceValue}>
            {calculatePace()} /{settings.distanceUnit === 'miles' ? 'mi' : 'km'}
          </Text>
        </Card>

        {/* Run Type Selector */}
        <Card variant="outlined" style={styles.inputCard}>
          <Text style={styles.inputLabel}>Run Type</Text>
          <View style={styles.runTypeGrid}>
            {RUN_TYPES.map((type) => (
              <TouchableOpacity
                key={type.value}
                style={[
                  styles.runTypeButton,
                  runType === type.value && styles.runTypeButtonActive,
                ]}
                onPress={() => setRunType(type.value)}
              >
                <Ionicons
                  name={type.icon as any}
                  size={20}
                  color={runType === type.value ? colors.white : colors.textSecondary}
                />
                <Text
                  style={[
                    styles.runTypeLabel,
                    runType === type.value && styles.runTypeLabelActive,
                  ]}
                >
                  {type.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Card>

        {/* Optional Fields */}
        <Card variant="outlined" style={styles.inputCard}>
          <Text style={styles.inputLabel}>Route Name (optional)</Text>
          <Input
            containerStyle={styles.optionalInput}
            value={routeName}
            onChangeText={setRouteName}
            placeholder="e.g., Neighborhood Loop"
          />
        </Card>

        <Card variant="outlined" style={styles.inputCard}>
          <Text style={styles.inputLabel}>Weather (optional)</Text>
          <Input
            containerStyle={styles.optionalInput}
            value={weather}
            onChangeText={setWeather}
            placeholder="e.g., Sunny, 72°F"
          />
        </Card>

        <Card variant="outlined" style={styles.inputCard}>
          <Text style={styles.inputLabel}>Notes (optional)</Text>
          <Input
            containerStyle={styles.optionalInput}
            value={notes}
            onChangeText={setNotes}
            placeholder="How did the run feel?"
            multiline
            numberOfLines={3}
            style={styles.notesInput}
          />
        </Card>
      </ScrollView>

      {/* Save Button */}
      <View style={styles.footer}>
        <Button title="Save Run" onPress={saveRun} loading={saving} size="large" />
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
    paddingBottom: 100,
  },
  inputCard: {
    marginBottom: spacing.md,
  },
  inputLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  distanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  distanceInput: {
    flex: 1,
    marginBottom: 0,
  },
  unitLabel: {
    fontSize: fontSize.lg,
    color: colors.textSecondary,
    marginLeft: spacing.md,
  },
  durationRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  durationInput: {
    flex: 1,
    alignItems: 'center',
  },
  timeInput: {
    marginBottom: 0,
  },
  timeLabel: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  paceCard: {
    alignItems: 'center',
    marginBottom: spacing.md,
    backgroundColor: colors.primaryLight,
  },
  paceLabel: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  paceValue: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    color: colors.primary,
    marginTop: spacing.xs,
  },
  runTypeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  runTypeButton: {
    width: '31%',
    flexDirection: 'column',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  runTypeButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  runTypeLabel: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  runTypeLabelActive: {
    color: colors.white,
  },
  optionalInput: {
    marginBottom: 0,
  },
  notesInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
});

export default LogRunScreen;
