// screens/CommunityFeedScreen.js - A Pinterest-style feed of palettes people chose to share.
// Tap a pin to see it large; heart it; save it into one of your boards.
//
// "Explore inspiration" on the Color Wheel opens this tab with route.params.similarTo =
// { colors: ['#RRGGBB', ...], nonce }: the feed then shows shared palettes closest to those colors.
import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { paletteApi, withLikeToggled, sendLike } from '../services/paletteApi';
import { PaletteGrid } from '../components/palettes/PaletteGrid';
import { PaletteDetailModal } from '../components/palettes/PaletteDetailModal';
import { SaveToBoardSheet } from '../components/palettes/SaveToBoardSheet';
import { ui } from '../components/palettes/theme';

const STALE_MS = 60 * 1000; // refetch on focus only if the feed is older than this

function CommunityFeedScreen({ currentUser, navigation, route }) {
  const [palettes, setPalettes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [failed, setFailed] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [saving, setSaving] = useState(null); // palette being saved from the grid
  const [match, setMatch] = useState(null);   // colors being matched, or null for the whole feed

  const matchRef = useRef(null);      // same as `match`, readable from inside loads
  const nextOffset = useRef(0);       // null once the last page has loaded
  const fetching = useRef(false);     // a next-page request is in flight
  const loadSeq = useRef(0);          // bumped by every first-page load; older answers are dropped
  const loadedAt = useRef(0);

  const selected = useMemo(() => palettes.find((p) => p.id === selectedId) || null, [palettes, selectedId]);

  const loadFirstPage = useCallback(async () => {
    const seq = ++loadSeq.current;
    const colors = matchRef.current;
    try {
      const page = colors ? await paletteApi.similar(colors) : await paletteApi.feed(0);
      if (seq !== loadSeq.current) return;
      setPalettes(page?.palettes || []);
      nextOffset.current = page?.next_offset ?? null;
      loadedAt.current = Date.now();
      setFailed(false);
    } catch (error) {
      if (seq !== loadSeq.current) return;
      console.warn('CommunityFeedScreen: feed failed', error?.message);
      setFailed(true);
    } finally {
      if (seq === loadSeq.current) setLoading(false);
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (fetching.current || nextOffset.current == null || nextOffset.current === 0) return;
    const seq = loadSeq.current;
    fetching.current = true;
    setLoadingMore(true);
    try {
      const page = await paletteApi.feed(nextOffset.current);
      if (seq !== loadSeq.current) return; // the list was replaced while this page was loading
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

  // Switch between the whole feed (null) and palettes close to a set of colors
  const showMatch = useCallback((colors) => {
    matchRef.current = colors;
    setMatch(colors);
    setPalettes([]);
    setLoading(true);
    loadFirstPage();
  }, [loadFirstPage]);

  const similarTo = route?.params?.similarTo;
  const handledNonce = useRef(null);
  useEffect(() => {
    if (!similarTo || handledNonce.current === similarTo.nonce) return;
    handledNonce.current = similarTo.nonce;
    const colors = Array.isArray(similarTo.colors) ? similarTo.colors.filter(Boolean).slice(0, 8) : [];
    if (colors.length > 0) showMatch(colors);
  }, [similarTo, showMatch]);

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

  const header = match ? (
    <View style={styles.header}>
      <Text style={styles.title}>Inspiration</Text>
      <Text style={styles.subtitle}>Shared palettes closest to your colors, best match first.</Text>
      <View style={styles.matchRow}>
        <View style={styles.matchSwatches} accessibilityLabel={`Your colors: ${match.join(', ')}`}>
          {match.map((hex, i) => (
            <View key={`${i}-${hex}`} style={[styles.matchSwatch, { backgroundColor: hex }]} />
          ))}
        </View>
        <Pressable
          style={styles.showAll}
          onPress={() => showMatch(null)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Show all shared palettes"
        >
          <Ionicons name="close" size={16} color={ui.text} />
          <Text style={styles.showAllText}>Show all</Text>
        </Pressable>
      </View>
    </View>
  ) : (
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

  matchRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  matchSwatches: {
    flex: 1,
    flexDirection: 'row',
    height: 36,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: ui.line,
  },
  matchSwatch: { flex: 1 },
  showAll: {
    marginLeft: 10,
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: ui.line,
    backgroundColor: ui.card,
    flexDirection: 'row',
    alignItems: 'center',
  },
  showAllText: { marginLeft: 4, fontSize: 13, fontWeight: '600', color: ui.text },
});

export default CommunityFeedScreen;
