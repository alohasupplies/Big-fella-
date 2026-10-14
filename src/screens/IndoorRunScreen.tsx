import React, { useEffect, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from '../types';
import { useSettings } from '../context/SettingsContext';
import { colors } from '../theme/colors';
import { ActiveRunSession, beginActiveRun, clearActiveRun, elapsedForSession, pauseActiveRun, readActiveRun, resumeActiveRun } from '../services/runTrackingService';
import { createIndoorRun, formatDuration, formatPace } from '../services/runService';
import { saveRunToHealthKit } from '../services/healthService';

const IndoorRunScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { settings } = useSettings();
  const [session, setSession] = useState<ActiveRunSession | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [distanceText, setDistanceText] = useState('');
  const [finishing, setFinishing] = useState(false);
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const unit = session?.distanceUnit || settings.distanceUnit;
  const normalizedDistance = distanceText.trim().replace(',', '.');
  const distance = /^\d*\.?\d+$/.test(normalizedDistance) ? Number(normalizedDistance) : NaN;
  const validDistance = Number.isFinite(distance) && distance > 0;

  useEffect(() => {
    let mounted = true;
    const refresh = async () => {
      const active = await readActiveRun();
      if (!mounted || locked.current) return;
      if (active && active.mode !== 'indoor') { navigation.replace('RecordRun'); return; }
      setSession(active);
      if (active) setElapsed(elapsedForSession(active));
    };
    refresh();
    const timer = setInterval(refresh, 1000);
    return () => { mounted = false; clearInterval(timer); };
  }, [navigation]);

  const perform = async (action: () => Promise<void>) => {
    if (locked.current) return;
    locked.current = true; setBusy(true);
    try { await action(); }
    catch (error) { Alert.alert('Could not complete action', error instanceof Error ? error.message : 'Please try again. Your session is saved.'); }
    finally { locked.current = false; setBusy(false); }
  };
  const start = () => perform(async () => {
    const active = await beginActiveRun(settings.distanceUnit, 'indoor');
    if (active.mode !== 'indoor') { navigation.replace('RecordRun'); return; }
    setSession(active); setElapsed(elapsedForSession(active));
  });
  const togglePause = () => perform(async () => {
    const active = session?.status === 'recording' ? await pauseActiveRun() : await resumeActiveRun();
    if (active) { setSession(active); setElapsed(elapsedForSession(active)); }
  });
  const finish = () => perform(async () => {
    const active = await pauseActiveRun();
    if (!active) return;
    setSession(active); setElapsed(elapsedForSession(active));
    if (elapsedForSession(active) < 5) { Alert.alert('Keep going', 'Record at least 5 seconds before saving your run.'); return; }
    setFinishing(true);
  });
  const save = () => perform(async () => {
    if (!session || !validDistance) return;
    const savedDistance = unit === settings.distanceUnit ? distance : unit === 'miles' ? distance * 1.609344 : distance / 1.609344;
    const run = await createIndoorRun(session.id, savedDistance, elapsedForSession(session));
    const synced = !settings.healthSyncEnabled || await saveRunToHealthKit(run, [], settings.distanceUnit);
    await clearActiveRun();
    navigation.replace('RunDetail', { runId: run.id, run });
    if (!synced) Alert.alert('Run saved', 'Your treadmill run is saved in Athleticcs. Apple Health could not be updated; check permission to write Workouts and Walking + Running Distance.');
  });
  const discard = () => Alert.alert('Discard indoor run?', 'This timer session will be removed.', [
    { text: 'Keep run', style: 'cancel' },
    { text: 'Discard', style: 'destructive', onPress: () => perform(async () => { await clearActiveRun(); navigation.goBack(); }) },
  ]);

  return <SafeAreaView style={styles.page}>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <TouchableOpacity onPress={() => navigation.goBack()} disabled={busy} accessibilityLabel="Close indoor run" style={styles.close}><Ionicons name="close" size={26} color={colors.white} /></TouchableOpacity>
      <Text style={styles.kicker}>INDOOR RUN</Text>
      <Text style={styles.title}>{finishing ? 'Make it count.' : 'Your pace. Your space.'}</Text>
      <Text style={styles.caption}>Treadmill or indoor track · No GPS needed</Text>
      <View style={styles.timerCard}>
        <Ionicons name="fitness-outline" size={38} color={colors.primary} />
        <Text style={styles.timer} adjustsFontSizeToFit numberOfLines={1}>{formatDuration(elapsed)}</Text>
        <Text style={styles.label}>{session?.status === 'recording' ? 'RUNNING' : session ? 'PAUSED' : 'READY WHEN YOU ARE'}</Text>
      </View>
      {finishing ? <>
        <Text style={styles.field}>TREADMILL DISTANCE ({unit.toUpperCase()})</Text>
        <TextInput style={styles.input} value={distanceText} onChangeText={setDistanceText} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={colors.textSecondary} maxLength={8} accessibilityLabel={`Treadmill distance in ${unit}`} />
        <Text style={styles.caption}>Enter the distance from your treadmill. {validDistance ? `Average pace: ${formatPace(elapsed / 60 / distance)} /${unit === 'miles' ? 'mi' : 'km'}` : 'A distance greater than zero is required.'}</Text>
        <TouchableOpacity style={[styles.primary, (!validDistance || busy) && styles.disabled]} disabled={!validDistance || busy} onPress={save}><Text style={styles.buttonText}>{busy ? 'Saving…' : 'Save indoor run'}</Text></TouchableOpacity>
        <TouchableOpacity style={styles.secondary} disabled={busy} onPress={() => setFinishing(false)}><Text style={styles.buttonText}>Back to paused run</Text></TouchableOpacity>
      </> : session ? <>
        <TouchableOpacity style={styles.primary} disabled={busy} onPress={togglePause}><Text style={styles.buttonText}>{session.status === 'recording' ? 'Pause' : 'Resume'}</Text></TouchableOpacity>
        <TouchableOpacity style={styles.secondary} disabled={busy} onPress={finish}><Text style={styles.buttonText}>Finish run</Text></TouchableOpacity>
      </> : <TouchableOpacity style={styles.primary} disabled={busy} onPress={start}><Text style={styles.buttonText}>Start indoor run</Text></TouchableOpacity>}
      <Text style={styles.hint}>The timer keeps going when your phone is locked. Distance and pace are added when you finish.</Text>
      {session && <TouchableOpacity onPress={discard} disabled={busy} style={styles.discard}><Text style={styles.caption}>Discard run</Text></TouchableOpacity>}
    </ScrollView>
  </SafeAreaView>;
};

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.black }, content: { padding: 24, paddingBottom: 40 },
  close: { alignSelf: 'flex-start', padding: 8, marginBottom: 24 }, kicker: { color: colors.primary, fontWeight: '900', letterSpacing: 2, fontSize: 12 },
  title: { color: colors.white, fontSize: 31, fontWeight: '900', marginVertical: 10 }, caption: { color: colors.textSecondary, fontSize: 13, lineHeight: 21 },
  timerCard: { padding: 26, marginVertical: 28, borderRadius: 26, backgroundColor: '#191919', alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  timer: { color: colors.white, fontSize: 62, fontWeight: '800', fontVariant: ['tabular-nums'], marginVertical: 18 }, label: { color: colors.textSecondary, fontWeight: '800', fontSize: 11, letterSpacing: 2 },
  field: { color: colors.white, fontWeight: '800', fontSize: 12, marginBottom: 10 }, input: { color: colors.white, backgroundColor: '#191919', borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 18, fontSize: 30, marginBottom: 12 },
  primary: { backgroundColor: colors.primary, minHeight: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: 16 }, secondary: { backgroundColor: '#242424', minHeight: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  buttonText: { color: colors.white, fontWeight: '800', fontSize: 17 }, disabled: { opacity: .4 }, hint: { color: colors.textSecondary, textAlign: 'center', fontSize: 12, lineHeight: 19, marginTop: 22 }, discard: { alignItems: 'center', padding: 18 },
});
export default IndoorRunScreen;
