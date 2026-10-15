import React, { useEffect, useRef } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from 'react-native-maps';
import { RoutePoint } from '../../types';
import { colors } from '../../theme/colors';

type Props = {
  points: RoutePoint[];
  live?: boolean;
  interactive?: boolean;
  visiblePoints?: RoutePoint[];
  emptyMessage?: string;
  contextPoints?: RoutePoint[];
};

export const RunMap: React.FC<Props> = ({ points, live = false, interactive = true, visiblePoints, emptyMessage, contextPoints }) => {
  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    if (points.length > 1) {
      mapRef.current?.fitToCoordinates(contextPoints || points, {
        edgePadding: { top: 64, right: 44, bottom: 64, left: 44 },
        animated: live,
      });
    }
  }, [points.length, live, contextPoints]);

  if (!points.length) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyLabel}>{emptyMessage || 'No GPS route for this activity'}</Text>
      </View>
    );
  }

  const first = points[0];
  const trace = visiblePoints || points;
  const last = trace[trace.length - 1] || first;

  return (
    <MapView
      ref={mapRef}
      provider={PROVIDER_DEFAULT}
      style={StyleSheet.absoluteFill}
      mapType="mutedStandard"
      showsCompass={false}
      showsPointsOfInterest={false}
      showsUserLocation={live}
      followsUserLocation={live && points.length < 2}
      pitchEnabled={interactive}
      rotateEnabled={interactive}
      scrollEnabled={interactive}
      zoomEnabled={interactive}
      initialRegion={{
        latitude: first.latitude,
        longitude: first.longitude,
        latitudeDelta: 0.012,
        longitudeDelta: 0.012,
      }}
      onMapReady={() => mapRef.current?.fitToCoordinates(contextPoints || points, { edgePadding: { top: 64, right: 44, bottom: 64, left: 44 }, animated: false })}
    >
      {contextPoints && contextPoints.length > 1 && <Polyline coordinates={contextPoints} strokeColor="#777777" strokeWidth={4} />}
      {trace.length > 1 && (
        <Polyline
          coordinates={trace}
          strokeColor={colors.primary}
          strokeWidth={5}
          lineCap="round"
          lineJoin="round"
        />
      )}
      {!live && <Marker coordinate={first} pinColor="#23A36D" title="Start" />}
      {!live && !visiblePoints && points.length > 1 && <Marker coordinate={last} pinColor={colors.primary} title="Finish" />}
    </MapView>
  );
};

const styles = StyleSheet.create({
  empty: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#151515',
  },
  emptyLabel: { color: colors.textSecondary, fontSize: 13 },
});
