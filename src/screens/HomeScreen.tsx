import React, { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { RootStackParamList, Run, Workout } from '../types';
import { useSettings } from '../context/SettingsContext';
import { useHealthSyncContext } from '../context/HealthSyncContext';
import { getRecentWorkouts, getWeeklyVolume } from '../services/workoutService';
import { calculateCurrentStreak, formatDuration, getRecentRuns, getWeeklyRunStats, parseRoute } from '../services/runService';
import { parseLocalDate } from '../utils/date';
import { RunMap } from '../components/run/RunMap';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Activity = (Run & { kind: 'run' }) | (Workout & { kind: 'lift' });

const HomeScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const { settings } = useSettings();
  const { syncVersion, triggerSync } = useHealthSyncContext();
  const [refreshing, setRefreshing] = useState(false);
  const [streak, setStreak] = useState(0);
  const [distance, setDistance] = useState(0);
  const [runTime, setRunTime] = useState(0);
  const [volume, setVolume] = useState(0);
  const [activities, setActivities] = useState<Activity[]>([]);

  const load = useCallback(async () => {
    const [weekly, weeklyVolume, currentStreak, runs, workouts] = await Promise.all([
      getWeeklyRunStats(), getWeeklyVolume(), calculateCurrentStreak(settings.streakMinDistance, settings.streakMinDuration), getRecentRuns(3), getRecentWorkouts(3),
    ]);
    setDistance(weekly.totalDistance); setRunTime(weekly.totalDuration); setVolume(weeklyVolume); setStreak(currentStreak);
    setActivities([
      ...runs.map(item => ({ ...item, kind: 'run' as const })),
      ...workouts.map(item => ({ ...item, kind: 'lift' as const })),
    ].sort((a, b) => parseLocalDate(b.date).getTime() - parseLocalDate(a.date).getTime()).slice(0, 4));
  }, [settings.streakMinDistance, settings.streakMinDuration]);
  useFocusEffect(useCallback(() => { load(); }, [load, syncVersion]));
  const refresh = async () => { setRefreshing(true); triggerSync(); await load(); setRefreshing(false); };
  const formatVolume = (value: number) => value >= 1000 ? `${(value / 1000).toFixed(1)}K` : Math.round(value).toString();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.white} />}>
      <View style={styles.greetingRow}><View><Text style={styles.eyebrow}>BIG FELLA ATHLETICS</Text><Text style={styles.greeting}>Ready to work?</Text></View><View style={styles.avatar}><Ionicons name="person" size={21} color={colors.white} /></View></View>
      <View style={styles.heroCard}>
        <View style={styles.heroHeader}><View><Text style={styles.cardEyebrow}>THIS WEEK</Text><Text style={styles.heroNumber}>{distance.toFixed(1)} <Text style={styles.heroUnit}>{settings.distanceUnit}</Text></Text></View><View style={styles.streak}><Ionicons name="flame" size={18} color="#FF7048" /><Text style={styles.streakText}>{streak} day streak</Text></View></View>
        <View style={styles.heroStats}><View><Text style={styles.statValue}>{formatDuration(runTime)}</Text><Text style={styles.statLabel}>RUN TIME</Text></View><View><Text style={styles.statValue}>{formatVolume(volume)}</Text><Text style={styles.statLabel}>VOLUME · {settings.weightUnit.toUpperCase()}</Text></View></View>
      </View>
      <Text style={styles.sectionTitle}>Start training</Text>
      <TouchableOpacity style={styles.primaryAction} onPress={() => navigation.navigate('RecordRun')}><View style={styles.actionIcon}><Ionicons name="navigate" size={25} color={colors.white} /></View><View style={styles.actionCopy}><Text style={styles.actionTitle}>Start a run</Text><Text style={styles.actionSub}>GPS ready · Apple Maps</Text></View><Ionicons name="chevron-forward" size={23} color={colors.white} /></TouchableOpacity>
      <TouchableOpacity style={styles.secondaryAction} onPress={() => navigation.navigate('LogWorkout', {})}><View style={styles.liftIcon}><Ionicons name="barbell" size={23} color={colors.white} /></View><View style={styles.actionCopy}><Text style={styles.secondaryTitle}>Start lifting</Text><Text style={styles.actionSub}>Log sets, reps, and personal records</Text></View><Ionicons name="chevron-forward" size={21} color={colors.textSecondary} /></TouchableOpacity>
      <View style={styles.sectionRow}><Text style={styles.sectionTitle}>Recent activity</Text><TouchableOpacity onPress={() => navigation.navigate('Main')}><Text style={styles.seeAll}>See all</Text></TouchableOpacity></View>
      {!activities.length ? <View style={styles.empty}><Text style={styles.emptyTitle}>Nothing logged yet</Text><Text style={styles.emptyText}>Your latest runs and workouts will live here.</Text></View> : activities.map(item => item.kind === 'run' ? (
        <TouchableOpacity key={`run-${item.id}`} style={styles.activityCard} onPress={() => navigation.navigate('RunDetail', { runId: item.id, run: item })}>
          <View style={styles.map}><RunMap points={parseRoute(item)} interactive={false} /></View><View style={styles.activityBody}><Text style={styles.activityDate}>{parseLocalDate(item.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</Text><Text style={styles.activityTitle}>{item.routeName || `${item.runType.charAt(0).toUpperCase() + item.runType.slice(1)} run`}</Text><View style={styles.activityFooter}><Text style={styles.activityMetric}>{item.distance.toFixed(2)} {settings.distanceUnit}</Text><Text style={styles.activityMetric}>{formatDuration(item.duration)}</Text><Ionicons name="chevron-forward" size={19} color={colors.textSecondary} /></View></View>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity key={`lift-${item.id}`} style={styles.liftCard} onPress={() => navigation.navigate('WorkoutDetail', { workoutId: item.id })}><View style={styles.liftBadge}><Ionicons name="barbell" size={24} color={colors.white} /></View><View style={styles.actionCopy}><Text style={styles.activityDate}>{parseLocalDate(item.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</Text><Text style={styles.secondaryTitle}>{item.exercises.length} exercise workout</Text></View><Ionicons name="chevron-forward" size={20} color={colors.textSecondary} /></TouchableOpacity>
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.black }, content: { padding: 18, paddingBottom: 42 }, greetingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 5, marginBottom: 20 }, eyebrow: { color: colors.primaryLight, fontSize: 10, fontWeight: '900', letterSpacing: 1.8 }, greeting: { color: colors.white, fontSize: 29, fontWeight: '900', letterSpacing: -.7, marginTop: 4 }, avatar: { width: 43, height: 43, borderRadius: 22, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  heroCard: { backgroundColor: '#111111', borderRadius: 22, padding: 20, borderWidth: 1, borderColor: '#282828' }, heroHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, cardEyebrow: { color: colors.textSecondary, fontSize: 10, fontWeight: '900', letterSpacing: 1.8 }, heroNumber: { color: colors.white, fontSize: 44, fontWeight: '900', letterSpacing: -1.5, marginTop: 3 }, heroUnit: { color: colors.textSecondary, fontSize: 14, letterSpacing: 0 }, streak: { flexDirection: 'row', gap: 6, alignItems: 'center', backgroundColor: '#27130E', paddingHorizontal: 12, paddingVertical: 9, borderRadius: 20 }, streakText: { color: colors.white, fontSize: 12, fontWeight: '800' }, heroStats: { flexDirection: 'row', gap: 55, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 15, marginTop: 14 }, statValue: { color: colors.white, fontSize: 18, fontWeight: '900' }, statLabel: { color: colors.textSecondary, fontSize: 9, fontWeight: '800', letterSpacing: 1, marginTop: 4 },
  sectionTitle: { color: colors.white, fontSize: 21, fontWeight: '900', marginTop: 27, marginBottom: 12 }, primaryAction: { height: 78, borderRadius: 19, backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 }, actionIcon: { width: 47, height: 47, borderRadius: 24, backgroundColor: 'rgba(0,0,0,.2)', alignItems: 'center', justifyContent: 'center' }, actionCopy: { flex: 1, marginLeft: 13 }, actionTitle: { color: colors.white, fontSize: 18, fontWeight: '900' }, actionSub: { color: colors.textSecondary, fontSize: 11, marginTop: 4 }, secondaryAction: { minHeight: 72, marginTop: 10, borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15 }, liftIcon: { width: 45, height: 45, borderRadius: 14, backgroundColor: '#292929', alignItems: 'center', justifyContent: 'center' }, secondaryTitle: { color: colors.white, fontSize: 16, fontWeight: '800' },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, seeAll: { color: colors.primaryLight, fontSize: 13, fontWeight: '800', marginTop: 17 }, activityCard: { backgroundColor: colors.surface, borderRadius: 20, overflow: 'hidden', marginBottom: 14, borderWidth: 1, borderColor: colors.border }, map: { height: 125, backgroundColor: '#151515' }, activityBody: { padding: 15 }, activityDate: { color: colors.textSecondary, fontSize: 10, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' }, activityTitle: { color: colors.white, fontSize: 18, fontWeight: '900', marginTop: 4 }, activityFooter: { flexDirection: 'row', alignItems: 'center', gap: 22, marginTop: 11 }, activityMetric: { color: colors.white, fontSize: 13, fontWeight: '800' }, liftCard: { minHeight: 82, backgroundColor: colors.surface, borderRadius: 18, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', padding: 15, marginBottom: 12 }, liftBadge: { width: 48, height: 48, borderRadius: 15, backgroundColor: '#2A0808', alignItems: 'center', justifyContent: 'center' }, empty: { borderWidth: 1, borderColor: colors.border, borderRadius: 18, alignItems: 'center', padding: 28 }, emptyTitle: { color: colors.white, fontSize: 16, fontWeight: '800' }, emptyText: { color: colors.textSecondary, marginTop: 5 },
});
export default HomeScreen;
