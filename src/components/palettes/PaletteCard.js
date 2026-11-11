// components/palettes/PaletteCard.js - A "pin": optional photo, the palette, who made it, like + save
import React from 'react';
import { View, Text, Image, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { paletteApi } from '../../services/paletteApi';
import { ui } from './theme';

const FOOTER_HEIGHT = 66;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

const imageHeight = (palette, width) => {
  if (!palette.has_image) return 0;
  const ratio = palette.image_width && palette.image_height ? palette.image_height / palette.image_width : 1;
  return Math.round(width * clamp(ratio, 0.6, 1.5));
};

// Palettes without a photo get a taller swatch block so the grid still has rhythm
const stripHeight = (palette) => (palette.has_image ? 28 : 84 + Math.min(5, palette.colors?.length || 1) * 12);

export const estimateCardHeight = (palette, width) =>
  imageHeight(palette, width) + stripHeight(palette) + FOOTER_HEIGHT;

export const PaletteCard = React.memo(({ palette, width, onPress, onToggleLike, onSave }) => {
  const colors = Array.isArray(palette.colors) ? palette.colors : [];
  return (
    <Pressable
      style={[styles.card, { width }]}
      onPress={() => onPress?.(palette)}
      accessibilityRole="button"
      accessibilityLabel={`${palette.title || 'Palette'} by ${palette.username || 'unknown'}, ${colors.length} colors`}
    >
      {palette.has_image && (
        <Image
          source={paletteApi.imageSource(palette)}
          style={{ width, height: imageHeight(palette, width), backgroundColor: colors[0] || ui.pill }}
          resizeMode="cover"
        />
      )}
      <View style={[styles.strip, { height: stripHeight(palette) }]}>
        {colors.map((c, i) => <View key={`${i}-${c}`} style={{ flex: 1, backgroundColor: c }} />)}
      </View>

      <View style={styles.footer}>
        <Text style={styles.title} numberOfLines={1}>{palette.title || 'Untitled palette'}</Text>
        <View style={styles.metaRow}>
          <Text style={styles.author} numberOfLines={1}>@{palette.username || 'you'}</Text>
          {onToggleLike && (
            <Pressable
              onPress={() => onToggleLike(palette)}
              hitSlop={8}
              style={styles.action}
              accessibilityRole="button"
              accessibilityLabel={palette.is_liked ? 'Unlike' : 'Like'}
            >
              <Ionicons
                name={palette.is_liked ? 'heart' : 'heart-outline'}
                size={18}
                color={palette.is_liked ? ui.accent : ui.muted}
              />
              {palette.like_count > 0 && <Text style={styles.count}>{palette.like_count}</Text>}
            </Pressable>
          )}
          {onSave && (
            <Pressable
              onPress={() => onSave(palette)}
              hitSlop={8}
              style={styles.action}
              accessibilityRole="button"
              accessibilityLabel="Save to a board"
            >
              <Ionicons name="bookmark-outline" size={18} color={ui.muted} />
            </Pressable>
          )}
        </View>
      </View>
    </Pressable>
  );
});

PaletteCard.displayName = 'PaletteCard';

const styles = StyleSheet.create({
  card: {
    backgroundColor: ui.card,
    borderRadius: ui.radius,
    overflow: 'hidden',
    marginBottom: 10,
  },
  strip: { flexDirection: 'row' },
  footer: { height: FOOTER_HEIGHT, paddingHorizontal: 12, justifyContent: 'center' },
  title: { fontSize: 14, fontWeight: '600', color: ui.text },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  author: { flex: 1, fontSize: 12, color: ui.muted },
  action: { flexDirection: 'row', alignItems: 'center', marginLeft: 12 },
  count: { marginLeft: 3, fontSize: 12, color: ui.muted, fontVariant: ['tabular-nums'] },
});

export default PaletteCard;
