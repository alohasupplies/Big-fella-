import React, { useEffect, useMemo, useState } from 'react';
import { Alert, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import { RootStackParamList, RoutePoint } from '../types';
import { colors } from '../theme/colors';
import { RunMap } from '../components/run/RunMap';
import { createRecordedRun, formatDuration, formatPace } from '../services/runService';
import { useSettings } from '../context/SettingsContext';
import { saveRunToHealthKit } from '../services/healthService';
import { ActiveRunSession, beginActiveRun, clearActiveRun, elapsedForSession, pauseActiveRun, readActiveRun, requestRunLocationPermission, resumeActiveRun } from '../services/runTrackingService';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const metersBetween = (a: RoutePoint, b: RoutePoint) => {
  const rad = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * rad;
  const dLon = (b.longitude - a.longitude) * rad;
  const lat1 = a.latitude * rad;
  const lat2 = b.latitude * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};

const RecordRunScreen: React.FC = () => {
  useKeepAwake();
  const navigation = useNavigation<Nav>();
  const { settings } = useSettings();
  const [points, setPoints] = useState<RoutePoint[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [status, setStatus] = useState<'ready' | 'recording' | 'paused'>('ready');
  const [gpsLabel, setGpsLabel] = useState('Finding GPS…');
  const [session, setSession] = useState<ActiveRunSession | null>(null);

  useEffect(() => {
    let mounted = true;
    const refresh = async () => {
      const active = await readActiveRun();
      if (!mounted || !active) return;
      if (active.mode === 'indoor') { navigation.replace('IndoorRun'); return; }
      setSession(active);
      setPoints(active.points);
      setElapsed(elapsedForSession(active));
      setStatus(active.status);
      setGpsLabel(active.points.length ? 'GPS strong' : 'Finding GPS…');
    };
    refresh();
    const timer = setInterval(refresh, 1000);
    return () => { mounted = false; clearInterval(timer); };
  }, []);

  const distanceMeters = useMemo(
    () => points.slice(1).reduce((sum, point, index) => sum + metersBetween(points[index], point), 0),
    [points]
  );
  const distance = settings.distanceUnit === 'miles' ? distanceMeters / 1609.344 : distanceMeters / 1000;
  const pace = distance > 0 ? elapsed / 60 / distance : 0;

  const start = async () => {
    if (!(await requestRunLocationPermission())) {
      Alert.alert('Background Location Required', 'Choose Always Allow so your route keeps recording when the phone is locked or the app is in the background.');
      return;
    }
    const active = await beginActiveRun(settings.distanceUnit);
    setSession(active);
    setStatus('recording');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  };

  const pause = async () => {
    const active = await pauseActiveRun();
    if (active) { setSession(active); setElapsed(elapsedForSession(active)); }
    setStatus('paused');
  };

  const resume = async () => {
    const active = await resumeActiveRun();
    if (!active) return;
    setSession(active);
    setStatus('recording');
  };

  const finish = () => Alert.alert('Finish run?', 'Your route and statistics will be saved.', [
    { text: 'Keep Running', style: 'cancel' },
    { text: 'Finish', onPress: async () => {
      const active = await pauseActiveRun() || session;
      const finalPoints = active?.points || points;
      const finalElapsed = active ? elapsedForSession(active) : elapsed;
      const finalMeters = finalPoints.slice(1).reduce((sum, point, index) => sum + metersBetween(finalPoints[index], point), 0);
      const finalDistance = settings.distanceUnit === 'miles' ? finalMeters / 1609.344 : finalMeters / 1000;
      if (finalElapsed < 5 || finalDistance <= 0) {
        Alert.alert('Not enough activity', 'Record a little more distance before finishing.');
        return;
      }
      const run = await createRecordedRun(finalDistance, finalElapsed, finalPoints);
      if (settings.healthSyncEnabled) {
        const synced = await saveRunToHealthKit(run, finalPoints, settings.distanceUnit);
        if (!synced) {
          Alert.alert(
            'Run saved — Apple Health needs attention',
            'Your run is safe in Athleticcs, but it could not be added to Apple Health. In the Health app, allow Athleticcs to write Workouts and Walking + Running Distance, then try your next run.'
          );
        }
      }
      await clearActiveRun();
      navigation.replace('RunDetail', { runId: run.id, run });
    } },
  ]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.map}><RunMap points={points} live /></View>
      <TouchableOpacity style={styles.close} onPress={() => navigation.goBack()}>
        <Ionicons name="close" size={24} color={colors.white} />
      </TouchableOpacity>
      <View style={styles.gps}><View style={styles.gpsDot} /><Text style={styles.gpsText}>{gpsLabel}</Text></View>
      <View style={styles.sheet}>
        <View style={styles.primaryStat}>
          <Text style={styles.primaryValue}>{distance.toFixed(2)}</Text>
          <Text style={styles.primaryLabel}>{settings.distanceUnit}</Text>
        </View>
        <View style={styles.statRow}>
          <View><Text style={styles.statValue}>{formatDuration(elapsed)}</Text><Text style={styles.statLabel}>TIME</Text></View>
          <View><Text style={styles.statValue}>{pace ? formatPace(pace) : '--:--'}</Text><Text style={styles.statLabel}>AVG PACE</Text></View>
        </View>
        {status === 'ready' ? (
          <TouchableOpacity style={styles.startButton} onPress={start}><Text style={styles.startText}>START</Text></TouchableOpacity>
        ) : (
          <View style={styles.controls}>
            <TouchableOpacity style={styles.finishButton} onPress={finish}><Ionicons name="stop" size={26} color={colors.white} /></TouchableOpacity>
            <TouchableOpacity style={styles.pauseButton} onPress={status === 'recording' ? pause : resume}>
              <Ionicons name={status === 'recording' ? 'pause' : 'play'} size={32} color={colors.black} />
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.black },
  map: { flex: 1 },
  close: { position: 'absolute', top: 58, left: 18, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,.72)', alignItems: 'center', justifyContent: 'center' },
  gps: { position: 'absolute', top: 62, right: 18, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,.72)', paddingHorizontal: 13, height: 36, borderRadius: 18 },
  gpsDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#4ADE80', marginRight: 7 },
  gpsText: { color: colors.white, fontSize: 12, fontWeight: '600' },
  sheet: { backgroundColor: '#0B0B0B', paddingHorizontal: 24, paddingTop: 22, paddingBottom: 20, borderTopLeftRadius: 28, borderTopRightRadius: 28 },
  primaryStat: { alignItems: 'center', flexDirection: 'row', justifyContent: 'center', alignSelf: 'center' },
  primaryValue: { color: colors.white, fontSize: 54, lineHeight: 60, fontWeight: '800', letterSpacing: -2 },
  primaryLabel: { color: colors.textSecondary, marginLeft: 8, marginTop: 22, fontSize: 14 },
  statRow: { flexDirection: 'row', justifyContent: 'space-around', marginVertical: 18 },
  statValue: { color: colors.white, fontSize: 24, fontWeight: '700', textAlign: 'center' },
  statLabel: { color: colors.textSecondary, fontSize: 10, fontWeight: '700', letterSpacing: 1.2, textAlign: 'center', marginTop: 5 },
  startButton: { width: 82, height: 82, borderRadius: 41, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary },
  startText: { color: colors.white, fontWeight: '800', fontSize: 15 },
  controls: { flexDirection: 'row', justifyContent: 'center', gap: 28 },
  finishButton: { width: 62, height: 62, borderRadius: 31, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary },
  pauseButton: { width: 62, height: 62, borderRadius: 31, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white },
});

export default RecordRunScreen;
