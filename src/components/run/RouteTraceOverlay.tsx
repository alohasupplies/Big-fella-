import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Polyline } from 'react-native-svg';
import { RoutePoint } from '../../types';
import { colors } from '../../theme/colors';

export const normalizedRoutePoints = (route: RoutePoint[]) => {
  const validRoute = route.filter(point => Number.isFinite(point.latitude) && Number.isFinite(point.longitude));
  if (validRoute.length < 2) return [];
  const latitudes = validRoute.map(point => point.latitude);
  const longitudes = validRoute.map(point => point.longitude);
  const minLat = Math.min(...latitudes); const maxLat = Math.max(...latitudes);
  const minLon = Math.min(...longitudes); const maxLon = Math.max(...longitudes);
  const latitudeScale = Math.max(Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180), 0.01);
  const projectedWidth = Math.max((maxLon - minLon) * latitudeScale, 0.000001);
  const projectedHeight = Math.max(maxLat - minLat, 0.000001);
  const scale = 84 / Math.max(projectedWidth, projectedHeight);
  const drawnWidth = projectedWidth * scale;
  const drawnHeight = projectedHeight * scale;
  const left = (100 - drawnWidth) / 2;
  const top = (100 - drawnHeight) / 2;
  return validRoute.map(point => ({
    x: left + (point.longitude - minLon) * latitudeScale * scale,
    y: top + (maxLat - point.latitude) * scale,
  }));
};

export const RouteTraceOverlay: React.FC<{ route: RoutePoint[] }> = ({ route }) => {
  const points = useMemo(() => normalizedRoutePoints(route), [route]);
  if (points.length < 2) return null;
  const path = points.map(point => `${point.x},${point.y}`).join(' ');
  return (
    <View pointerEvents="none" style={styles.container}>
      <Svg width="100%" height="100%" viewBox="0 0 100 100">
        <Polyline points={path} fill="none" stroke="rgba(0,0,0,.38)" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" />
        <Polyline points={path} fill="none" stroke={colors.primaryLight} strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" />
        <Circle cx={points[0].x} cy={points[0].y} r="2.7" fill="#FFFFFF" stroke={colors.primaryLight} strokeWidth="1.5" />
        <Circle cx={points[points.length - 1].x} cy={points[points.length - 1].y} r="2.7" fill={colors.primaryLight} stroke="#FFFFFF" strokeWidth="1.2" />
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { position: 'absolute', width: '76%', height: '46%', left: '12%', top: '21%' },
});
