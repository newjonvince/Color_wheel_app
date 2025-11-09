
// src/components/ContrastBar.js
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { contrastRatio, nearestAccessible } from '../utils/optimizedColor';

export default function ContrastBar({ background = '#FFFFFF', colors = [] }) {
  if (!colors?.length) return null;
  return (
    <View style={styles.wrap}>
      {colors.map((c, idx) => {
        const ratioBlack = contrastRatio(background, '#000000');
        const ratioWhite = contrastRatio(background, '#FFFFFF');
        const bestText = ratioBlack > ratioWhite ? '#000000' : '#FFFFFF';
        const ratio = contrastRatio(background, c);
        const passAA = ratio >= 4.5;
        const suggestion = !passAA ? nearestAccessible(background, c, 4.5) : null;
        return (
          <View key={idx} style={styles.row}>
            <View style={[styles.swatch, { backgroundColor: c }]} />
            <Text style={styles.hex}>{c}</Text>
            <Text style={[styles.badge, passAA ? styles.pass : styles.fail]}>
              {passAA ? 'AA Pass' : 'Needs nudge'}
            </Text>
            {!passAA && suggestion?.hex && (
              <Text style={styles.suggestion}>→ {suggestion.hex} ({suggestion.ratio.toFixed(2)}:1)</Text>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginHorizontal: 20, marginTop: 12, backgroundColor: '#fff', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#eee' },
  row: { flexDirection: 'row', alignItems: 'center', marginVertical: 6 },
  swatch: { width: 24, height: 24, borderRadius: 4, marginRight: 10, borderWidth: 1, borderColor: '#e0e0e0' },
  hex: { fontFamily: 'Menlo', fontSize: 12, color: '#333', width: 90 },
  badge: { marginLeft: 8, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, overflow: 'hidden', fontSize: 11, fontWeight: '700' },
  pass: { backgroundColor: '#E8F9ED', color: '#117A37' },
  fail: { backgroundColor: '#FDECEC', color: '#B10D0D' },
  suggestion: { marginLeft: 8, fontSize: 12, color: '#555', fontFamily: 'Menlo' }
});
