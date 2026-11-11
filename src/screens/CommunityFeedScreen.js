// screens/CommunityFeedScreen.js - A Pinterest-style feed of palettes people chose to share.
// Tap a pin to see it large; heart it; save it into one of your boards.
import React, { useState, useCallback, useRef, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { paletteApi, withLikeToggled, sendLike } from '../services/paletteApi';
import { PaletteGrid } from '../components/palettes/PaletteGrid';
import { PaletteDetailModal } from '../components/palettes/PaletteDetailModal';
import { SaveToBoardSheet } from '../components/palettes/SaveToBoardSheet';
import { ui } from '../components/palettes/theme';

const STALE_MS = 60 * 1000; // refetch on focus only if the feed is older than this

function CommunityFeedScreen({ currentUser, navigation }) {
  const [palettes, setPalettes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [failed, setFailed] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [saving, setSaving] = useState(null); // palette being saved from the grid

  const nextOffset = useRef(0);       // null once the last page has loaded
  const fetching = useRef(false);
  const loadedAt = useRef(0);

  const selected = useMemo(() => palettes.find((p) => p.id === selectedId) || null, [palettes, selectedId]);

  const loadFirstPage = useCallback(async () => {
    if (fetching.current) return;
    fetching.current = true;
    try {
      const page = await paletteApi.feed(0);
      setPalettes(page?.palettes || []);
      nextOffset.current = page?.next_offset ?? null;
      loadedAt.current = Date.now();
      setFailed(false);
    } catch (error) {
      console.warn('CommunityFeedScreen: feed failed', error?.message);
      setFailed(true);
    } finally {
      fetching.current = false;
      setLoading(false);
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (fetching.current || nextOffset.current == null || nextOffset.current === 0) return;
    fetching.current = true;
    setLoadingMore(true);
    try {
      const page = await paletteApi.feed(nextOffset.current);
      const incoming = page?.palettes || [];
      setPalettes((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        return [...prev, ...incoming.filter((p) => !seen.has(p.id))];
      });
      nextOffset.current = page?.next_offset ?? null;
    } catch (error) {
      console.warn('CommunityFeedScreen: next page failed', error?.message);
    } finally {
      fetching.current = false;
      setLoadingMore(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    if (Date.now() - loadedAt.current > STALE_MS) loadFirstPage();
  }, [loadFirstPage]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadFirstPage();
    setRefreshing(false);
  }, [loadFirstPage]);

  const patchPalette = useCallback((id, change) => {
    setPalettes((prev) => prev.map((p) => (p.id === id ? change(p) : p)));
  }, []);

  const toggleLike = useCallback((palette) => {
    if (!currentUser) return;
    patchPalette(palette.id, withLikeToggled);
    sendLike(palette).catch(() => patchPalette(palette.id, withLikeToggled));
  }, [currentUser, patchPalette]);

  const handleDetailChange = useCallback((event) => {
    if (event.type === 'updated') {
      // Un-sharing your own palette takes it out of the feed
      if (event.palette.privacy !== 'public') setPalettes((prev) => prev.filter((p) => p.id !== event.palette.id));
      else patchPalette(event.palette.id, (p) => ({ ...p, ...event.palette }));
    }
    if (event.type === 'deleted' || event.type === 'hidden') {
      setPalettes((prev) => prev.filter((p) => p.id !== event.id));
    }
    if (event.type === 'blocked') {
      setPalettes((prev) => prev.filter((p) => p.user_id !== event.userId));
    }
  }, [patchPalette]);

  const openOnWheel = useCallback((palette) => {
    setSelectedId(null);
    navigation?.navigate('ColorWheel', {
      applyPalette: { hex: palette.base_color, scheme: palette.scheme, nonce: Date.now() },
    });
  }, [navigation]);

  const header = (
    <View style={styles.header}>
      <Text style={styles.title}>Explore</Text>
      <Text style={styles.subtitle}>Palettes and outfit photos shared by the community.</Text>
    </View>
  );

  return (
    <View style={styles.root}>
      <PaletteGrid
        palettes={palettes}
        loading={loading}
        refreshing={refreshing}
        onRefresh={onRefresh}
        onEndReached={loadMore}
        loadingMore={loadingMore}
        onPressPalette={(p) => setSelectedId(p.id)}
        onToggleLike={currentUser ? toggleLike : undefined}
        onSave={currentUser ? setSaving : undefined}
        header={header}
        emptyTitle={failed ? 'Could not load the feed' : 'Nothing shared yet'}
        emptyText={failed
          ? 'Check your connection and pull down to try again.'
          : 'Be the first: save a palette from the Color Wheel or a photo and switch on “Share with the community”.'}
      />

      <PaletteDetailModal
        palette={selected}
        visible={!!selected}
        onClose={() => setSelectedId(null)}
        currentUserId={currentUser?.id}
        onToggleLike={currentUser ? toggleLike : undefined}
        onOpenOnWheel={openOnWheel}
        onChange={handleDetailChange}
      />

      <SaveToBoardSheet
        visible={!!saving}
        palette={saving}
        onClose={() => setSaving(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: ui.bg },
  header: { marginTop: 4, marginBottom: 14 },
  title: { fontSize: 24, fontWeight: '800', color: ui.text },
  subtitle: { marginTop: 2, fontSize: 14, color: ui.muted },
});

export default CommunityFeedScreen;
