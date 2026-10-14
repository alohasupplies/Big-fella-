import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { RootStackParamList, Workout, WorkoutTemplate } from '../types';
import { useSettings } from '../context/SettingsContext';
import {
  calculateWorkoutVolume,
  getRecentWorkouts,
  getTotalWorkoutCount,
  getWeeklyVolume,
} from '../services/workoutService';
import { deleteTemplate, getTemplates } from '../services/templateService';
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

  const loadData = useCallback(async () => {
    try {
      const [recentWorkouts, volume, count, loadedTemplates] = await Promise.all([
        getRecentWorkouts(10),
        getWeeklyVolume(),
        getTotalWorkoutCount(),
        getTemplates(),
      ]);
      setWorkouts(recentWorkouts);
      setWeeklyVolume(volume);
      setTotalWorkouts(count);
      setTemplates(loadedTemplates);
    } catch (error) {
      console.error('Failed to load lift data:', error);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const builtInTemplates = useMemo(
    () => templates.filter((template) => template.isBuiltIn),
    [templates]
  );
  const customTemplates = useMemo(
    () => templates.filter((template) => !template.isBuiltIn),
    [templates]
  );
  const weekStart = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const sessionsThisWeek = workouts.filter(
    (workout) => parseLocalDate(workout.date).getTime() >= weekStart
  ).length;

  const formatVolume = (volume: number): string => {
    if (volume >= 1000000) return `${(volume / 1000000).toFixed(1)}M`;
    if (volume >= 1000) return `${(volume / 1000).toFixed(1)}K`;
    return Math.round(volume).toLocaleString();
  };

  const formatMuscles = (muscles: string[]): string => Array.from(new Set(muscles))
    .slice(0, 3)
    .map((muscle) => muscle.charAt(0).toUpperCase() + muscle.slice(1).replace('_', ' '))
    .join(' · ');

  const getWorkoutMuscles = (workout: Workout) => formatMuscles(
    workout.exercises.flatMap((exercise) => exercise.muscleGroups)
  );

  const getTemplateMuscles = (template: WorkoutTemplate) => formatMuscles(
    template.exercises.flatMap((exercise) => exercise.muscleGroups)
  );

  const openTemplate = (template: WorkoutTemplate) => {
    navigation.navigate('LogWorkout', { templateId: template.id });
  };

  const handleDeleteTemplate = (template: WorkoutTemplate) => {
    if (template.isBuiltIn) return;
    Alert.alert('Delete template?', `“${template.name}” will be removed from your templates.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteTemplate(template.id);
          setTemplates((current) => current.filter((item) => item.id !== template.id));
        },
      },
    ]);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primaryLight} />}
    >
      <View style={styles.hero}>
        <View style={styles.heroGlow} />
        <Text style={styles.eyebrow}>STRENGTH TRAINING</Text>
        <Text style={styles.heroTitle}>Build strength.{`\n`}Track every rep.</Text>
        <Text style={styles.heroCopy}>Start from scratch or choose a research-guided session.</Text>
        <TouchableOpacity
          style={styles.startButton}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('LogWorkout', {})}
        >
          <View style={styles.startIcon}>
            <Ionicons name="add" size={25} color={colors.white} />
          </View>
          <View style={styles.startCopy}>
            <Text style={styles.startTitle}>Start a workout</Text>
            <Text style={styles.startSub}>Build your own session</Text>
          </View>
          <Ionicons name="arrow-forward" size={22} color={colors.white} />
        </TouchableOpacity>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Ionicons name="trending-up" size={17} color={colors.primaryLight} />
          <Text style={styles.statValue}>{formatVolume(weeklyVolume)}</Text>
          <Text style={styles.statLabel}>{settings.weightUnit} THIS WEEK</Text>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="calendar-outline" size={17} color={colors.primaryLight} />
          <Text style={styles.statValue}>{sessionsThisWeek}</Text>
          <Text style={styles.statLabel}>SESSIONS / 7 DAYS</Text>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="trophy-outline" size={17} color={colors.primaryLight} />
          <Text style={styles.statValue}>{totalWorkouts}</Text>
          <Text style={styles.statLabel}>ALL-TIME LIFTS</Text>
        </View>
      </View>

      <View style={styles.sectionHeader}>
        <View style={styles.sectionHeadingCopy}>
          <Text style={styles.sectionKicker}>READY TO TRAIN</Text>
          <Text style={styles.sectionTitle}>Coach-built templates</Text>
          <Text style={styles.sectionSubtitle}>Evidence-based starting points. Choose a load that fits your level.</Text>
        </View>
        <View style={styles.researchBadge}>
          <Ionicons name="flask-outline" size={14} color={colors.primaryLight} />
          <Text style={styles.researchText}>Research guided</Text>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.programRow}>
        {builtInTemplates.map((template, index) => (
          <TouchableOpacity key={template.id} style={styles.programCard} activeOpacity={0.82} onPress={() => openTemplate(template)}>
            <View style={styles.programAccent} />
            <View style={styles.programTopRow}>
              <View style={styles.programIcon}>
                <Ionicons
                  name={index < 2 ? 'fitness-outline' : index < 4 ? 'barbell-outline' : 'flash-outline'}
                  size={21}
                  color={colors.white}
                />
              </View>
              <View style={styles.levelBadge}>
                <Text style={styles.levelText}>{template.level?.toUpperCase()}</Text>
              </View>
            </View>
            <Text style={styles.programName}>{template.name}</Text>
            <Text style={styles.programDescription} numberOfLines={2}>{template.description}</Text>
            <Text style={styles.programMeta}>{template.exercises.length} exercises  ·  {template.schedule}</Text>
            <View style={styles.exerciseDots}>
              {template.exercises.slice(0, 3).map((exercise) => (
                <View key={exercise.id} style={styles.exerciseDotRow}>
                  <View style={styles.exerciseDot} />
                  <Text style={styles.programExercise} numberOfLines={1}>{exercise.exerciseName}</Text>
                </View>
              ))}
            </View>
            <View style={styles.programAction}>
              <Text style={styles.programActionText}>Start template</Text>
              <Ionicons name="arrow-forward" size={17} color={colors.primaryLight} />
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.section}>
        <View style={styles.simpleHeader}>
          <View>
            <Text style={styles.sectionKicker}>MAKE IT YOURS</Text>
            <Text style={styles.sectionTitle}>Your templates</Text>
          </View>
          <TouchableOpacity style={styles.createButton} onPress={() => navigation.navigate('LogWorkout', {})}>
            <Ionicons name="add" size={17} color={colors.white} />
            <Text style={styles.createText}>Create</Text>
          </TouchableOpacity>
        </View>

        {customTemplates.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.customRow}>
            {customTemplates.map((template) => (
              <TouchableOpacity
                key={template.id}
                style={styles.customCard}
                onPress={() => openTemplate(template)}
                onLongPress={() => handleDeleteTemplate(template)}
                activeOpacity={0.82}
              >
                <View style={styles.customIcon}>
                  <Ionicons name="bookmark-outline" size={20} color={colors.primaryLight} />
                </View>
                <Text style={styles.customName} numberOfLines={1}>{template.name}</Text>
                <Text style={styles.customMeta}>{template.exercises.length} exercises</Text>
                <Text style={styles.customMuscles} numberOfLines={1}>{getTemplateMuscles(template)}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : (
          <TouchableOpacity style={styles.emptyTemplate} onPress={() => navigation.navigate('LogWorkout', {})}>
            <View style={styles.emptyTemplateIcon}>
              <Ionicons name="bookmark-outline" size={22} color={colors.primaryLight} />
            </View>
            <View style={styles.emptyTemplateCopy}>
              <Text style={styles.emptyTemplateTitle}>Save your go-to routine</Text>
              <Text style={styles.emptyTemplateText}>Build a workout, then tap “Save as Template.”</Text>
            </View>
            <Ionicons name="chevron-forward" size={19} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.section}>
        <View style={styles.simpleHeader}>
          <View>
            <Text style={styles.sectionKicker}>YOUR TRAINING</Text>
            <Text style={styles.sectionTitle}>Recent workouts</Text>
          </View>
        </View>

        {workouts.length === 0 ? (
          <View style={styles.emptyWorkout}>
            <View style={styles.emptyWorkoutIcon}>
              <Ionicons name="barbell-outline" size={28} color={colors.textSecondary} />
            </View>
            <Text style={styles.emptyWorkoutTitle}>Your first set starts here</Text>
            <Text style={styles.emptyWorkoutText}>Log a workout and your history, volume, and progress will appear here.</Text>
          </View>
        ) : workouts.map((workout) => {
          const date = parseLocalDate(workout.date);
          const setCount = workout.exercises.reduce((total, exercise) => total + exercise.sets.length, 0);
          return (
            <TouchableOpacity
              key={workout.id}
              style={styles.workoutCard}
              activeOpacity={0.82}
              onPress={() => navigation.navigate('WorkoutDetail', { workoutId: workout.id })}
            >
              <View style={styles.workoutHeader}>
                <View style={styles.dateBadge}>
                  <Text style={styles.dateMonth}>{date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}</Text>
                  <Text style={styles.dateDay}>{date.getDate()}</Text>
                </View>
                <View style={styles.workoutHeading}>
                  <Text style={styles.workoutName}>{date.toLocaleDateString('en-US', { weekday: 'long' })} Lift</Text>
                  <Text style={styles.workoutMuscles} numberOfLines={1}>{getWorkoutMuscles(workout) || 'Strength training'}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
              </View>
              <View style={styles.workoutMetrics}>
                <View style={styles.metric}>
                  <Text style={styles.metricValue}>{workout.exercises.length}</Text>
                  <Text style={styles.metricLabel}>EXERCISES</Text>
                </View>
                <View style={styles.metricDivider} />
                <View style={styles.metric}>
                  <Text style={styles.metricValue}>{setCount}</Text>
                  <Text style={styles.metricLabel}>SETS</Text>
                </View>
                <View style={styles.metricDivider} />
                <View style={styles.metric}>
                  <Text style={styles.metricValue}>{formatVolume(calculateWorkoutVolume(workout))}</Text>
                  <Text style={styles.metricLabel}>VOLUME {settings.weightUnit.toUpperCase()}</Text>
                </View>
              </View>
              <View style={styles.exerciseChips}>
                {workout.exercises.slice(0, 3).map((exercise) => (
                  <View key={exercise.id} style={styles.exerciseChip}>
                    <Text style={styles.exerciseChipText} numberOfLines={1}>{exercise.exerciseName}</Text>
                  </View>
                ))}
                {workout.exercises.length > 3 && (
                  <View style={styles.moreChip}><Text style={styles.moreChipText}>+{workout.exercises.length - 3}</Text></View>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: 36 },
  hero: { margin: 16, marginBottom: 12, padding: 22, borderRadius: 26, backgroundColor: '#170303', borderWidth: 1, borderColor: '#4A0909', overflow: 'hidden' },
  heroGlow: { position: 'absolute', width: 210, height: 210, borderRadius: 105, backgroundColor: '#5E0505', opacity: 0.5, right: -78, top: -92 },
  eyebrow: { color: colors.primaryLight, fontSize: 11, lineHeight: 14, fontWeight: '900', letterSpacing: 2.2 },
  heroTitle: { color: colors.white, fontSize: 34, lineHeight: 37, fontWeight: '900', letterSpacing: -1.2, marginTop: 9 },
  heroCopy: { color: '#C9BDBD', fontSize: 14, lineHeight: 20, marginTop: 10, maxWidth: 290 },
  startButton: { height: 68, borderRadius: 18, backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, marginTop: 20 },
  startIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: 'rgba(0,0,0,.2)', alignItems: 'center', justifyContent: 'center' },
  startCopy: { flex: 1, marginLeft: 12 },
  startTitle: { color: colors.white, fontSize: 17, fontWeight: '900' },
  startSub: { color: 'rgba(255,255,255,.76)', fontSize: 12, marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 28 },
  statCard: { flex: 1, minHeight: 106, borderRadius: 17, backgroundColor: '#151515', borderWidth: 1, borderColor: '#292929', padding: 12 },
  statValue: { color: colors.white, fontSize: 24, fontWeight: '900', letterSpacing: -0.8, marginTop: 10 },
  statLabel: { color: colors.textSecondary, fontSize: 8, lineHeight: 11, fontWeight: '800', letterSpacing: 0.8, marginTop: 4 },
  section: { marginTop: 28, paddingHorizontal: 16 },
  sectionHeader: { paddingHorizontal: 16, marginBottom: 14 },
  sectionHeadingCopy: { maxWidth: 320 },
  sectionKicker: { color: colors.primaryLight, fontSize: 10, fontWeight: '900', letterSpacing: 1.8, marginBottom: 5 },
  sectionTitle: { color: colors.white, fontSize: 24, fontWeight: '900', letterSpacing: -0.6 },
  sectionSubtitle: { color: colors.textSecondary, fontSize: 12, lineHeight: 17, marginTop: 6 },
  researchBadge: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, backgroundColor: '#210505', borderWidth: 1, borderColor: '#4A0909', paddingHorizontal: 10, paddingVertical: 7, marginTop: 11 },
  researchText: { color: '#E4C6C6', fontSize: 10, fontWeight: '800' },
  programRow: { paddingHorizontal: 16, gap: 12, paddingBottom: 4 },
  programCard: { width: 278, minHeight: 326, borderRadius: 22, padding: 18, backgroundColor: '#151515', borderWidth: 1, borderColor: '#303030', overflow: 'hidden' },
  programAccent: { position: 'absolute', top: 0, left: 0, right: 0, height: 4, backgroundColor: colors.primary },
  programTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  programIcon: { width: 40, height: 40, borderRadius: 13, backgroundColor: '#330707', alignItems: 'center', justifyContent: 'center' },
  levelBadge: { borderRadius: 999, backgroundColor: '#232323', paddingHorizontal: 9, paddingVertical: 6 },
  levelText: { color: '#D5D5D5', fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  programName: { color: colors.white, fontSize: 23, fontWeight: '900', letterSpacing: -0.5, marginTop: 16 },
  programDescription: { color: colors.textSecondary, fontSize: 12, lineHeight: 17, marginTop: 6, minHeight: 34 },
  programMeta: { color: '#E7E7E7', fontSize: 11, fontWeight: '800', marginTop: 12 },
  exerciseDots: { gap: 7, marginTop: 14 },
  exerciseDotRow: { flexDirection: 'row', alignItems: 'center' },
  exerciseDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.primaryLight, marginRight: 8 },
  programExercise: { color: '#C5C5C5', fontSize: 11, flex: 1 },
  programAction: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', paddingTop: 15, borderTopWidth: 1, borderTopColor: '#292929' },
  programActionText: { color: colors.white, fontSize: 12, fontWeight: '900' },
  simpleHeader: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 14 },
  createButton: { height: 34, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.primary, paddingHorizontal: 11 },
  createText: { color: colors.white, fontSize: 12, fontWeight: '900' },
  customRow: { gap: 10 },
  customCard: { width: 174, borderRadius: 18, backgroundColor: '#151515', borderWidth: 1, borderColor: '#303030', padding: 15 },
  customIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#2B0606', alignItems: 'center', justifyContent: 'center', marginBottom: 13 },
  customName: { color: colors.white, fontSize: 15, fontWeight: '900' },
  customMeta: { color: colors.textSecondary, fontSize: 11, marginTop: 5 },
  customMuscles: { color: colors.primaryLight, fontSize: 10, fontWeight: '700', marginTop: 8 },
  emptyTemplate: { minHeight: 82, borderRadius: 18, backgroundColor: '#151515', borderWidth: 1, borderColor: '#303030', flexDirection: 'row', alignItems: 'center', padding: 14 },
  emptyTemplateIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#2B0606', alignItems: 'center', justifyContent: 'center' },
  emptyTemplateCopy: { flex: 1, marginLeft: 12 },
  emptyTemplateTitle: { color: colors.white, fontSize: 14, fontWeight: '900' },
  emptyTemplateText: { color: colors.textSecondary, fontSize: 11, lineHeight: 15, marginTop: 3 },
  emptyWorkout: { borderRadius: 22, borderWidth: 1, borderColor: '#303030', backgroundColor: '#151515', alignItems: 'center', padding: 28 },
  emptyWorkoutIcon: { width: 58, height: 58, borderRadius: 20, backgroundColor: '#222', alignItems: 'center', justifyContent: 'center' },
  emptyWorkoutTitle: { color: colors.white, fontSize: 17, fontWeight: '900', marginTop: 14 },
  emptyWorkoutText: { color: colors.textSecondary, textAlign: 'center', fontSize: 12, lineHeight: 17, marginTop: 6, maxWidth: 280 },
  workoutCard: { borderRadius: 22, backgroundColor: '#151515', borderWidth: 1, borderColor: '#303030', padding: 15, marginBottom: 12 },
  workoutHeader: { flexDirection: 'row', alignItems: 'center' },
  dateBadge: { width: 49, height: 54, borderRadius: 14, backgroundColor: '#2B0606', alignItems: 'center', justifyContent: 'center' },
  dateMonth: { color: colors.primaryLight, fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  dateDay: { color: colors.white, fontSize: 20, fontWeight: '900', lineHeight: 23 },
  workoutHeading: { flex: 1, marginLeft: 12 },
  workoutName: { color: colors.white, fontSize: 16, fontWeight: '900' },
  workoutMuscles: { color: colors.textSecondary, fontSize: 11, marginTop: 4 },
  workoutMetrics: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#292929', paddingVertical: 13, marginTop: 14 },
  metric: { flex: 1, alignItems: 'center' },
  metricDivider: { width: 1, height: 27, backgroundColor: '#303030' },
  metricValue: { color: colors.white, fontSize: 17, fontWeight: '900' },
  metricLabel: { color: colors.textSecondary, fontSize: 8, fontWeight: '800', letterSpacing: 0.6, marginTop: 3 },
  exerciseChips: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 13 },
  exerciseChip: { maxWidth: 108, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 6, backgroundColor: '#222' },
  exerciseChipText: { color: '#BFBFBF', fontSize: 9, fontWeight: '700' },
  moreChip: { width: 29, height: 29, borderRadius: 15, backgroundColor: '#2B0606', alignItems: 'center', justifyContent: 'center' },
  moreChipText: { color: colors.primaryLight, fontSize: 10, fontWeight: '900' },
});

export default LiftScreen;
