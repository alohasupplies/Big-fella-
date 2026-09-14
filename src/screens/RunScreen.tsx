import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList, Run } from '../types';
import { colors } from '../theme/colors';
import { useSettings } from '../context/SettingsContext';
import { useHealthSyncContext } from '../context/HealthSyncContext';
import { calculateCurrentStreak, createRecordedRun, formatDuration, formatPace, getRecentRuns, getWeeklyRunStats, parseRoute } from '../services/runService';
import { parseLocalDate } from '../utils/date';
import { RunMap } from '../components/run/RunMap';
import { ActiveRunSession, elapsedForSession, readActiveRun } from '../services/runTrackingService';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const RunScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const { settings, updateSetting } = useSettings();
  const { syncVersion, isSyncing, triggerSync } = useHealthSyncContext();
  const [runs, setRuns] = useState<Run[]>([]);
  const [streak, setStreak] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [creatingTestRun, setCreatingTestRun] = useState<'standard' | 'long' | null>(null);
  const [activeRun, setActiveRun] = useState<ActiveRunSession | null>(null);
  const [week, setWeek] = useState({ totalDistance: 0, runCount: 0, totalDuration: 0, averagePace: 0 });

  const load = useCallback(async () => {
    const [recent, weekly, currentStreak, active] = await Promise.all([
      getRecentRuns(10), getWeeklyRunStats(), calculateCurrentStreak(settings.streakMinDistance, settings.streakMinDuration), readActiveRun(),
    ]);
    setRuns(recent); setWeek(weekly); setStreak(currentStreak); setActiveRun(active);
  }, [settings.streakMinDistance, settings.streakMinDuration]);
  useFocusEffect(useCallback(() => { load(); }, [load, syncVersion]));
  const refresh = async () => { setRefreshing(true); triggerSync(); await load(); setRefreshing(false); };
  const toggleTestRun = () => {
    const enabled = !settings.testRunEnabled;
    Alert.alert(
      'Testing tools',
      `${enabled ? 'Show' : 'Hide'} the test-run shortcut?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: enabled ? 'Show' : 'Hide', onPress: () => updateSetting('testRunEnabled', enabled) },
      ]
    );
  };
  const completeTestRun = async (preset: 'standard' | 'long') => {
    if (creatingTestRun) return;
    setCreatingTestRun(preset);
    try {
      const standardRoute = [
        { latitude: 37.33479, longitude: -122.00902, altitude: 44 },
        { latitude: 37.33718, longitude: -122.00755, altitude: 46 },
        { latitude: 37.33957, longitude: -122.00506, altitude: 49 },
        { latitude: 37.34121, longitude: -122.00162, altitude: 51 },
        { latitude: 37.33912, longitude: -121.99876, altitude: 48 },
        { latitude: 37.33614, longitude: -121.99983, altitude: 45 },
        { latitude: 37.33336, longitude: -122.00247, altitude: 43 },
        { latitude: 37.33257, longitude: -122.00616, altitude: 44 },
        { latitude: 37.33479, longitude: -122.00902, altitude: 44 },
      ];
      const longRoute = [
        { latitude: 37.3317, longitude: -122.0301, altitude: 48 },
        { latitude: 37.3428, longitude: -122.0498, altitude: 58 },
        { latitude: 37.3569, longitude: -122.0712, altitude: 75 },
        { latitude: 37.3714, longitude: -122.0945, altitude: 92 },
        { latitude: 37.3878, longitude: -122.1167, altitude: 118 },
        { latitude: 37.4046, longitude: -122.1298, altitude: 131 },
        { latitude: 37.4209, longitude: -122.1172, altitude: 105 },
        { latitude: 37.4328, longitude: -122.0941, altitude: 82 },
        { latitude: 37.4231, longitude: -122.0735, altitude: 69 },
        { latitude: 37.4072, longitude: -122.0574, altitude: 62 },
        { latitude: 37.3893, longitude: -122.0447, altitude: 57 },
        { latitude: 37.3711, longitude: -122.0348, altitude: 53 },
        { latitude: 37.3516, longitude: -122.0273, altitude: 50 },
        { latitude: 37.3317, longitude: -122.0301, altitude: 48 },
      ];
      const isLong = preset === 'long';
      const run = await createRecordedRun(
        settings.distanceUnit === 'miles' ? (isLong ? 15 : 3.12) : (isLong ? 24.14 : 5.02),
        isLong ? 7770 : 1648,
        isLong ? longRoute : standardRoute,
        isLong ? 83 : 18,
        isLong ? 'long' : 'tempo'
      );
      navigation.navigate('RunDetail', { runId: run.id, run });
    } finally {
      setCreatingTestRun(null);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.white} />}>
      <View style={styles.heroTop}>
        <TouchableOpacity activeOpacity={1} onLongPress={toggleTestRun} delayLongPress={1800}><Text style={styles.eyebrow}>THIS WEEK</Text><Text style={styles.heroDistance}>{week.totalDistance.toFixed(1)} <Text style={styles.heroUnit}>{settings.distanceUnit}</Text></Text></TouchableOpacity>
        <View style={styles.streakPill}><Ionicons name="flame" size={17} color="#FF7648" /><Text style={styles.streakText}>{streak} day streak</Text></View>
      </View>
      <View style={styles.weekStats}>
        <View><Text style={styles.weekValue}>{week.runCount}</Text><Text style={styles.label}>RUNS</Text></View>
        <View><Text style={styles.weekValue}>{formatDuration(week.totalDuration)}</Text><Text style={styles.label}>TIME</Text></View>
        <View><Text style={styles.weekValue}>{week.averagePace ? formatPace(week.averagePace) : '--:--'}</Text><Text style={styles.label}>AVG PACE</Text></View>
      </View>
      <TouchableOpacity style={styles.recordButton} onPress={() => navigation.navigate('RecordRun')}>
        <View style={styles.recordIcon}><Ionicons name="navigate" size={24} color={colors.white} /></View>
        <View style={styles.recordCopy}><Text style={styles.recordTitle}>Start a run</Text><Text style={styles.recordSub}>GPS ready · Apple Maps</Text></View>
        <Ionicons name="chevron-forward" size={22} color={colors.white} />
      </TouchableOpacity>
      {activeRun && <TouchableOpacity style={styles.activeRunButton} onPress={() => navigation.navigate('RecordRun')}>
        <View style={styles.activePulse} />
        <View style={styles.recordCopy}><Text style={styles.recordTitle}>{activeRun.status === 'paused' ? 'Run paused' : 'Run in progress'}</Text><Text style={styles.recordSub}>{formatDuration(elapsedForSession(activeRun))} saved · Tap to resume</Text></View>
        <Ionicons name="chevron-forward" size={22} color={colors.white} />
      </TouchableOpacity>}
      {settings.testRunEnabled && <><TouchableOpacity style={styles.testButton} onPress={() => completeTestRun('standard')} disabled={creatingTestRun !== null}>
        {creatingTestRun === 'standard' ? <ActivityIndicator size="small" color={colors.white} /> : <Ionicons name="checkmark-circle-outline" size={20} color={colors.white} />}
        <View style={styles.testCopy}><Text style={styles.testTitle}>Complete a test run</Text><Text style={styles.testSub}>Preview the finished map and sharing flow</Text></View>
        <Ionicons name="flask-outline" size={19} color={colors.textSecondary} />
      </TouchableOpacity>
      <TouchableOpacity style={styles.longTestButton} onPress={() => completeTestRun('long')} disabled={creatingTestRun !== null}>
        {creatingTestRun === 'long' ? <ActivityIndicator size="small" color={colors.white} /> : <Ionicons name="trail-sign-outline" size={20} color={colors.white} />}
        <View style={styles.testCopy}><Text style={styles.testTitle}>Complete a 15-mile run</Text><Text style={styles.testSub}>Test a large route in the sharing studio</Text></View>
        <Ionicons name="resize-outline" size={19} color={colors.textSecondary} />
      </TouchableOpacity></>}
      <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Recent activities</Text><TouchableOpacity onPress={() => navigation.navigate('LogRun', {})}><Text style={styles.manual}>Add manually</Text></TouchableOpacity></View>
      {settings.healthSyncEnabled && isSyncing && <View style={styles.sync}><ActivityIndicator size="small" color={colors.primaryLight} /><Text style={styles.syncText}>Syncing Apple Health</Text></View>}
      {!runs.length ? (
        <View style={styles.empty}><Ionicons name="map-outline" size={36} color={colors.textDisabled} /><Text style={styles.emptyTitle}>Your first route starts here</Text><Text style={styles.emptyText}>Record a run and your map, pace, and time will appear here.</Text></View>
      ) : runs.map(run => {
        const points = parseRoute(run);
        return (
          <TouchableOpacity key={run.id} style={styles.activity} activeOpacity={0.88} onPress={() => navigation.navigate('RunDetail', { runId: run.id, run })}>
            <View style={styles.mapPreview}><RunMap points={points} interactive={false} /></View>
            <View style={styles.activityBody}>
              <View style={styles.dateRow}><Text style={styles.date}>{parseLocalDate(run.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</Text><Ionicons name="chevron-forward" size={18} color={colors.textSecondary} /></View>
              <Text style={styles.activityTitle}>{run.routeName || `${run.runType.charAt(0).toUpperCase() + run.runType.slice(1)} run`}</Text>
              <View style={styles.activityStats}>
                <View><Text style={styles.activityValue}>{run.distance.toFixed(2)}</Text><Text style={styles.label}>{settings.distanceUnit.toUpperCase()}</Text></View>
                <View><Text style={styles.activityValue}>{formatDuration(run.duration)}</Text><Text style={styles.label}>TIME</Text></View>
                <View><Text style={styles.activityValue}>{formatPace(run.pace)}</Text><Text style={styles.label}>PACE</Text></View>
              </View>
            </View>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background }, content: { padding: 18, paddingBottom: 36 },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, eyebrow: { color: colors.textSecondary, fontSize: 11, fontWeight: '800', letterSpacing: 1.8 }, heroDistance: { color: colors.white, fontSize: 43, fontWeight: '900', letterSpacing: -1.5, marginTop: 2 }, heroUnit: { fontSize: 15, color: colors.textSecondary, letterSpacing: 0 },
  streakPill: { flexDirection: 'row', gap: 6, alignItems: 'center', backgroundColor: '#21130F', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 9 }, streakText: { color: colors.white, fontSize: 12, fontWeight: '700' },
  weekStats: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 17, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border, marginTop: 10 }, weekValue: { color: colors.white, fontSize: 17, fontWeight: '800' }, label: { color: colors.textSecondary, fontSize: 9, fontWeight: '800', letterSpacing: 1, marginTop: 3 },
  recordButton: { height: 78, borderRadius: 18, backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginTop: 20 }, recordIcon: { width: 46, height: 46, borderRadius: 23, backgroundColor: 'rgba(0,0,0,.18)', alignItems: 'center', justifyContent: 'center' }, recordCopy: { flex: 1, marginLeft: 13 }, recordTitle: { color: colors.white, fontSize: 18, fontWeight: '800' }, recordSub: { color: 'rgba(255,255,255,.75)', fontSize: 12, marginTop: 3 },
  activeRunButton: { minHeight: 68, borderRadius: 16, borderWidth: 1, borderColor: '#9A2020', backgroundColor: '#260909', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginTop: 10 }, activePulse: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.primaryLight },
  testButton: { minHeight: 64, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, marginTop: 10 }, testCopy: { flex: 1, marginLeft: 11 }, testTitle: { color: colors.white, fontSize: 14, fontWeight: '800' }, testSub: { color: colors.textSecondary, fontSize: 11, marginTop: 3 },
  longTestButton: { minHeight: 64, borderRadius: 16, borderWidth: 1, borderColor: '#4A1818', backgroundColor: '#1D0B0B', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, marginTop: 8 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 28, marginBottom: 13 }, sectionTitle: { color: colors.white, fontSize: 21, fontWeight: '800' }, manual: { color: colors.primaryLight, fontSize: 13, fontWeight: '700' }, sync: { flexDirection: 'row', gap: 8, alignItems: 'center', paddingBottom: 12 }, syncText: { color: colors.textSecondary, fontSize: 12 },
  activity: { backgroundColor: colors.surface, borderRadius: 20, overflow: 'hidden', marginBottom: 16, borderWidth: 1, borderColor: '#242424' }, mapPreview: { height: 145, backgroundColor: '#151515' }, activityBody: { padding: 15 }, dateRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, date: { color: colors.textSecondary, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: .8 }, activityTitle: { color: colors.white, fontSize: 19, fontWeight: '800', marginTop: 5 }, activityStats: { flexDirection: 'row', gap: 34, marginTop: 14 }, activityValue: { color: colors.white, fontSize: 17, fontWeight: '800' },
  empty: { padding: 34, borderRadius: 20, borderWidth: 1, borderColor: colors.border, alignItems: 'center' }, emptyTitle: { color: colors.white, fontSize: 17, fontWeight: '800', marginTop: 12 }, emptyText: { color: colors.textSecondary, textAlign: 'center', lineHeight: 19, marginTop: 6 },
});
export default RunScreen;
