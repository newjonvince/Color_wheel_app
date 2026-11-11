// components/palettes/PaletteDetailModal.js - One palette, large: photo, every color with its hex,
// and what you can do with it (like, save to a board, try on the wheel, share/delete, report/block).
import React, { useState, useCallback } from 'react';
import { View, Text, Image, Pressable, Modal, ScrollView, Switch, Alert, StyleSheet, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { paletteApi } from '../../services/paletteApi';
import { SaveToBoardSheet } from './SaveToBoardSheet';
import { ui, inkFor, schemeLabel } from './theme';

const REPORT_REASONS = [
  { key: 'inappropriate', label: 'Inappropriate or offensive' },
  { key: 'spam', label: 'Spam' },
  { key: 'harassment', label: 'Harassment' },
  { key: 'copyright', label: 'Uses my photo without permission' },
];

const Action = ({ icon, label, onPress, color = ui.text }) => (
  <Pressable style={styles.action} onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
    <Ionicons name={icon} size={22} color={color} />
    <Text style={[styles.actionLabel, { color }]}>{label}</Text>
  </Pressable>
);

/**
 * onChange(event) tells the parent what happened so it can update its lists:
 *   { type: 'updated', palette } | { type: 'deleted', id } | { type: 'removed', id }
 *   { type: 'hidden', id } | { type: 'blocked', userId } | { type: 'saved', palette }
 */
export const PaletteDetailModal = ({
  palette,
  visible,
  onClose,
  currentUserId = null,
  boardId = null,            // set when opened from inside a board: enables "Remove from board"
  onToggleLike,
  onOpenOnWheel,
  onChange,
}) => {
  const { width } = useWindowDimensions();
  const [saveOpen, setSaveOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const isOwner = !!palette && !!currentUserId && palette.user_id === currentUserId;

  const run = useCallback(async (work, failTitle) => {
    if (busy) return;
    setBusy(true);
    try {
      await work();
    } catch (error) {
      Alert.alert(failTitle, error?.message || 'Please try again.');
    } finally {
      setBusy(false);
    }
  }, [busy]);

  if (!palette) return null;
  const colors = Array.isArray(palette.colors) ? palette.colors : [];
  const photoHeight = palette.has_image && palette.image_width
    ? Math.min(420, Math.round(width * (palette.image_height / palette.image_width)))
    : 0;

  const toggleShared = (value) => run(async () => {
    const updated = await paletteApi.updatePalette(palette.id, { privacy: value ? 'public' : 'private' });
    onChange?.({ type: 'updated', palette: { ...palette, ...updated, privacy: value ? 'public' : 'private' } });
  }, 'Could not update');

  const confirmDelete = () => Alert.alert(
    'Delete this palette?',
    'It will be removed from all of your boards and from the community.',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => run(async () => {
          await paletteApi.deletePalette(palette.id);
          onChange?.({ type: 'deleted', id: palette.id });
          onClose?.();
        }, 'Could not delete'),
      },
    ]
  );

  const removeFromBoard = () => run(async () => {
    await paletteApi.removeFromBoard(boardId, palette.id);
    onChange?.({ type: 'removed', id: palette.id });
    onClose?.();
  }, 'Could not remove');

  const report = () => Alert.alert(
    'Report this palette',
    'Why are you reporting it? It will be hidden from your feed.',
    [
      ...REPORT_REASONS.map((r) => ({
        text: r.label,
        onPress: () => run(async () => {
          await paletteApi.report(palette.id, r.key);
          onChange?.({ type: 'hidden', id: palette.id });
          onClose?.();
        }, 'Could not send report'),
      })),
      { text: 'Cancel', style: 'cancel' },
    ]
  );

  const block = () => Alert.alert(
    `Block @${palette.username}?`,
    "You won't see their palettes anymore.",
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Block',
        style: 'destructive',
        onPress: () => run(async () => {
          await paletteApi.blockUser(palette.user_id);
          onChange?.({ type: 'blocked', userId: palette.user_id });
          onClose?.();
        }, 'Could not block'),
      },
    ]
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.root}>
        <View style={styles.topBar}>
          <Text style={styles.topTitle} numberOfLines={1}>{palette.title || 'Untitled palette'}</Text>
          <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close">
            <Ionicons name="close" size={26} color={ui.text} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          {palette.has_image && (
            <Image
              source={paletteApi.imageSource(palette)}
              style={{ width: width - 32, height: photoHeight, borderRadius: ui.radius, backgroundColor: ui.pill }}
              resizeMode="cover"
            />
          )}

          <View style={[styles.swatches, palette.has_image && styles.swatchesBelowPhoto]}>
            {colors.map((hex, i) => (
              <View key={`${i}-${hex}`} style={[styles.swatch, { backgroundColor: hex }]}>
                <Text style={[styles.swatchHex, { color: inkFor(hex) }]} selectable>{String(hex).toUpperCase()}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.meta}>
            {schemeLabel(palette.scheme)} · by @{palette.username || 'you'}
            {palette.like_count > 0 ? ` · ${palette.like_count} like${palette.like_count > 1 ? 's' : ''}` : ''}
          </Text>
          {!!palette.description && <Text style={styles.description}>{palette.description}</Text>}

          <View style={styles.actions}>
            {onToggleLike && (
              <Action
                icon={palette.is_liked ? 'heart' : 'heart-outline'}
                label={palette.is_liked ? 'Liked' : 'Like'}
                color={palette.is_liked ? ui.accent : ui.text}
                onPress={() => onToggleLike(palette)}
              />
            )}
            <Action icon="bookmark-outline" label="Save" onPress={() => setSaveOpen(true)} />
            {onOpenOnWheel && (
              <Action icon="color-palette-outline" label="Try on wheel" onPress={() => onOpenOnWheel(palette)} />
            )}
          </View>

          {isOwner && (
            <View style={styles.section}>
              <View style={styles.row}>
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle}>Share with the community</Text>
                  <Text style={styles.rowHint}>Anyone can see and save shared palettes.</Text>
                </View>
                <Switch value={palette.privacy === 'public'} onValueChange={toggleShared} disabled={busy} />
              </View>
            </View>
          )}

          <View style={styles.section}>
            {boardId && (
              <Pressable style={styles.linkRow} onPress={removeFromBoard} accessibilityRole="button">
                <Ionicons name="remove-circle-outline" size={20} color={ui.text} />
                <Text style={styles.linkText}>Remove from this board</Text>
              </Pressable>
            )}
            {isOwner ? (
              <Pressable style={styles.linkRow} onPress={confirmDelete} accessibilityRole="button">
                <Ionicons name="trash-outline" size={20} color={ui.danger} />
                <Text style={[styles.linkText, { color: ui.danger }]}>Delete palette</Text>
              </Pressable>
            ) : (
              <>
                <Pressable style={styles.linkRow} onPress={report} accessibilityRole="button">
                  <Ionicons name="flag-outline" size={20} color={ui.text} />
                  <Text style={styles.linkText}>Report</Text>
                </Pressable>
                <Pressable style={styles.linkRow} onPress={block} accessibilityRole="button">
                  <Ionicons name="ban-outline" size={20} color={ui.danger} />
                  <Text style={[styles.linkText, { color: ui.danger }]}>Block @{palette.username}</Text>
                </Pressable>
              </>
            )}
          </View>
        </ScrollView>

        {/* Rendered inside this modal so it can present on top of it */}
        <SaveToBoardSheet
          visible={saveOpen}
          onClose={() => setSaveOpen(false)}
          palette={palette}
          onSaved={(saved) => onChange?.({ type: 'saved', palette: saved })}
        />
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: ui.card },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 12,
  },
  topTitle: { flex: 1, fontSize: 20, fontWeight: '700', color: ui.text, paddingRight: 12 },
  content: { paddingHorizontal: 16, paddingBottom: 48 },
  swatches: { borderRadius: ui.radius, overflow: 'hidden' },
  swatchesBelowPhoto: { marginTop: 12 },
  swatch: { height: 58, justifyContent: 'center', paddingHorizontal: 16 },
  swatchHex: { fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] },
  meta: { marginTop: 14, fontSize: 14, color: ui.muted },
  description: { marginTop: 8, fontSize: 15, lineHeight: 22, color: ui.text },
  actions: { flexDirection: 'row', marginTop: 18, gap: 10 },
  action: {
    flex: 1,
    height: 64,
    borderRadius: 14,
    backgroundColor: ui.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: { marginTop: 4, fontSize: 12, fontWeight: '600' },
  section: { marginTop: 22, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: ui.line, paddingTop: 8 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  rowText: { flex: 1, paddingRight: 12 },
  rowTitle: { fontSize: 15, fontWeight: '600', color: ui.text },
  rowHint: { fontSize: 12, color: ui.muted, marginTop: 2 },
  linkRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  linkText: { marginLeft: 10, fontSize: 15, color: ui.text },
});

export default PaletteDetailModal;
