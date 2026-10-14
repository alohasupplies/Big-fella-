import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, StyleSheet } from 'react-native';
import Constants from 'expo-constants';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from '../types';
import { useSettings } from '../context/SettingsContext';
import { useHealthSyncContext } from '../context/HealthSyncContext';
import { getTotalWorkoutCount, getTotalLifetimeVolume } from '../services/workoutService';
import { getLifetimeRunStats } from '../services/runService';
import { Metric, compact, trainingStyles as ui } from '../components/TrainingUI';

const ProfileScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { settings } = useSettings(); const { syncVersion, isSyncing } = useHealthSyncContext();
  const [stats, setStats] = useState({ lifts: 0, volume: 0, runs: 0, distance: 0 });
  const [error, setError] = useState(false);
  useFocusEffect(useCallback(() => {
    let active = true;
    void Promise.all([getTotalWorkoutCount(), getTotalLifetimeVolume(), getLifetimeRunStats()]).then(([lifts, volume, runs]) => {
      if (active) { setStats({ lifts, volume, runs: runs.totalRuns, distance: runs.totalDistance }); setError(false); }
    }).catch(e => { console.error('Profile load failed', e); if (active) setError(true); });
    return () => { active = false; };
  }, [syncVersion]));
  const version = Constants.appOwnership === 'expo' ? Constants.expoConfig?.version : Constants.nativeAppVersion || Constants.expoConfig?.version;
  const build = Constants.appOwnership === 'expo' ? Constants.expoConfig?.ios?.buildNumber : Constants.nativeBuildVersion || Constants.expoConfig?.ios?.buildNumber;
  return <ScrollView style={ui.screen} contentContainerStyle={ui.content} showsVerticalScrollIndicator={false}>
    <View style={styles.hero}><Image source={require('../../assets/athleticcs-logo.png')} style={styles.logo} resizeMode="contain" /><Text style={ui.eyebrow}>THE ATHLETE IN YOU</Text><Text style={ui.title}>Your journey.</Text><Text style={ui.copy}>Every mile. Every rep. All the work you’ve put in.</Text></View>
    {error && <Text style={ui.copy}>Couldn’t load your totals. Reopen this tab to retry.</Text>}
    <View style={ui.card}><Text style={ui.eyebrow}>LIFETIME TOTALS</Text><View style={[ui.row, { marginTop: 20 }]}><Metric value={String(stats.runs)} label="RUNS" /><Metric value={stats.distance.toFixed(1)} label={settings.distanceUnit.toUpperCase()} /></View><View style={[ui.row, styles.bottomMetrics]}><Metric value={String(stats.lifts)} label="LIFT SESSIONS" /><Metric value={compact(stats.volume)} label={settings.weightUnit.toUpperCase() + ' LIFTED'} /></View></View>
    <View><Text style={ui.heading}>Connected to your training</Text><TouchableOpacity accessibilityRole="button" onPress={() => navigation.navigate('Settings')} style={[ui.card, styles.health]}><View style={styles.icon}><Ionicons name="heart-outline" size={24} color="#CC0100" /></View><View style={{ flex: 1 }}><Text style={styles.menuTitle}>Apple Health</Text><Text style={ui.copy}>{isSyncing ? 'Syncing your activities…' : settings.healthSyncEnabled ? 'Sync enabled · manage permissions' : 'Connect your workouts and runs'}</Text></View><Ionicons name="chevron-forward" color="#aaa" size={20} /></TouchableOpacity></View>
    <View style={ui.card}>{[
      { icon: 'settings-outline' as const, title: 'Settings', subtitle: 'Units, reminders, and preferences', screen: 'Settings' as const },
      { icon: 'download-outline' as const, title: 'Export your data', subtitle: 'Take your runs and workouts with you', screen: 'DataExport' as const },
    ].map((item, i) => <TouchableOpacity key={item.title} accessibilityRole="button" onPress={() => navigation.navigate(item.screen)} style={[styles.menu, i > 0 && styles.menuBorder]}><View style={styles.icon}><Ionicons name={item.icon} color="#fff" size={23} /></View><View style={{ flex: 1 }}><Text style={styles.menuTitle}>{item.title}</Text><Text style={ui.copy}>{item.subtitle}</Text></View><Ionicons name="chevron-forward" color="#aaa" size={20} /></TouchableOpacity>)}</View>
    <View style={styles.footer}><Text style={styles.brand}>ATHLETICCS</Text><Text style={ui.copy}>Version {version || '—'}{build ? ' · Build ' + build : ''}</Text><Text style={styles.footerCopy}>Your training history is stored on this device.</Text></View>
  </ScrollView>;
};
const styles = StyleSheet.create({
  hero: { alignItems: 'flex-start', paddingTop: 4 }, logo: { width: 120, height: 78, marginBottom: 18 },
  bottomMetrics: { borderTopWidth: 1, borderColor: '#333', marginTop: 22, paddingTop: 22 },
  health: { flexDirection: 'row', gap: 12, alignItems: 'center', marginTop: 14 },
  icon: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#2B0808', alignItems: 'center', justifyContent: 'center' },
  menu: { flexDirection: 'row', gap: 12, alignItems: 'center', paddingVertical: 8 },
  menuBorder: { borderTopWidth: 1, borderColor: '#333', marginTop: 12, paddingTop: 20 },
  menuTitle: { color: '#fff', fontWeight: '800', fontSize: 16 },
  footer: { alignItems: 'center', paddingVertical: 12 }, brand: { color: '#fff', fontSize: 14, fontWeight: '900', letterSpacing: 3 },
  footerCopy: { color: '#888', fontSize: 11, marginTop: 10 },
});
export default ProfileScreen;
