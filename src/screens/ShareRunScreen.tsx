import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, NativeModules, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRoute, RouteProp } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
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
import { useRunWithHealthRoute } from '../hooks/useRunWithHealthRoute';

type RouteProps = RouteProp<RootStackParamList, 'ShareRun'>;

const ShareRunScreen: React.FC = () => {
  const { run: initialRun } = useRoute<RouteProps>().params;
  const { run, loadingRoute, routeError, retryRoute } = useRunWithHealthRoute(initialRun);
  const { settings } = useSettings();
  const insets = useSafeAreaInsets();
  const cardRef = useRef<ViewShot>(null);
  const [photoUri, setPhotoUri] = useState(run.photoUri);
  const [videoUri, setVideoUri] = useState<string>();
  const [mode, setMode] = useState<'map' | '3d' | 'photo' | 'video' | 'rewind'>(run.photoUri ? 'photo' : 'map');
  const [clips, setClips] = useState<Partial<Record<'3d' | 'rewind', string>>>({});
  const [loadingReplay, setLoadingReplay] = useState(false);
  const [replayError, setReplayError] = useState(false);
  const [mapAttempt, setMapAttempt] = useState(0);
  const replayVideo = useRef<Video>(null);
  const pendingClips = useRef(new Map<string, Promise<string>>());
  const [showRoute, setShowRoute] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [loadingVideo, setLoadingVideo] = useState(false);
  const points = useMemo(() => parseRoute(run).filter(p => Number.isFinite(p.latitude) && Number.isFinite(p.longitude)), [run.routeCoordinates]);
  const [playing, setPlaying] = useState(true);
  const [finished, setFinished] = useState(false);
  const isReplay = mode === '3d' || mode === 'rewind';
  const replayUri = isReplay ? clips[mode] : undefined;
  useEffect(() => { setFinished(false); setPlaying(true); setReplayError(false); }, [mode]);
  useEffect(() => {
    setClips({});
  }, [run.routeCoordinates, run.distance, run.duration, run.pace, settings.distanceUnit]);
  useEffect(() => {
    if (!isReplay || replayUri || points.length < 2) return;
    let active = true;
    const replayMode = mode as '3d' | 'rewind';
    setLoadingReplay(true);
    setReplayError(false);
    const create = async () => {
      try {
        const method = replayMode === '3d' ? 'exportFlyover' : 'exportRewind';
        if (!NativeModules.RunVideoExporter?.[method]) throw new Error('This recap requires the updated iOS app.');
        const key = JSON.stringify([replayMode, points, run.distance, run.duration, run.pace, settings.distanceUnit]);
        let pending = pendingClips.current.get(key);
        if (!pending) {
          pending = NativeModules.RunVideoExporter[method](JSON.stringify(points), run.distance, settings.distanceUnit, formatDuration(run.duration), formatPace(run.pace)) as Promise<string>;
          pendingClips.current.set(key, pending);
          pending.catch(() => pendingClips.current.delete(key));
        }
        const uri = await pending;
        if (active) { setClips(current => ({ ...current, [replayMode]: uri })); setFinished(false); setPlaying(true); }
      } catch {
        if (active) setReplayError(true);
      } finally {
        if (active) setLoadingReplay(false);
      }
    };
    create();
    return () => { active = false; };
  }, [mode, points, replayUri, mapAttempt, run.distance, run.duration, run.pace, settings.distanceUnit]);

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
    if (exporting || (isReplay && !replayUri)) return;
    if (!(await Sharing.isAvailableAsync())) {
      Alert.alert('Sharing unavailable', 'Sharing is not available on this device.');
      return;
    }
    setExporting(true);
    try {
      if (isReplay && replayUri) {
        await Sharing.shareAsync(replayUri, { mimeType: 'video/mp4', dialogTitle: mode === '3d' ? 'Share your 3D flyover' : 'Share your run rewind' });
      } else if (mode === 'video' && videoUri) {
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
        const uri = await captureRef(cardRef, { format: 'png', quality: 1, result: 'tmpfile', width: 1080, height: 1350 });
        await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Share your run' });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Please try sharing again.';
      Alert.alert('Could not create recap', message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 16) + 28 }]}
      >
        <Text style={styles.kicker}>SHARE STUDIO</Text>
        <Text style={styles.title}>Your run, your story.</Text>
        <ViewShot ref={cardRef} style={styles.card} options={{ format: 'png', quality: 1 }}>
        {isReplay ? (
          <View style={StyleSheet.absoluteFill}>
            {replayUri ? (
              <Video key={replayUri} ref={replayVideo} source={{ uri: replayUri }} style={StyleSheet.absoluteFill}
                resizeMode={ResizeMode.CONTAIN} shouldPlay={playing} isMuted progressUpdateIntervalMillis={250}
                onError={() => setReplayError(true)}
                onPlaybackStatusUpdate={status => { if (status.isLoaded && status.didJustFinish) { setFinished(true); setPlaying(false); } }} />
            ) : (
              <View style={styles.mapLoading}>
                {loadingReplay && <ActivityIndicator color={colors.white} />}
                <Text style={styles.hint}>{replayError ? 'Could not create the video. Tap retry below.' : `Creating your ${mode === '3d' ? '3D flyover' : 'rewind'}…`}</Text>
              </View>
            )}
          </View>
        ) : mode === 'video' && videoUri ? <Video source={{ uri: videoUri }} style={StyleSheet.absoluteFill} resizeMode={ResizeMode.COVER} shouldPlay isLooping isMuted /> : mode === 'photo' && photoUri ? <Image source={{ uri: photoUri }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : run.isIndoor ? <View style={styles.mapLoading}><Ionicons name="fitness-outline" size={76} color={colors.primary} /></View> : <RunMap points={points} interactive={false} emptyMessage={loadingRoute ? 'Loading route from Apple Health…' : undefined} />}
        {!isReplay && <>
        <View style={styles.shade} />
        {(mode === 'photo' || mode === 'video') && showRoute && <RouteTraceOverlay route={points} />}
        <Image source={require('../../assets/athleticcs-logo.png')} style={styles.brandLogo} resizeMode="contain" />
        <View style={styles.overlay}>
          <Text style={styles.activity} numberOfLines={1}>{run.routeName || 'YOUR RUN'}</Text>
          <Text style={styles.distance} numberOfLines={1} adjustsFontSizeToFit>{run.distance.toFixed(2)}</Text>
          <Text style={styles.unit}>{settings.distanceUnit.toUpperCase()}</Text>
          <View style={styles.stats}>
            <View><Text style={styles.statValue}>{formatDuration(run.duration)}</Text><Text style={styles.statLabel}>TIME</Text></View>
            <View><Text style={styles.statValue}>{formatPace(run.pace)}</Text><Text style={styles.statLabel}>AVG PACE</Text></View>
          </View>
        </View>
        </>}
        </ViewShot>
        <View style={styles.options}>
        <TouchableOpacity style={[styles.option, mode === 'map' && styles.optionActive]} onPress={() => setMode('map')} disabled={exporting}>
          <Ionicons name={run.isIndoor ? 'stats-chart-outline' : 'map-outline'} size={21} color={colors.white} /><Text style={styles.optionText}>{run.isIndoor ? 'Stats' : 'Map'}</Text>
        </TouchableOpacity>
        {!run.isIndoor && <TouchableOpacity style={[styles.option, mode === '3d' && styles.optionActive]} onPress={() => {
          if (points.length < 2) { Alert.alert('GPS route needed', loadingRoute ? 'Your Apple Health route is still loading.' : '3D recaps need a GPS route. For imported runs, allow Workout Routes in Apple Health and try again.'); return; }
          setFinished(false); setPlaying(true); setMode('3d');
        }} disabled={exporting}>
          <Ionicons name="cube-outline" size={21} color={colors.white} /><Text style={styles.optionText}>3D</Text>
        </TouchableOpacity>}
        <TouchableOpacity style={[styles.option, mode === 'photo' && styles.optionActive]} onPress={choosePhoto} disabled={exporting}>
          <Ionicons name="image-outline" size={21} color={colors.white} /><Text style={styles.optionText}>Photo</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.option, mode === 'video' && styles.optionActive]} onPress={chooseVideo} disabled={loadingVideo || exporting}>
          {loadingVideo ? <ActivityIndicator size="small" color={colors.white} /> : <Ionicons name="videocam-outline" size={21} color={colors.white} />}<Text style={styles.optionText}>{loadingVideo ? 'Loading…' : 'Video'}</Text>
        </TouchableOpacity>
        {!run.isIndoor && <TouchableOpacity style={[styles.option, mode === 'rewind' && styles.optionActive]} onPress={() => {
          if (points.length < 2) { Alert.alert('GPS route needed', 'Rewind is available for runs recorded with a GPS route.'); return; }
          setFinished(false); setPlaying(true); setMode('rewind');
        }} disabled={exporting}>
          <Ionicons name="play-back-outline" size={21} color={colors.white} /><Text style={styles.optionText}>Rewind</Text>
        </TouchableOpacity>}
        </View>
        {isReplay && replayError && <TouchableOpacity style={styles.routeToggle} onPress={() => { pendingClips.current.clear(); setClips(current => ({ ...current, [mode]: undefined })); setMapAttempt(value => value + 1); }}><Text style={styles.routeTitle}>Retry video</Text></TouchableOpacity>}
        {!run.isIndoor && !points.length && run.notes?.includes('Synced from Apple Health') && <TouchableOpacity onPress={retryRoute} disabled={loadingRoute}><Text style={styles.hint}>{loadingRoute ? 'Loading Apple Health route…' : routeError ? 'Could not read the route. Unlock your phone and tap to retry.' : 'Missing route? Allow Workout Routes in Health, then tap to retry. The original app must have saved GPS data.'}</Text></TouchableOpacity>}
        {isReplay && replayUri && <TouchableOpacity style={styles.routeToggle} onPress={async () => {
          if (finished) { await replayVideo.current?.replayAsync(); setFinished(false); setPlaying(true); }
          else setPlaying(value => !value);
        }}><Ionicons name={playing && !finished ? 'pause' : 'play'} size={20} color={colors.white} /><Text style={[styles.routeTitle, { marginLeft: 12 }]}>{finished ? 'Replay run' : playing ? 'Pause' : 'Resume'}</Text></TouchableOpacity>}
        {!run.isIndoor && (mode === 'photo' || mode === 'video') && (
        <TouchableOpacity style={[styles.routeToggle, showRoute && styles.routeToggleActive, points.length < 2 && styles.routeToggleDisabled]} onPress={() => points.length > 1 && setShowRoute(value => !value)} disabled={points.length < 2}>
          <View style={[styles.toggleTrack, showRoute && styles.toggleTrackActive]}><View style={[styles.toggleKnob, showRoute && styles.toggleKnobActive]} /></View>
          <View style={styles.routeCopy}><Text style={styles.routeTitle}>Route overlay</Text><Text style={styles.routeSub}>{points.length > 1 ? 'Show your GPS route in red' : 'No GPS route available for this run'}</Text></View>
          <Text style={styles.routeState}>{showRoute && points.length > 1 ? 'ON' : 'OFF'}</Text>
        </TouchableOpacity>
        )}
        <TouchableOpacity style={[styles.shareButton, isReplay && !replayUri && { opacity: 0.5 }]} onPress={share} disabled={exporting || (isReplay && !replayUri)}>
        {exporting ? <ActivityIndicator color={colors.white} /> : <><Ionicons name="share-outline" size={22} color={colors.white} /><Text style={styles.shareText}>Share recap</Text></>}
        </TouchableOpacity>
        <Text style={styles.hint}>{mode === '3d' ? 'A 10-second satellite flyover following your route, with distance counting up. 3D detail varies by location.' : mode === 'rewind' ? 'A smooth 10-second map replay with your route and distance building together.' : mode === 'video' ? 'Video must be under 10 seconds. Distance counts up in the exported clip.' : 'Exports a clean 4:5 image for Instagram, Messages, or anywhere else.'}</Text>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 20, paddingTop: 20 },
  kicker: { color: colors.primaryLight, fontSize: 11, fontWeight: '800', letterSpacing: 2, marginTop: 8 },
  title: { color: colors.white, fontSize: 28, fontWeight: '800', marginTop: 5, marginBottom: 18 },
  card: { width: '100%', aspectRatio: 4 / 5, borderRadius: 24, overflow: 'hidden', backgroundColor: '#171717' },
  mapLoading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  shade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,.26)' },
  brandLogo: { position: 'absolute', top: 14, left: 16, width: 112, height: 72 },
  overlay: { position: 'absolute', left: 20, right: 20, bottom: 22 },
  activity: { color: colors.white, fontSize: 11, fontWeight: '800', letterSpacing: 1.8 },
  distance: { color: colors.white, fontSize: 58, fontWeight: '900', lineHeight: 62, letterSpacing: -2.5 },
  unit: { color: colors.white, fontSize: 13, fontWeight: '800', letterSpacing: 2 },
  stats: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,.55)' },
  statValue: { color: colors.white, fontSize: 17, fontWeight: '800' },
  statLabel: { color: 'rgba(255,255,255,.8)', fontSize: 9, fontWeight: '700', letterSpacing: 1, marginTop: 3 },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 16 },
  option: { width: '48%', flexGrow: 1, height: 48, borderRadius: 14, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' },
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
