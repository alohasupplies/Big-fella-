import React, { useMemo, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, PanResponder, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RootStackParamList } from '../types';
import { useSettings } from '../context/SettingsContext';
import { RunMap } from '../components/run/RunMap';
import { correctRun, formatDuration, formatPace, parseRoute } from '../services/runService';
import { parseRunTime, routeMeters, trimRoute } from '../utils/trimRun';
import { colors } from '../theme/colors';

const TimeControl = ({ title, value, limit, min, max, onChange, onValidityChange }: {
  title: string; value: number; limit: number; min: number; max: number; onChange: (value: number) => void; onValidityChange: (valid: boolean) => void;
}) => {
  const [text, setText] = useState<string | null>(null);
  const width = useRef(1);
  const options = useRef({ value, min, max, onChange });
  options.current = { value, min, max, onChange };
  const startX = useRef(0);
  const clamp = (time: number) => Math.max(options.current.min, Math.min(options.current.max, Math.round(time)));
  const responder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (event) => {
      startX.current = event.nativeEvent.locationX;
      options.current.onChange(clamp(startX.current / width.current * limit));
    },
    onPanResponderMove: (_, gesture) => options.current.onChange(clamp((startX.current + gesture.dx) / width.current * limit)),
    onPanResponderTerminationRequest: () => false,
  }), [limit]);
  const commitText = () => {
    if (text !== null) {
      const parsed = parseRunTime(text);
      if (Number.isFinite(parsed) && parsed >= min && parsed <= max) onChange(parsed);
      else Alert.alert('Check the time', `Enter a time between ${formatDuration(min)} and ${formatDuration(max)}.`);
      setText(null);
      onValidityChange(true);
    }
  };
  return <View style={styles.control}>
    <View style={styles.row}><Text style={styles.label}>{title}</Text><TextInput
      accessibilityLabel={`${title} time`} value={text ?? formatDuration(value)} onChangeText={next => {
        setText(next);
        const parsed = parseRunTime(next);
        const valid = Number.isFinite(parsed) && parsed >= min && parsed <= max;
        onValidityChange(valid);
        if (valid) onChange(parsed);
      }}
      onBlur={commitText} onSubmitEditing={commitText} keyboardType="numbers-and-punctuation" selectTextOnFocus style={styles.timeInput} /></View>
    <View {...responder.panHandlers} onLayout={event => { width.current = event.nativeEvent.layout.width; }}
      style={styles.scrubber} accessible accessibilityRole="adjustable" accessibilityLabel={title}
      accessibilityValue={{ min, max, now: value, text: formatDuration(value) }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={event => onChange(clamp(value + (event.nativeEvent.actionName === 'increment' ? 10 : -10)))}>
      <View pointerEvents="none" style={styles.track} />
      <View pointerEvents="none" style={[styles.fill, { width: `${value / limit * 100}%` }]} />
      <View pointerEvents="none" style={[styles.handle, { left: `${value / limit * 100}%` }]} />
    </View>
    <View style={styles.row}>
      <TouchableOpacity style={styles.nudge} onPress={() => onChange(clamp(value - 10))}><Text style={styles.nudgeText}>−10 sec</Text></TouchableOpacity>
      <TouchableOpacity style={styles.nudge} onPress={() => onChange(clamp(value + 10))}><Text style={styles.nudgeText}>+10 sec</Text></TouchableOpacity>
    </View>
  </View>;
};

const TrimRunScreen = () => {
  const { run } = useRoute<RouteProp<RootStackParamList, 'TrimRun'>>().params;
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { settings } = useSettings();
  const insets = useSafeAreaInsets();
  const points = useMemo(() => parseRoute(run), [run.routeCoordinates]);
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(run.duration);
  const [saving, setSaving] = useState(false);
  const [startValid, setStartValid] = useState(true);
  const [endValid, setEndValid] = useState(true);
  const locked = useRef(false);
  const preview = useMemo(() => {
    try { return trimRoute(points, run.duration, start, end); } catch { return null; }
  }, [points, run.duration, start, end]);
  const originalMeters = useMemo(() => routeMeters(points), [points]);
  // Keep the source workout's calibrated distance; trimming the whole route
  // must not change its totals merely because Health and GPS disagree.
  const distance = originalMeters > 0 ? run.distance * (preview?.meters || 0) / originalMeters : 0;
  const changed = start > 0 || end < run.duration;
  const save = () => {
    if (!preview || !changed || distance <= 0 || !startValid || !endValid || locked.current) return;
    Alert.alert('Save trimmed run?', 'Only the red section will be kept. Distance, time, pace, and recaps will update in Athleticcs. Existing Apple Health workouts are unchanged. You can restore the original recording later.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Save trim', onPress: async () => {
        if (locked.current) return;
        locked.current = true;
        setSaving(true);
        try {
          await correctRun(run.id, distance, preview.duration, preview.points);
          navigation.goBack();
        } catch {
          Alert.alert('Could not trim run', 'Your recording has been kept. Please try again.');
        } finally { locked.current = false; setSaving(false); }
      } },
    ]);
  };
  return <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 24 }}>
      <View style={styles.map}><RunMap points={preview?.points || points} contextPoints={points} /></View>
      <View style={styles.content} pointerEvents={saving ? 'none' : 'auto'}>
        <Text style={styles.eyebrow}>KEEP THE RUN. CUT THE EXTRA.</Text>
        <Text style={styles.title}>Where did your run end?</Text>
        <Text style={styles.copy}>Move the finish time back to where you stopped running. Red is kept; gray is removed. You can trim the start too.</Text>
        <View style={styles.stats}>
          <View><Text style={styles.stat}>{distance.toFixed(2)}</Text><Text style={styles.label}>{settings.distanceUnit.toUpperCase()}</Text></View>
          <View><Text style={styles.stat}>{formatDuration(preview?.duration || 0)}</Text><Text style={styles.label}>TIME</Text></View>
          <View><Text style={styles.stat}>{distance > 0 ? formatPace((preview?.duration || 0) / 60 / distance) : '--:--'}</Text><Text style={styles.label}>AVG PACE</Text></View>
        </View>
        <TimeControl title="FINISH AT" value={end} limit={run.duration} min={start + 5} max={run.duration} onChange={setEnd} onValidityChange={setEndValid} />
        <TimeControl title="KEEP FROM" value={start} limit={run.duration} min={0} max={end - 5} onChange={setStart} onValidityChange={setStartValid} />
        <TouchableOpacity onPress={() => { setStart(0); setEnd(run.duration); }} style={styles.reset}><Text style={styles.nudgeText}>Reset selection</Text></TouchableOpacity>
        <Text style={styles.copy}>Check the map and totals before saving. Timing is estimated for older recordings without active-time samples.</Text>
      </View>
    </ScrollView>
    <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
      <TouchableOpacity disabled={saving || !changed || distance <= 0 || !startValid || !endValid} onPress={save} style={[styles.save, (saving || !changed || distance <= 0 || !startValid || !endValid) && { opacity: 0.45 }]}><Text style={styles.saveText}>{saving ? 'Saving…' : 'Save trimmed run'}</Text></TouchableOpacity>
    </View>
  </KeyboardAvoidingView>;
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background }, map: { height: 290 }, content: { padding: 20 },
  eyebrow: { fontSize: 10, letterSpacing: 1.6, fontWeight: '900', color: colors.primary },
  title: { color: colors.white, fontSize: 27, fontWeight: '900', marginTop: 10, marginBottom: 8 },
  copy: { color: colors.textSecondary, fontSize: 13, lineHeight: 20 },
  stats: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 22, marginVertical: 16, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border },
  stat: { color: colors.white, fontSize: 23, fontWeight: '900', marginBottom: 6 }, label: { color: colors.textSecondary, fontSize: 10, letterSpacing: 1, fontWeight: '800' },
  control: { padding: 18, backgroundColor: colors.surface, borderRadius: 20, marginBottom: 16 }, row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  timeInput: { color: colors.white, fontSize: 21, fontWeight: '800', minWidth: 100, paddingVertical: 8, textAlign: 'right' },
  scrubber: { height: 46, justifyContent: 'center', marginHorizontal: 12 }, track: { height: 5, borderRadius: 3, backgroundColor: '#555' },
  fill: { height: 5, position: 'absolute', backgroundColor: colors.primary, borderRadius: 3 }, handle: { position: 'absolute', width: 24, height: 24, borderRadius: 12, backgroundColor: colors.white, marginLeft: -12, borderWidth: 3, borderColor: colors.primary },
  nudge: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 12 }, nudgeText: { color: colors.primary, fontWeight: '800', fontSize: 13 }, reset: { alignItems: 'center', padding: 14, marginBottom: 8 },
  footer: { backgroundColor: colors.surface, padding: 16, borderTopWidth: 1, borderColor: colors.border }, save: { backgroundColor: colors.primary, borderRadius: 16, padding: 18, alignItems: 'center' }, saveText: { color: colors.white, fontWeight: '900', fontSize: 16 },
});

export default TrimRunScreen;
