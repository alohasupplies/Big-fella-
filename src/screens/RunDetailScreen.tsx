import React, { useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList, RunType } from '../types';
import { colors } from '../theme/colors';
import { deleteRun, formatDuration, formatPace, parseRoute, updateRecordedRunDetails } from '../services/runService';
import { parseLocalDate } from '../utils/date';
import { RunMap } from '../components/run/RunMap';
import { useSettings } from '../context/SettingsContext';
import { useRunWithHealthRoute } from '../hooks/useRunWithHealthRoute';

type Props = RouteProp<RootStackParamList, 'RunDetail'>;
type Nav = NativeStackNavigationProp<RootStackParamList>;
const RunDetailScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const { run: initialRun } = useRoute<Props>().params;
  const { run, setRun, loadingRoute, routeError, retryRoute } = useRunWithHealthRoute(initialRun);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(initialRun.routeName || '');
  const [runType, setRunType] = useState<RunType>(initialRun.runType);
  const [saving, setSaving] = useState(false);
  const { settings } = useSettings();
  const points = parseRoute(run);
  const isRecordedRun = points.length > 1 || !!run.isIndoor;
  const runTypes: RunType[] = ['easy', 'tempo', 'intervals', 'long', 'recovery', 'race'];
  const saveDetails = async () => {
    setSaving(true);
    try {
      const updated = await updateRecordedRunDetails(run.id, name, runType);
      setRun(updated);
      setEditing(false);
    } catch {
      Alert.alert('Could not update run', 'Please try again.');
    } finally {
      setSaving(false);
    }
  };
  const remove = () => Alert.alert('Delete run?', 'This may affect your streak.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: async () => { await deleteRun(run.id); navigation.goBack(); } }]);
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {run.isIndoor ? <View style={{ padding: 28, backgroundColor: colors.surface, alignItems: 'center' }}><Ionicons name="fitness-outline" size={42} color={colors.primary} /><Text style={[styles.title, { fontSize: 20 }]}>Indoor run</Text><Text style={styles.noteText}>Treadmill distance · No GPS route</Text></View> : <View style={styles.map}><RunMap points={points} emptyMessage={loadingRoute ? 'Loading route from Apple Health…' : undefined} /></View>}
      {!run.isIndoor && !points.length && run.notes?.includes('Synced from Apple Health') && <TouchableOpacity onPress={retryRoute} disabled={loadingRoute} style={{ padding: 16 }}><Text style={styles.noteText}>{routeError ? 'Could not read the route. Unlock your phone and tap to retry.' : 'Apple Health must contain a GPS route for this run. Allow Workout Routes access in Health, then tap to retry.'}</Text></TouchableOpacity>}
      <View style={styles.headerRow}><View style={styles.headerCopy}><Text style={styles.date}>{parseLocalDate(run.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</Text><Text style={styles.title}>{run.routeName || `${run.runType.charAt(0).toUpperCase() + run.runType.slice(1)} run`}</Text></View>{isRecordedRun && <TouchableOpacity style={styles.editIcon} onPress={() => { setName(run.routeName || ''); setRunType(run.runType); setEditing(true); }}><Ionicons name="pencil" size={19} color={colors.white} /></TouchableOpacity>}<TouchableOpacity style={styles.shareIcon} onPress={() => navigation.navigate('ShareRun', { run })}><Ionicons name="share-outline" size={22} color={colors.white} /></TouchableOpacity></View>
      <View style={styles.bigStats}><View style={styles.mainStat}><Text style={styles.value}>{run.distance.toFixed(2)}</Text><Text style={styles.label}>{settings.distanceUnit.toUpperCase()}</Text></View><View style={styles.mainStat}><Text style={styles.value}>{formatDuration(run.duration)}</Text><Text style={styles.label}>MOVING TIME</Text></View><View style={styles.mainStat}><Text style={styles.value}>{formatPace(run.pace)}</Text><Text style={styles.label}>AVG PACE</Text></View></View>
      <View style={styles.detailCard}><Text style={styles.section}>Run details</Text><View style={styles.detailRow}><Text style={styles.detailLabel}>Activity type</Text><Text style={styles.detailValue}>{run.runType}</Text></View>{run.weather && <View style={styles.detailRow}><Text style={styles.detailLabel}>Weather</Text><Text style={styles.detailValue}>{run.weather}</Text></View>}</View>
      {run.notes && <View style={styles.notes}><Text style={styles.section}>Notes</Text><Text style={styles.noteText}>{run.notes}</Text></View>}
      <TouchableOpacity style={styles.shareButton} onPress={() => navigation.navigate('ShareRun', { run })}><Ionicons name="sparkles-outline" size={20} color={colors.white} /><Text style={styles.shareText}>Create shareable recap</Text></TouchableOpacity>
      <TouchableOpacity style={styles.deleteButton} onPress={remove}><Text style={styles.deleteText}>Delete activity</Text></TouchableOpacity>
      <Modal visible={editing} transparent animationType="slide" onRequestClose={() => setEditing(false)}>
        <View style={styles.modalBackdrop}><View style={styles.editor}>
          <View style={styles.editorHeader}><Text style={styles.editorTitle}>Edit run details</Text><TouchableOpacity onPress={() => setEditing(false)}><Ionicons name="close" size={25} color={colors.white} /></TouchableOpacity></View>
          <Text style={styles.fieldLabel}>RUN NAME</Text>
          <TextInput value={name} onChangeText={setName} placeholder="Morning run" placeholderTextColor={colors.textSecondary} maxLength={60} style={styles.input} returnKeyType="done" />
          <Text style={styles.fieldLabel}>ACTIVITY TYPE</Text>
          <View style={styles.typeGrid}>{runTypes.map(type => <TouchableOpacity key={type} style={[styles.typeButton, runType === type && styles.typeButtonActive]} onPress={() => setRunType(type)}><Text style={[styles.typeText, runType === type && styles.typeTextActive]}>{type}</Text></TouchableOpacity>)}</View>
          <TouchableOpacity style={[styles.saveButton, saving && styles.saving]} onPress={saveDetails} disabled={saving}><Text style={styles.saveText}>{saving ? 'Saving…' : 'Save changes'}</Text></TouchableOpacity>
          <Text style={styles.editorHint}>Distance, time, pace, and GPS route stay unchanged.</Text>
        </View></View>
      </Modal>
    </ScrollView>
  );
};
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background }, content: { paddingBottom: 34 }, map: { height: 310, backgroundColor: '#151515' }, headerRow: { flexDirection: 'row', padding: 20, alignItems: 'center' }, headerCopy: { flex: 1 }, date: { color: colors.textSecondary, fontSize: 11, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' }, title: { color: colors.white, fontSize: 27, fontWeight: '900', marginTop: 5 }, shareIcon: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  bigStats: { flexDirection: 'row', marginHorizontal: 20, paddingVertical: 20, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border }, mainStat: { flex: 1 }, value: { color: colors.white, fontSize: 20, fontWeight: '900' }, label: { color: colors.textSecondary, fontSize: 9, fontWeight: '800', letterSpacing: .9, marginTop: 4 }, detailCard: { margin: 20, marginBottom: 0, padding: 18, backgroundColor: colors.surface, borderRadius: 18 }, section: { color: colors.white, fontSize: 17, fontWeight: '800', marginBottom: 10 }, detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 11, borderTopWidth: 1, borderTopColor: colors.border }, detailLabel: { color: colors.textSecondary, fontSize: 14 }, detailValue: { color: colors.white, fontSize: 14, fontWeight: '700', textTransform: 'capitalize' }, notes: { marginHorizontal: 20, marginTop: 16, padding: 18, backgroundColor: colors.surface, borderRadius: 18 }, noteText: { color: colors.textSecondary, lineHeight: 21 }, shareButton: { marginHorizontal: 20, marginTop: 20, height: 56, borderRadius: 16, backgroundColor: colors.primary, flexDirection: 'row', gap: 9, alignItems: 'center', justifyContent: 'center' }, shareText: { color: colors.white, fontSize: 16, fontWeight: '800' }, deleteButton: { alignItems: 'center', marginTop: 22, padding: 12 }, deleteText: { color: colors.textSecondary, fontSize: 13 }, editIcon: { width: 46, height: 46, borderRadius: 23, marginRight: 8, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,.62)' }, editor: { backgroundColor: '#151515', borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 22, paddingBottom: 34 }, editorHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }, editorTitle: { color: colors.white, fontSize: 22, fontWeight: '900' }, fieldLabel: { color: colors.textSecondary, fontSize: 10, fontWeight: '800', letterSpacing: 1.4, marginBottom: 8, marginTop: 4 }, input: { height: 52, borderRadius: 14, backgroundColor: '#242424', color: colors.white, fontSize: 16, paddingHorizontal: 15, marginBottom: 18, borderWidth: 1, borderColor: colors.border }, typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, typeButton: { width: '31%', height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#242424', borderWidth: 1, borderColor: colors.border }, typeButtonActive: { backgroundColor: colors.primary, borderColor: colors.primary }, typeText: { color: colors.textSecondary, fontSize: 12, fontWeight: '800', textTransform: 'capitalize' }, typeTextActive: { color: colors.white }, saveButton: { height: 54, marginTop: 22, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary }, saving: { opacity: .6 }, saveText: { color: colors.white, fontSize: 16, fontWeight: '900' }, editorHint: { color: colors.textSecondary, fontSize: 11, textAlign: 'center', marginTop: 10 },
});
export default RunDetailScreen;
