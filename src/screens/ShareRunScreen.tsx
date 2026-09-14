import React, { useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, NativeModules, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Sharing from 'expo-sharing';
import ViewShot, { captureRef } from 'react-native-view-shot';
import { RootStackParamList } from '../types';
import { colors } from '../theme/colors';
import { formatDuration, formatPace, parseRoute, updateRunPhoto } from '../services/runService';
import { RunMap } from '../components/run/RunMap';
import { useSettings } from '../context/SettingsContext';
import { ResizeMode, Video } from 'expo-av';
import { RouteTraceOverlay } from '../components/run/RouteTraceOverlay';

type RouteProps = RouteProp<RootStackParamList, 'ShareRun'>;

const ShareRunScreen: React.FC = () => {
  const { run } = useRoute<RouteProps>().params;
  const { settings } = useSettings();
  const cardRef = useRef<ViewShot>(null);
  const [photoUri, setPhotoUri] = useState(run.photoUri);
  const [videoUri, setVideoUri] = useState<string>();
  const [mode, setMode] = useState<'map' | 'photo' | 'video'>(run.photoUri ? 'photo' : 'map');
  const [showRoute, setShowRoute] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [loadingVideo, setLoadingVideo] = useState(false);
  const points = parseRoute(run);

  const choosePhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 1 });
    if (!result.canceled) {
      const uri = result.assets[0].uri;
      setPhotoUri(uri);
      setVideoUri(undefined);
      setMode('photo');
      await updateRunPhoto(run.id, uri);
    }
  };

  const chooseVideo = async () => {
    setLoadingVideo(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        videoMaxDuration: 10,
        quality: 1,
        preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Current,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset.duration || asset.duration >= 10000) {
        Alert.alert('Choose a shorter video', 'Run recap videos must be under 10 seconds. Trim the video in Photos, then select it again.');
        return;
      }
      setVideoUri(asset.uri);
      setMode('video');
    } finally {
      setLoadingVideo(false);
    }
  };

  const share = async () => {
    if (!(await Sharing.isAvailableAsync())) {
      Alert.alert('Sharing unavailable', 'Sharing is not available on this device.');
      return;
    }
    setExporting(true);
    try {
      if (mode === 'video' && videoUri) {
        if (!NativeModules.RunVideoExporter) throw new Error('Video exporter is not linked. Rebuild the iOS app.');
        const uri = await NativeModules.RunVideoExporter.exportVideo(
          videoUri,
          `${run.distance.toFixed(2)} ${settings.distanceUnit}`,
          formatDuration(run.duration),
          `${formatPace(run.pace)} /${settings.distanceUnit === 'miles' ? 'mi' : 'km'}`,
          JSON.stringify(points),
          showRoute
        );
        await Sharing.shareAsync(uri, { mimeType: 'video/mp4', dialogTitle: 'Share your run video' });
      } else {
        const uri = await captureRef(cardRef, { format: 'png', quality: 1, result: 'tmpfile' });
        await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Share your run' });
      }
    } catch {
      Alert.alert('Could not create recap', 'Please try sharing again.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.kicker}>SHARE STUDIO</Text>
      <Text style={styles.title}>Your run, your story.</Text>
      <ViewShot ref={cardRef} style={styles.card} options={{ format: 'png', quality: 1 }}>
        {mode === 'video' && videoUri ? <Video source={{ uri: videoUri }} style={StyleSheet.absoluteFill} resizeMode={ResizeMode.COVER} shouldPlay isLooping isMuted /> : mode === 'photo' && photoUri ? <Image source={{ uri: photoUri }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : <RunMap points={points} interactive={false} />}
        <View style={styles.shade} />
        {mode !== 'map' && showRoute && <RouteTraceOverlay route={points} />}
        <View style={styles.brandRow}><View style={styles.brandMark} /><Text style={styles.brand}>BIG FELLA ATHLETICS</Text></View>
        <View style={styles.overlay}>
          <Text style={styles.activity}>MORNING RUN</Text>
          <Text style={styles.distance}>{run.distance.toFixed(2)}</Text>
          <Text style={styles.unit}>{settings.distanceUnit.toUpperCase()}</Text>
          <View style={styles.stats}>
            <View><Text style={styles.statValue}>{formatDuration(run.duration)}</Text><Text style={styles.statLabel}>TIME</Text></View>
            <View><Text style={styles.statValue}>{formatPace(run.pace)}</Text><Text style={styles.statLabel}>AVG PACE</Text></View>
            <View><Text style={styles.statValue}>{Math.round((run.elevationGain || 0) * (settings.distanceUnit === 'miles' ? 3.28084 : 1))}</Text><Text style={styles.statLabel}>ELEV {settings.distanceUnit === 'miles' ? 'FT' : 'M'}</Text></View>
          </View>
        </View>
      </ViewShot>
      <View style={styles.options}>
        <TouchableOpacity style={[styles.option, mode === 'map' && styles.optionActive]} onPress={() => setMode('map')}>
          <Ionicons name="map-outline" size={21} color={colors.white} /><Text style={styles.optionText}>Map</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.option, mode === 'photo' && styles.optionActive]} onPress={choosePhoto}>
          <Ionicons name="image-outline" size={21} color={colors.white} /><Text style={styles.optionText}>Photo</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.option, mode === 'video' && styles.optionActive]} onPress={chooseVideo} disabled={loadingVideo || exporting}>
          {loadingVideo ? <ActivityIndicator size="small" color={colors.white} /> : <Ionicons name="videocam-outline" size={21} color={colors.white} />}<Text style={styles.optionText}>{loadingVideo ? 'Loading…' : 'Video'}</Text>
        </TouchableOpacity>
      </View>
      {mode !== 'map' && (
        <TouchableOpacity style={[styles.routeToggle, showRoute && styles.routeToggleActive, points.length < 2 && styles.routeToggleDisabled]} onPress={() => points.length > 1 && setShowRoute(value => !value)} disabled={points.length < 2}>
          <View style={[styles.toggleTrack, showRoute && styles.toggleTrackActive]}><View style={[styles.toggleKnob, showRoute && styles.toggleKnobActive]} /></View>
          <View style={styles.routeCopy}><Text style={styles.routeTitle}>Route overlay</Text><Text style={styles.routeSub}>{points.length > 1 ? 'Show your GPS route in red' : 'No GPS route available for this run'}</Text></View>
          <Text style={styles.routeState}>{showRoute && points.length > 1 ? 'ON' : 'OFF'}</Text>
        </TouchableOpacity>
      )}
      <TouchableOpacity style={styles.shareButton} onPress={share} disabled={exporting}>
        {exporting ? <ActivityIndicator color={colors.white} /> : <><Ionicons name="share-outline" size={22} color={colors.white} /><Text style={styles.shareText}>Share recap</Text></>}
      </TouchableOpacity>
      <Text style={styles.hint}>{mode === 'video' ? 'Video must be under 10 seconds. Distance counts up in the exported clip.' : 'Exports a clean 4:5 image for Instagram, Messages, or anywhere else.'}</Text>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 20 },
  kicker: { color: colors.primaryLight, fontSize: 11, fontWeight: '800', letterSpacing: 2, marginTop: 8 },
  title: { color: colors.white, fontSize: 28, fontWeight: '800', marginTop: 5, marginBottom: 18 },
  card: { width: '100%', aspectRatio: 4 / 5, borderRadius: 24, overflow: 'hidden', backgroundColor: '#171717' },
  shade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,.26)' },
  brandRow: { position: 'absolute', top: 20, left: 20, flexDirection: 'row', alignItems: 'center' },
  brandMark: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.primary, marginRight: 8 },
  brand: { color: colors.white, fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
  overlay: { position: 'absolute', left: 20, right: 20, bottom: 22 },
  activity: { color: colors.white, fontSize: 11, fontWeight: '800', letterSpacing: 1.8 },
  distance: { color: colors.white, fontSize: 58, fontWeight: '900', lineHeight: 62, letterSpacing: -2.5 },
  unit: { color: colors.white, fontSize: 13, fontWeight: '800', letterSpacing: 2 },
  stats: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,.55)' },
  statValue: { color: colors.white, fontSize: 17, fontWeight: '800' },
  statLabel: { color: 'rgba(255,255,255,.8)', fontSize: 9, fontWeight: '700', letterSpacing: 1, marginTop: 3 },
  options: { flexDirection: 'row', gap: 10, marginTop: 16 },
  option: { flex: 1, height: 48, borderRadius: 14, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' },
  optionActive: { borderColor: colors.primary, backgroundColor: '#270606' },
  optionText: { color: colors.white, fontWeight: '700' },
  routeToggle: { minHeight: 58, marginTop: 10, paddingHorizontal: 13, borderRadius: 14, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface },
  routeToggleActive: { borderColor: '#5A1717' }, routeToggleDisabled: { opacity: .45 },
  toggleTrack: { width: 38, height: 22, borderRadius: 11, padding: 2, backgroundColor: '#444' }, toggleTrackActive: { backgroundColor: colors.primary }, toggleKnob: { width: 18, height: 18, borderRadius: 9, backgroundColor: colors.white }, toggleKnobActive: { transform: [{ translateX: 16 }] },
  routeCopy: { flex: 1, marginLeft: 11 }, routeTitle: { color: colors.white, fontSize: 13, fontWeight: '800' }, routeSub: { color: colors.textSecondary, fontSize: 10, marginTop: 2 }, routeState: { color: colors.textSecondary, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  shareButton: { height: 54, backgroundColor: colors.primary, borderRadius: 16, marginTop: 12, flexDirection: 'row', gap: 9, alignItems: 'center', justifyContent: 'center' },
  shareText: { color: colors.white, fontSize: 16, fontWeight: '800' },
  hint: { color: colors.textSecondary, textAlign: 'center', fontSize: 11, marginTop: 10 },
});

export default ShareRunScreen;
