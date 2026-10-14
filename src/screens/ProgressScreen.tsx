import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSettings } from '../context/SettingsContext';
import { useHealthSyncContext } from '../context/HealthSyncContext';
import { getWorkoutsByDateRange, calculateWorkoutVolume } from '../services/workoutService';
import { getRunsByDateRange, formatDuration } from '../services/runService';
import { Metric, compact, localDateKey, trainingStyles as ui } from '../components/TrainingUI';

type Week = { label: string; distance: number; volume: number; runs: number; lifts: number; time: number };
const emptyWeek = (): Week => ({ label: '', distance: 0, volume: 0, runs: 0, lifts: 0, time: 0 });
const ProgressScreen: React.FC = () => {
  const { settings } = useSettings();
  const { syncVersion } = useHealthSyncContext();
  const [tab, setTab] = useState<'all' | 'run' | 'lift'>('all');
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [days, setDays] = useState<{ date: string; count: number }[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const load = useCallback(async () => {
    try {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const monday = new Date(today); monday.setDate(today.getDate() - (today.getDay() + 6) % 7);
      const start = new Date(monday); start.setDate(start.getDate() - 42);
      const [runs, workouts] = await Promise.all([
        getRunsByDateRange(localDateKey(start), localDateKey(today)),
        getWorkoutsByDateRange(localDateKey(start), localDateKey(today)),
      ]);
      const result: Week[] = [];
      for (let i = 0; i < 7; i++) {
        const from = new Date(start); from.setDate(start.getDate() + i * 7);
        const to = new Date(from); to.setDate(from.getDate() + 6);
        const a = localDateKey(from); const b = localDateKey(to);
        const r = runs.filter(x => x.date >= a && x.date <= b);
        const w = workouts.filter(x => x.date >= a && x.date <= b);
        result.push({ label: i === 6 ? 'Now' : from.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), distance: r.reduce((n, x) => n + x.distance, 0), volume: w.reduce((n, x) => n + calculateWorkoutVolume(x), 0), runs: r.length, lifts: w.length, time: r.reduce((n, x) => n + x.duration, 0) });
      }
      const activity = Array.from({ length: 28 }, (_, i) => {
        const d = new Date(today); d.setDate(today.getDate() - 27 + i);
        const key = localDateKey(d);
        return { date: key, count: (tab !== 'lift' ? runs.filter(r => r.date === key).length : 0) + (tab !== 'run' ? workouts.filter(w => w.date === key).length : 0) };
      });
      setWeeks(result); setDays(activity); setError(false);
    } catch (e) { console.error('Progress load failed', e); setError(true); }
  }, [tab]);
  useFocusEffect(useCallback(() => { void load(); }, [load, syncVersion]));
  const current = weeks[6] || emptyWeek(); const previous = weeks[5] || emptyWeek();
  const compare = (now: number, before: number) => before > 0 ? Math.round((now - before) / before * 100) + '% · this week so far vs all of last week' : now > 0 ? 'Building momentum this week' : 'Log a session to start your trend';
  const trend = (kind: 'distance' | 'volume', title: string, unit: string) => {
    const values = weeks.map(w => w[kind]); const max = Math.max(1, ...values);
    return <View style={ui.card}>
      <Text style={ui.eyebrow}>7-WEEK TREND</Text><Text style={[ui.heading, { marginTop: 8 }]}>{title}</Text>
      <Text style={ui.copy}>{compare(current[kind], previous[kind])}</Text>
      <View style={styles.chart}>{weeks.map((week, index) => <View key={index} style={styles.column}>
        <Text adjustsFontSizeToFit numberOfLines={1} style={styles.barValue}>{kind === 'volume' ? compact(week[kind]) : week[kind].toFixed(1)}</Text>
        <View style={styles.barTrack}><View style={[styles.bar, { height: week[kind] === 0 ? 0 : Math.max(3, week[kind] / max * 105), backgroundColor: index === 6 ? '#CC0100' : '#660A0A' }]} /></View>
        <Text numberOfLines={1} adjustsFontSizeToFit style={styles.axis}>{week.label}</Text>
      </View>)}</View><Text style={ui.label}>{unit.toUpperCase()} · MONDAY–SUNDAY</Text>
    </View>;
  };
  return <ScrollView style={ui.screen} contentContainerStyle={ui.content} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} tintColor="#CC0100" onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}>
    <View><Text style={ui.eyebrow}>YOUR TRAINING, IN FOCUS</Text><Text style={ui.title}>See the work.{ '\n' }See the progress.</Text><Text style={ui.copy}>Running and strength, together in one training story.</Text></View>
    <View style={styles.tabs}>{(['all', 'run', 'lift'] as const).map(t => <TouchableOpacity accessibilityRole="button" accessibilityState={{ selected: tab === t }} key={t} onPress={() => setTab(t)} style={[styles.tab, tab === t && styles.selected]}><Text style={styles.tabText}>{t === 'all' ? 'Overview' : t === 'run' ? 'Running' : 'Strength'}</Text></TouchableOpacity>)}</View>
    {error && <Text style={ui.copy}>Couldn’t load training data. Pull down to retry.</Text>}
    <View style={[ui.card, { backgroundColor: '#200505', borderColor: '#500B0B' }]}><Text style={ui.eyebrow}>THIS WEEK</Text><View style={[ui.row, { marginTop: 16 }]}>
      {tab !== 'lift' && <Metric value={current.distance.toFixed(1)} label={settings.distanceUnit.toUpperCase() + ' RUN'} />}
      {tab !== 'run' && <Metric value={compact(current.volume)} label={settings.weightUnit.toUpperCase() + ' LIFTED'} />}
      <Metric value={String(tab === 'all' ? current.runs + current.lifts : tab === 'run' ? current.runs : current.lifts)} label="SESSIONS" />
    </View>{tab === 'run' && <Text style={ui.copy}>Time on your feet: {formatDuration(current.time)}</Text>}</View>
    {tab !== 'lift' && trend('distance', 'Distance adds up.', settings.distanceUnit)}
    {tab !== 'run' && trend('volume', 'Strength in numbers.', settings.weightUnit)}
    <View style={ui.card}><Text style={ui.eyebrow}>LAST 28 DAYS</Text><Text style={[ui.heading, { marginTop: 8 }]}>Show up. Build momentum.</Text><Text style={ui.copy}>{days.filter(d => d.count > 0).length} active days · {days.reduce((n, d) => n + d.count, 0)} sessions</Text>
      <View style={styles.calendar}>{days.map(d => <View accessible accessibilityLabel={d.date + ': ' + d.count + ' sessions'} key={d.date} style={[styles.day, { backgroundColor: d.count > 1 ? '#CC0100' : d.count === 1 ? '#770100' : '#282828' }]}><Text style={styles.dayNumber}>{Number(d.date.slice(-2))}</Text></View>)}</View>
      <Text style={ui.copy}>Each square is a day. Brighter red means more sessions.</Text>
    </View>
  </ScrollView>;
};
const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', backgroundColor: '#171717', borderRadius: 16, padding: 5, gap: 4 },
  tab: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  selected: { backgroundColor: '#AA0100' }, tabText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  chart: { flexDirection: 'row', gap: 6, marginTop: 24 }, column: { flex: 1, minWidth: 0, alignItems: 'center' },
  barValue: { color: '#ddd', fontSize: 10, fontWeight: '700' }, barTrack: { height: 112, width: '100%', justifyContent: 'flex-end', borderBottomWidth: 1, borderColor: '#444', paddingHorizontal: 4 },
  bar: { borderTopLeftRadius: 5, borderTopRightRadius: 5 }, axis: { color: '#aaa', fontSize: 9, marginTop: 9 },
  calendar: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 18 },
  day: { width: '12.5%', aspectRatio: 1, borderRadius: 7, justifyContent: 'center', alignItems: 'center' }, dayNumber: { color: '#ddd', fontSize: 11 },
});
export default ProgressScreen;
