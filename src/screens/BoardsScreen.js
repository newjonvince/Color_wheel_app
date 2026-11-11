// screens/BoardsScreen.js - Boards are folders of saved palettes.
// Home shows the folders; opening one shows its palettes as a grid.
import React, { useState, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, TextInput, Pressable, Modal, ScrollView, RefreshControl, ActivityIndicator, Alert,
  KeyboardAvoidingView, Platform, StyleSheet, useWindowDimensions,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { paletteApi, withLikeToggled, sendLike } from '../services/paletteApi';
import CoolorsColorExtractor, { pickPhotoAsync } from '../components/CoolorsColorExtractor';
import { PaletteGrid } from '../components/palettes/PaletteGrid';
import { PaletteDetailModal } from '../components/palettes/PaletteDetailModal';
import { SaveToBoardSheet } from '../components/palettes/SaveToBoardSheet';
import { ui } from '../components/palettes/theme';

const ALL = 'all'; // pseudo-board: every palette the user created
const MODAL_HANDOFF_MS = 350; // let one iOS modal finish dismissing before the next presents

// ---------------------------------------------------------------------------
// Small pieces
// ---------------------------------------------------------------------------

// 2x2 mosaic of the newest palettes in a board
const BoardCover = ({ previews, size }) => {
  const cells = previews.slice(0, 4);
  if (cells.length === 0) {
    return (
      <View style={[styles.cover, styles.coverEmpty, { width: size, height: size }]}>
        <Ionicons name="color-palette-outline" size={28} color={ui.faint} />
      </View>
    );
  }
  const single = cells.length === 1;
  return (
    <View style={[styles.cover, { width: size, height: size }]}>
      {cells.map((p, i) => (
        <View
          key={p.id}
          style={{
            width: single ? '100%' : '50%',
            height: single || cells.length === 2 ? '100%' : '50%',
            flexDirection: 'row',
            borderRightWidth: !single && i % 2 === 0 ? 1 : 0,
            borderBottomWidth: cells.length > 2 && i < 2 ? 1 : 0,
            borderColor: ui.card,
          }}
        >
          {(p.colors || []).map((c, j) => <View key={`${j}-${c}`} style={{ flex: 1, backgroundColor: c }} />)}
        </View>
      ))}
    </View>
  );
};

const NamePrompt = ({ visible, title, initialValue = '', confirmLabel, onSubmit, onClose }) => {
  const [value, setValue] = useState(initialValue);
  React.useEffect(() => { if (visible) setValue(initialValue); }, [visible, initialValue]);
  const submit = () => { if (value.trim()) onSubmit(value.trim()); };
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.promptBackdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.prompt}>
          <Text style={styles.promptTitle}>{title}</Text>
          <TextInput
            style={styles.promptInput}
            value={value}
            onChangeText={setValue}
            placeholder="e.g. Summer wardrobe"
            placeholderTextColor={ui.faint}
            maxLength={100}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={submit}
          />
          <View style={styles.promptButtons}>
            <Pressable style={styles.promptCancel} onPress={onClose} accessibilityRole="button">
              <Text style={styles.promptCancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.promptConfirm, !value.trim() && styles.disabled]}
              onPress={submit}
              disabled={!value.trim()}
              accessibilityRole="button"
            >
              <Text style={styles.promptConfirmText}>{confirmLabel}</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

function BoardsScreen({ currentUser, navigation }) {
  const { width } = useWindowDimensions();
  const tile = Math.floor((width - ui.gutter * 2 - 12) / 2);

  const [boards, setBoards] = useState([]);
  const [mine, setMine] = useState([]);          // palettes the user created
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [open, setOpen] = useState(null);         // null = home, ALL, or a board { id, name }
  const [palettes, setPalettes] = useState([]);   // palettes of the open board
  const [loadingBoard, setLoadingBoard] = useState(false);

  const [selectedId, setSelectedId] = useState(null);
  const [prompt, setPrompt] = useState(null);     // { mode: 'create' } | { mode: 'rename', board }
  const [photoUri, setPhotoUri] = useState(null);
  const [draft, setDraft] = useState(null);       // photo palette waiting to be saved
  const pickingRef = useRef(false);
  const openRef = useRef(open);
  openRef.current = open;

  const isAll = open === ALL;
  const shown = isAll ? mine : palettes;
  const selected = useMemo(() => shown.find((p) => p.id === selectedId) || null, [shown, selectedId]);

  // ----- loading -----
  const loadHome = useCallback(async () => {
    try {
      const [boardList, myPalettes] = await Promise.all([paletteApi.listBoards(), paletteApi.myPalettes()]);
      setBoards(Array.isArray(boardList) ? boardList : []);
      setMine(Array.isArray(myPalettes) ? myPalettes : []);
    } catch (error) {
      console.warn('BoardsScreen: load failed', error?.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadBoard = useCallback(async (boardId) => {
    setLoadingBoard(true);
    try {
      const data = await paletteApi.getBoard(boardId);
      if (openRef.current?.id === boardId) setPalettes(data?.palettes || []);
    } catch (error) {
      Alert.alert('Could not open board', error?.message || 'Please try again.');
    } finally {
      setLoadingBoard(false);
    }
  }, []);

  const reload = useCallback(async () => {
    await loadHome();
    const current = openRef.current;
    if (current && current !== ALL) await loadBoard(current.id);
  }, [loadHome, loadBoard]);

  // Refresh whenever the tab is shown: palettes are saved from other tabs
  useFocusEffect(useCallback(() => {
    if (currentUser) reload();
  }, [currentUser, reload]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  }, [reload]);

  const openBoard = useCallback((board) => {
    setPalettes([]);
    setOpen(board);
    if (board !== ALL) loadBoard(board.id);
  }, [loadBoard]);

  // ----- board actions -----
  const submitPrompt = useCallback(async (name) => {
    const current = prompt;
    setPrompt(null);
    try {
      if (current?.mode === 'rename') {
        const updated = await paletteApi.updateBoard(current.board.id, { name });
        setBoards((prev) => prev.map((b) => (b.id === updated.id ? { ...b, name: updated.name } : b)));
        setOpen((prev) => (prev && prev !== ALL && prev.id === updated.id ? { ...prev, name: updated.name } : prev));
      } else {
        const board = await paletteApi.createBoard(name);
        setBoards((prev) => [board, ...prev]);
      }
    } catch (error) {
      Alert.alert('Could not save board', error?.message || 'Please try again.');
    }
  }, [prompt]);

  const boardMenu = useCallback((board) => {
    Alert.alert(board.name, undefined, [
      { text: 'Rename', onPress: () => setPrompt({ mode: 'rename', board }) },
      {
        text: 'Delete board',
        style: 'destructive',
        onPress: () => Alert.alert('Delete this board?', 'Your palettes are kept; only the board is removed.', [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                await paletteApi.deleteBoard(board.id);
                setBoards((prev) => prev.filter((b) => b.id !== board.id));
                setOpen(null);
              } catch (error) {
                Alert.alert('Could not delete board', error?.message || 'Please try again.');
              }
            },
          },
        ]),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, []);

  // ----- palette actions -----
  const patchPalette = useCallback((id, change) => {
    const apply = (list) => list.map((p) => (p.id === id ? change(p) : p));
    setPalettes(apply);
    setMine(apply);
  }, []);

  const toggleLike = useCallback((palette) => {
    patchPalette(palette.id, withLikeToggled);
    sendLike(palette).catch(() => patchPalette(palette.id, withLikeToggled));
  }, [patchPalette]);

  const handleDetailChange = useCallback((event) => {
    if (event.type === 'updated') patchPalette(event.palette.id, (p) => ({ ...p, ...event.palette }));
    if (event.type === 'deleted' || event.type === 'removed' || event.type === 'hidden') {
      setPalettes((prev) => prev.filter((p) => p.id !== event.id));
      if (event.type === 'deleted') setMine((prev) => prev.filter((p) => p.id !== event.id));
    }
    if (event.type === 'blocked') setPalettes((prev) => prev.filter((p) => p.user_id !== event.userId));
    loadHome(); // counts and covers
  }, [patchPalette, loadHome]);

  const openOnWheel = useCallback((palette) => {
    setSelectedId(null);
    navigation?.navigate('ColorWheel', {
      applyPalette: { hex: palette.base_color, scheme: palette.scheme, nonce: Date.now() },
    });
  }, [navigation]);

  // ----- palette from a photo -----
  const startPhotoPick = useCallback(async (source) => {
    if (pickingRef.current) return;
    pickingRef.current = true;
    try {
      const uri = await pickPhotoAsync(source);
      if (uri) setTimeout(() => setPhotoUri(uri), MODAL_HANDOFF_MS);
    } catch (error) {
      Alert.alert('Could not open photos', 'Please try again.');
    } finally {
      pickingRef.current = false;
    }
  }, []);

  const handleExtracted = useCallback((result) => {
    const colors = result?.slots || [];
    setPhotoUri(null);
    if (colors.length === 0) return;
    setTimeout(() => setDraft({
      base_color: colors[0],
      scheme: 'custom',
      colors,
      title: '',
      imageUri: result.imageUri,
    }), MODAL_HANDOFF_MS);
  }, []);

  // ----- render -----
  if (!currentUser) {
    return (
      <View style={styles.center}>
        <Text style={styles.centerTitle}>Sign in to use boards</Text>
        <Text style={styles.centerText}>Boards keep your saved palettes organized.</Text>
      </View>
    );
  }

  const photoButtons = (
    <View style={styles.photoRow}>
      <Pressable style={styles.photoButton} onPress={() => startPhotoPick('camera')} accessibilityRole="button" accessibilityLabel="New palette from the camera">
        <Ionicons name="camera-outline" size={18} color={ui.text} />
        <Text style={styles.photoButtonText}>Camera</Text>
      </Pressable>
      <Pressable style={styles.photoButton} onPress={() => startPhotoPick('library')} accessibilityRole="button" accessibilityLabel="New palette from a photo">
        <Ionicons name="images-outline" size={18} color={ui.text} />
        <Text style={styles.photoButtonText}>Photo library</Text>
      </Pressable>
    </View>
  );

  const modals = (
    <>
      <PaletteDetailModal
        palette={selected}
        visible={!!selected}
        onClose={() => setSelectedId(null)}
        currentUserId={currentUser?.id}
        boardId={open && open !== ALL ? open.id : null}
        onToggleLike={toggleLike}
        onOpenOnWheel={openOnWheel}
        onChange={handleDetailChange}
      />
      <NamePrompt
        visible={!!prompt}
        title={prompt?.mode === 'rename' ? 'Rename board' : 'New board'}
        initialValue={prompt?.mode === 'rename' ? prompt.board.name : ''}
        confirmLabel={prompt?.mode === 'rename' ? 'Save' : 'Create'}
        onSubmit={submitPrompt}
        onClose={() => setPrompt(null)}
      />
      <Modal visible={!!photoUri} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => setPhotoUri(null)}>
        {photoUri && (
          <CoolorsColorExtractor
            initialImageUri={photoUri}
            maxColors={5}
            onComplete={handleExtracted}
            onClose={() => setPhotoUri(null)}
          />
        )}
      </Modal>
      <SaveToBoardSheet
        visible={!!draft}
        draft={draft}
        defaultBoardId={open && open !== ALL ? open.id : null}
        onClose={() => setDraft(null)}
        onSaved={reload}
      />
    </>
  );

  // ---- inside a board ----
  if (open) {
    const name = isAll ? 'All my palettes' : open.name;
    return (
      <View style={styles.root}>
        <View style={styles.boardBar}>
          <Pressable onPress={() => setOpen(null)} hitSlop={10} style={styles.back} accessibilityRole="button" accessibilityLabel="Back to boards">
            <Ionicons name="chevron-back" size={24} color={ui.text} />
          </Pressable>
          <View style={styles.boardBarText}>
            <Text style={styles.boardBarTitle} numberOfLines={1}>{name}</Text>
            <Text style={styles.boardBarCount}>{shown.length} palette{shown.length === 1 ? '' : 's'}</Text>
          </View>
          {!isAll && (
            <Pressable onPress={() => boardMenu(open)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Board options">
              <Ionicons name="ellipsis-horizontal" size={22} color={ui.text} />
            </Pressable>
          )}
        </View>
        <PaletteGrid
          palettes={shown}
          loading={loadingBoard}
          refreshing={refreshing}
          onRefresh={onRefresh}
          onPressPalette={(p) => setSelectedId(p.id)}
          onToggleLike={isAll ? undefined : toggleLike}
          header={photoButtons}
          emptyTitle={isAll ? 'No palettes yet' : 'This board is empty'}
          emptyText={isAll
            ? 'Build one on the Color Wheel or pick colors from a photo above.'
            : 'Save a palette here from the Color Wheel, the Community, or a photo above.'}
        />
        {modals}
      </View>
    );
  }

  // ---- home: the folders ----
  const allPreviews = mine.slice(0, 4).map((p) => ({ id: p.id, colors: p.colors }));
  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.home}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.homeHeader}>
          <View style={styles.homeHeaderText}>
            <Text style={styles.homeTitle}>Your boards</Text>
            <Text style={styles.homeSubtitle}>Folders for the palettes you save.</Text>
          </View>
          <Pressable style={styles.newBoard} onPress={() => setPrompt({ mode: 'create' })} accessibilityRole="button" accessibilityLabel="New board">
            <Ionicons name="add" size={18} color="#FFFFFF" />
            <Text style={styles.newBoardText}>New board</Text>
          </Pressable>
        </View>

        <Text style={styles.sectionLabel}>New palette from a photo</Text>
        {photoButtons}

        {loading ? (
          <ActivityIndicator style={styles.spinner} color={ui.muted} />
        ) : (
          <View style={styles.grid}>
            <Pressable style={[styles.tile, { width: tile }]} onPress={() => openBoard(ALL)} accessibilityRole="button" accessibilityLabel={`All my palettes, ${mine.length}`}>
              <BoardCover previews={allPreviews} size={tile} />
              <Text style={styles.tileName} numberOfLines={1}>All my palettes</Text>
              <Text style={styles.tileCount}>{mine.length} palette{mine.length === 1 ? '' : 's'}</Text>
            </Pressable>
            {boards.map((board) => (
              <Pressable
                key={board.id}
                style={[styles.tile, { width: tile }]}
                onPress={() => openBoard({ id: board.id, name: board.name })}
                onLongPress={() => boardMenu(board)}
                accessibilityRole="button"
                accessibilityLabel={`${board.name}, ${board.palette_count} palettes`}
              >
                <BoardCover previews={board.previews || []} size={tile} />
                <Text style={styles.tileName} numberOfLines={1}>{board.name}</Text>
                <Text style={styles.tileCount}>{board.palette_count} palette{board.palette_count === 1 ? '' : 's'}</Text>
              </Pressable>
            ))}
          </View>
        )}

        {!loading && boards.length === 0 && (
          <Text style={styles.hint}>
            Create a board like “Work outfits” or “Wedding guest”, then save palettes into it from the Color Wheel
            or the Community.
          </Text>
        )}
      </ScrollView>
      {modals}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: ui.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: ui.bg },
  centerTitle: { fontSize: 18, fontWeight: '700', color: ui.text },
  centerText: { marginTop: 8, fontSize: 14, color: ui.muted, textAlign: 'center' },

  home: { padding: ui.gutter, paddingBottom: 32 },
  homeHeader: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  homeHeaderText: { flex: 1, paddingRight: 12 },
  homeTitle: { fontSize: 24, fontWeight: '800', color: ui.text },
  homeSubtitle: { marginTop: 2, fontSize: 14, color: ui.muted },
  newBoard: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: ui.primary,
  },
  newBoardText: { marginLeft: 4, color: '#FFFFFF', fontSize: 14, fontWeight: '700' },

  sectionLabel: { marginTop: 20, marginBottom: 8, fontSize: 13, fontWeight: '600', color: ui.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  photoRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  photoButton: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    backgroundColor: ui.card,
    borderWidth: 1,
    borderColor: ui.line,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoButtonText: { marginLeft: 8, fontSize: 14, fontWeight: '600', color: ui.text },

  spinner: { marginTop: 40 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 6 },
  tile: { marginBottom: 18 },
  cover: { borderRadius: ui.radius, overflow: 'hidden', flexDirection: 'row', flexWrap: 'wrap', backgroundColor: ui.card },
  coverEmpty: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: ui.line },
  tileName: { marginTop: 8, fontSize: 15, fontWeight: '700', color: ui.text },
  tileCount: { marginTop: 2, fontSize: 12, color: ui.muted },
  hint: { marginTop: 8, fontSize: 14, lineHeight: 20, color: ui.muted },

  boardBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: ui.card,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: ui.line,
  },
  back: { marginRight: 6 },
  boardBarText: { flex: 1 },
  boardBarTitle: { fontSize: 18, fontWeight: '700', color: ui.text },
  boardBarCount: { fontSize: 12, color: ui.muted, marginTop: 1 },

  promptBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 28 },
  prompt: { backgroundColor: ui.card, borderRadius: 20, padding: 20 },
  promptTitle: { fontSize: 18, fontWeight: '700', color: ui.text },
  promptInput: {
    height: 46,
    borderWidth: 1,
    borderColor: ui.line,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 16,
    color: ui.text,
    marginTop: 14,
  },
  promptButtons: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 16, gap: 10 },
  promptCancel: { height: 42, paddingHorizontal: 16, justifyContent: 'center' },
  promptCancelText: { fontSize: 15, fontWeight: '600', color: ui.muted },
  promptConfirm: { height: 42, paddingHorizontal: 20, borderRadius: 21, backgroundColor: ui.primary, justifyContent: 'center' },
  promptConfirmText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  disabled: { opacity: 0.45 },
});

export default BoardsScreen;
