import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export const Metric = ({ value, label }: { value: string; label: string }) => (
  <View style={trainingStyles.metric}><Text adjustsFontSizeToFit numberOfLines={1} style={trainingStyles.value}>{value}</Text><Text style={trainingStyles.label}>{label}</Text></View>
);
export const compact = (value: number) => value >= 1000000 ? (value / 1000000).toFixed(1) + 'M' : value >= 1000 ? (value / 1000).toFixed(1) + 'K' : Math.round(value).toLocaleString();
export const localDateKey = (date: Date) => [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
export const trainingStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000' },
  content: { padding: 20, paddingBottom: 40, gap: 20 },
  eyebrow: { color: '#CC0100', fontSize: 11, fontWeight: '900', letterSpacing: 2 },
  title: { color: '#fff', fontSize: 34, fontWeight: '900', letterSpacing: -1, marginTop: 8 },
  copy: { color: '#B0B0B0', fontSize: 13, lineHeight: 20, marginTop: 8 },
  card: { backgroundColor: '#171717', borderRadius: 24, borderWidth: 1, borderColor: '#303030', padding: 20 },
  heading: { color: '#fff', fontSize: 21, fontWeight: '800', letterSpacing: -0.5 },
  row: { flexDirection: 'row', gap: 14 },
  metric: { flex: 1, minWidth: 0 },
  value: { color: '#fff', fontSize: 27, fontWeight: '900', letterSpacing: -0.7 },
  label: { color: '#B0B0B0', fontSize: 10, fontWeight: '800', letterSpacing: 1, marginTop: 6 },
});
