// components/palettes/SaveToBoardSheet.js
// Bottom sheet for saving a palette into boards. Two modes:
//  - draft:   a palette that does not exist yet (from the wheel or a photo). Asks for a name and
//             whether to share it, creates it, uploads its photo if any, then files it in boards.
//  - palette: an existing palette (yours or someone's from the community). Only picks boards.
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, Pressable, Modal, ScrollView, Switch, ActivityIndicator, Alert,
  KeyboardAvoidingView, Platform, StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { paletteApi } from '../../services/paletteApi';
import { ui } from './theme';

export const SaveToBoardSheet = ({ visible, onClose, palette = null, draft = null, defaultBoardId = null, onSaved }) => {
  const [boards, setBoards] = useState([]);
  const [loadingBoards, setLoadingBoards] = useState(false);
  const [selected, setSelected] = useState([]);
  const [title, setTitle] = useState('');
  const [shared, setShared] = useState(false);
  const [newBoardName, setNewBoardName] = useState('');
  const [creatingBoard, setCreatingBoard] = useState(false);
  const [saving, setSaving] = useState(false);

  const colors = (draft || palette)?.colors || [];
  // Pictures captured from the web are someone else's: those palettes are private-only
  const webCapture = draft?.imageSource === 'web';

  // Reset every time the sheet opens
  useEffect(() => {
    if (!visible) return;
    setSelected(defaultBoardId ? [defaultBoardId] : []);
    setTitle(draft?.title || '');
    setShared(false);
    setNewBoardName('');
    setSaving(false);
    setLoadingBoards(true);
    let cancelled = false;
    paletteApi.listBoards()
      .then((list) => { if (!cancelled) setBoards(Array.isArray(list) ? list : []); })
      .catch((error) => console.warn('SaveToBoardSheet: could not load boards', error?.message))
      .finally(() => { if (!cancelled) setLoadingBoards(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const toggleBoard = useCallback((boardId) => {
    setSelected((prev) => (prev.includes(boardId) ? prev.filter((id) => id !== boardId) : [...prev, boardId]));
  }, []);

  const createBoard = useCallback(async () => {
    const name = newBoardName.trim();
    if (!name || creatingBoard) return;
    setCreatingBoard(true);
    try {
      const board = await paletteApi.createBoard(name);
      setBoards((prev) => [board, ...prev]);
      setSelected((prev) => [...prev, board.id]);
      setNewBoardName('');
    } catch (error) {
      Alert.alert('Could not create board', error?.message || 'Please try again.');
    } finally {
      setCreatingBoard(false);
    }
  }, [newBoardName, creatingBoard]);

  const canSave = !saving && (draft ? true : selected.length > 0);

  const save = useCallback(async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      let saved = palette;
      if (draft) {
        saved = await paletteApi.createPalette({
          base_color: draft.base_color,
          scheme: draft.scheme,
          colors: draft.colors,
          title: title.trim() || draft.title || 'My palette',
          description: draft.description || '',
          privacy: shared && !webCapture ? 'public' : 'private',
        });
        if (draft.imageUri) {
          try {
            Object.assign(saved, await paletteApi.uploadImage(saved.id, draft.imageUri, webCapture ? 'web' : 'photo'));
          } catch (error) {
            // The palette itself is saved; only the photo failed
            console.warn('SaveToBoardSheet: photo upload failed', error?.message);
            Alert.alert('Photo not attached', 'Your palette was saved, but the photo could not be uploaded.');
          }
        }
      }
      await Promise.all(selected.map((boardId) => paletteApi.addToBoard(boardId, saved.id)));
      onSaved?.(saved, selected);
      onClose?.();
    } catch (error) {
      Alert.alert('Could not save', error?.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  }, [canSave, palette, draft, title, shared, webCapture, selected, onSaved, onClose]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.dismiss} onPress={onClose} accessibilityLabel="Close" />
        <View style={styles.sheet}>
          <View style={styles.grabber} />
          <Text style={styles.heading}>{draft ? 'Save palette' : 'Save to a board'}</Text>

          <View style={styles.preview}>
            {colors.map((c, i) => <View key={`${i}-${c}`} style={{ flex: 1, backgroundColor: c }} />)}
          </View>

          {draft && (
            <>
              <TextInput
                style={styles.input}
                value={title}
                onChangeText={setTitle}
                placeholder="Name this palette"
                placeholderTextColor={ui.faint}
                maxLength={100}
                returnKeyType="done"
              />
              {webCapture ? (
                <View style={styles.shareRow}>
                  <Ionicons name="lock-closed-outline" size={20} color={ui.muted} />
                  <View style={styles.privateText}>
                    <Text style={styles.shareTitle}>Private</Text>
                    <Text style={styles.shareHint}>Pictures from the web stay in your boards. Only you can see them.</Text>
                  </View>
                </View>
              ) : (
                <View style={styles.shareRow}>
                  <View style={styles.shareText}>
                    <Text style={styles.shareTitle}>Share with the community</Text>
                    <Text style={styles.shareHint}>
                      {draft.imageUri ? 'Others will see this palette and its photo.' : 'Others will see this palette.'}
                    </Text>
                  </View>
                  <Switch value={shared} onValueChange={setShared} />
                </View>
              )}
            </>
          )}

          <Text style={styles.label}>Boards</Text>
          <ScrollView style={styles.boardList} keyboardShouldPersistTaps="handled">
            {loadingBoards && <ActivityIndicator style={styles.spinner} color={ui.muted} />}
            {!loadingBoards && boards.length === 0 && (
              <Text style={styles.noBoards}>No boards yet. Create one below to organize your palettes.</Text>
            )}
            {boards.map((board) => {
              const on = selected.includes(board.id);
              return (
                <Pressable
                  key={board.id}
                  style={styles.boardRow}
                  onPress={() => toggleBoard(board.id)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={board.name}
                >
                  <Ionicons name="folder-outline" size={20} color={ui.muted} />
                  <Text style={styles.boardName} numberOfLines={1}>{board.name}</Text>
                  <Ionicons
                    name={on ? 'checkmark-circle' : 'ellipse-outline'}
                    size={24}
                    color={on ? ui.primary : ui.line}
                  />
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={styles.newBoardRow}>
            <TextInput
              style={[styles.input, styles.newBoardInput]}
              value={newBoardName}
              onChangeText={setNewBoardName}
              placeholder="New board name"
              placeholderTextColor={ui.faint}
              maxLength={100}
              returnKeyType="done"
              onSubmitEditing={createBoard}
            />
            <Pressable
              style={[styles.addButton, (!newBoardName.trim() || creatingBoard) && styles.disabled]}
              onPress={createBoard}
              disabled={!newBoardName.trim() || creatingBoard}
              accessibilityRole="button"
              accessibilityLabel="Create board"
            >
              {creatingBoard ? <ActivityIndicator color={ui.text} /> : <Ionicons name="add" size={22} color={ui.text} />}
            </Pressable>
          </View>

          <Pressable
            style={[styles.saveButton, !canSave && styles.disabled]}
            onPress={save}
            disabled={!canSave}
            accessibilityRole="button"
            accessibilityLabel="Save"
          >
            {saving
              ? <ActivityIndicator color="#FFFFFF" />
              : <Text style={styles.saveText}>
                  {selected.length > 0 ? `Save to ${selected.length} board${selected.length > 1 ? 's' : ''}` : 'Save'}
                </Text>}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  dismiss: { flex: 1 },
  sheet: {
    backgroundColor: ui.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 32,
    maxHeight: '88%',
  },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#D1D5DB', marginBottom: 12 },
  heading: { fontSize: 18, fontWeight: '700', color: ui.text },
  preview: { flexDirection: 'row', height: 44, borderRadius: 12, overflow: 'hidden', marginTop: 12 },
  input: {
    height: 46,
    borderWidth: 1,
    borderColor: ui.line,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 16,
    color: ui.text,
    marginTop: 12,
  },
  shareRow: { flexDirection: 'row', alignItems: 'center', marginTop: 14 },
  shareText: { flex: 1, paddingRight: 12 },
  privateText: { flex: 1, paddingLeft: 10 },
  shareTitle: { fontSize: 15, fontWeight: '600', color: ui.text },
  shareHint: { fontSize: 12, color: ui.muted, marginTop: 2 },
  label: { marginTop: 18, fontSize: 13, fontWeight: '600', color: ui.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  boardList: { maxHeight: 190, marginTop: 4 },
  spinner: { marginVertical: 16 },
  noBoards: { fontSize: 14, color: ui.muted, paddingVertical: 12 },
  boardRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11 },
  boardName: { flex: 1, marginLeft: 10, fontSize: 16, color: ui.text },
  newBoardRow: { flexDirection: 'row', alignItems: 'center' },
  newBoardInput: { flex: 1 },
  addButton: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: ui.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
    marginTop: 12,
  },
  saveButton: {
    height: 50,
    borderRadius: 25,
    backgroundColor: ui.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
  },
  saveText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  disabled: { opacity: 0.45 },
});

export default SaveToBoardSheet;
