// components/palettes/PaletteGrid.js - Two-column masonry of palette cards (the Pinterest layout)
import React, { useMemo, useCallback } from 'react';
import { View, Text, ScrollView, RefreshControl, ActivityIndicator, StyleSheet, useWindowDimensions } from 'react-native';
import { PaletteCard, estimateCardHeight } from './PaletteCard';
import { ui } from './theme';

const GAP = 10;
const END_THRESHOLD = 600;

export const PaletteGrid = ({
  palettes,
  onPressPalette,
  onToggleLike,
  onSave,
  header = null,
  emptyTitle = 'Nothing here yet',
  emptyText = '',
  loading = false,
  refreshing = false,
  onRefresh,
  onEndReached,
  loadingMore = false,
}) => {
  const { width } = useWindowDimensions();
  const columnWidth = Math.floor((width - ui.gutter * 2 - GAP) / 2);

  // Always drop the next card into the shorter column
  const columns = useMemo(() => {
    const cols = [[], []];
    const heights = [0, 0];
    for (const palette of palettes) {
      const target = heights[0] <= heights[1] ? 0 : 1;
      cols[target].push(palette);
      heights[target] += estimateCardHeight(palette, columnWidth) + GAP;
    }
    return cols;
  }, [palettes, columnWidth]);

  const handleScroll = useCallback((e) => {
    if (!onEndReached) return;
    const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent;
    if (contentOffset.y + layoutMeasurement.height > contentSize.height - END_THRESHOLD) onEndReached();
  }, [onEndReached]);

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      onScroll={handleScroll}
      scrollEventThrottle={120}
      refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} /> : undefined}
    >
      {header}

      {loading && palettes.length === 0 ? (
        <ActivityIndicator style={styles.spinner} color={ui.muted} />
      ) : palettes.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>{emptyTitle}</Text>
          {!!emptyText && <Text style={styles.emptyText}>{emptyText}</Text>}
        </View>
      ) : (
        <View style={styles.columns}>
          {columns.map((items, index) => (
            <View key={index} style={{ width: columnWidth }}>
              {items.map((palette) => (
                <PaletteCard
                  key={palette.id}
                  palette={palette}
                  width={columnWidth}
                  onPress={onPressPalette}
                  onToggleLike={onToggleLike}
                  onSave={onSave}
                />
              ))}
            </View>
          ))}
        </View>
      )}

      {loadingMore && <ActivityIndicator style={styles.more} color={ui.muted} />}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: ui.bg },
  content: { padding: ui.gutter, paddingBottom: 32 },
  columns: { flexDirection: 'row', justifyContent: 'space-between' },
  spinner: { marginTop: 48 },
  more: { marginVertical: 16 },
  empty: { alignItems: 'center', paddingHorizontal: 32, paddingTop: 56 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: ui.text, textAlign: 'center' },
  emptyText: { marginTop: 8, fontSize: 14, lineHeight: 20, color: ui.muted, textAlign: 'center' },
});

export default PaletteGrid;
