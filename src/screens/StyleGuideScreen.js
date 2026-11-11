// screens/StyleGuideScreen.js - The Guide tab: how the color wheel works, what each palette type is
// for, and how to wear color. Every palette type can be opened on the wheel to try.
import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { hexToHsl, hslToHex } from '../utils/optimizedColor';
import { SCHEME_OFFSETS } from '../constants/colorWheelConstants';
import { WHEEL_BASICS, SCHEMES, STYLE_RULES } from '../content/styleGuide';
import { ui } from '../components/palettes/theme';

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// Example palette for a scheme, built the same way the wheel builds it. The single-hue schemes
// vary lightness instead of hue.
const examplePalette = (base, scheme) => {
  const { h = 0, s = 70, l = 50 } = hexToHsl(base) || {};
  if (scheme === 'monochromatic') return [l - 20, l, l + 20].map((x) => hslToHex(h, s, clamp(x, 8, 92)));
  if (scheme === 'shades') return [1, 0.8, 0.62, 0.46, 0.3].map((k) => hslToHex(h, s, clamp(l * k, 6, 94)));
  if (scheme === 'tints') return [0, 0.25, 0.48, 0.68, 0.84].map((k) => hslToHex(h, s, clamp(l + (100 - l) * k, 6, 95)));
  return (SCHEME_OFFSETS[scheme] || [0]).map((offset) => hslToHex((h + offset + 360) % 360, s, l));
};

const PaletteBar = ({ colors, height = 40 }) => (
  <View style={[styles.bar, { height }]}>
    {colors.map((c, i) => <View key={`${i}-${c}`} style={{ flex: 1, backgroundColor: c }} />)}
  </View>
);

const SectionTitle = ({ children, hint }) => (
  <View style={styles.sectionHead}>
    <Text style={styles.sectionTitle}>{children}</Text>
    {!!hint && <Text style={styles.sectionHint}>{hint}</Text>}
  </View>
);

function StyleGuideScreen({ navigation }) {
  const [openScheme, setOpenScheme] = useState(SCHEMES[0].key);

  const schemes = useMemo(
    () => SCHEMES.map((s) => ({ ...s, colors: examplePalette(s.base, s.key) })),
    []
  );

  const tryOnWheel = useCallback((scheme) => {
    navigation?.navigate('ColorWheel', {
      applyPalette: { hex: scheme.base, scheme: scheme.key, nonce: Date.now() },
    });
  }, [navigation]);

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      {/* Hero */}
      <View style={styles.hero}>
        <Text style={styles.heroKicker}>STYLE GUIDE</Text>
        <Text style={styles.heroTitle}>Wear color with confidence</Text>
        <Text style={styles.heroText}>
          A short course in how colors work together, and how to turn any palette from the wheel into an outfit.
        </Text>
        <PaletteBar colors={['#D9483B', '#E0A030', '#2FA36B', '#1E6FD9', '#7A4FD0']} height={10} />
      </View>

      {/* Reading the wheel */}
      <SectionTitle hint="Three controls, three ideas.">Reading the wheel</SectionTitle>
      {WHEEL_BASICS.map((item) => (
        <View key={item.key} style={styles.card}>
          <View style={styles.cardHead}>
            <View style={styles.iconBubble}>
              <Ionicons name={item.icon} size={20} color={ui.text} />
            </View>
            <View style={styles.cardHeadText}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardWhere}>{item.where}</Text>
            </View>
          </View>
          <Text style={styles.body}>{item.body}</Text>
        </View>
      ))}

      {/* Palette types */}
      <SectionTitle hint="Tap one to see how to wear it.">Palette types</SectionTitle>
      {schemes.map((scheme) => {
        const open = openScheme === scheme.key;
        return (
          <View key={scheme.key} style={styles.card}>
            <Pressable
              onPress={() => setOpenScheme(open ? null : scheme.key)}
              accessibilityRole="button"
              accessibilityState={{ expanded: open }}
              accessibilityLabel={`${scheme.title}. ${scheme.tagline}`}
            >
              <View style={styles.schemeHead}>
                <View style={styles.cardHeadText}>
                  <Text style={styles.cardTitle}>{scheme.title}</Text>
                  <Text style={styles.cardWhere}>{scheme.tagline}</Text>
                </View>
                <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={20} color={ui.muted} />
              </View>
              <PaletteBar colors={scheme.colors} />
            </Pressable>

            {open && (
              <View style={styles.schemeBody}>
                <Text style={styles.label}>What it is</Text>
                <Text style={styles.body}>{scheme.what}</Text>
                <Text style={styles.label}>How to wear it</Text>
                <Text style={styles.body}>{scheme.wear}</Text>
                <View style={styles.tip}>
                  <Ionicons name="bulb-outline" size={16} color={ui.text} />
                  <Text style={styles.tipText}>{scheme.tip}</Text>
                </View>
                <Pressable
                  style={styles.tryButton}
                  onPress={() => tryOnWheel(scheme)}
                  accessibilityRole="button"
                  accessibilityLabel={`Try ${scheme.title} on the color wheel`}
                >
                  <Ionicons name="color-palette-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.tryText}>Try it on the wheel</Text>
                </Pressable>
              </View>
            )}
          </View>
        );
      })}

      {/* Styling rules */}
      <SectionTitle hint="Rules stylists actually use.">Styling tips</SectionTitle>
      {STYLE_RULES.map((rule) => (
        <View key={rule.key} style={styles.card}>
          <View style={styles.cardHead}>
            <View style={styles.iconBubble}>
              <Ionicons name={rule.icon} size={20} color={ui.text} />
            </View>
            <Text style={[styles.cardTitle, styles.cardHeadText]}>{rule.title}</Text>
          </View>
          <Text style={styles.body}>{rule.body}</Text>
          <PaletteBar colors={rule.palette} height={22} />
        </View>
      ))}

      {/* Bridge to the community */}
      <Pressable
        style={styles.communityCard}
        onPress={() => navigation?.navigate('Community')}
        accessibilityRole="button"
        accessibilityLabel="Open the community feed"
      >
        <View style={styles.cardHeadText}>
          <Text style={styles.communityTitle}>See it on real outfits</Text>
          <Text style={styles.communityText}>Browse palettes and photos other people shared, and save the ones you like.</Text>
        </View>
        <Ionicons name="arrow-forward" size={22} color="#FFFFFF" />
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: ui.bg },
  content: { padding: ui.gutter, paddingBottom: 40 },

  hero: { backgroundColor: ui.card, borderRadius: 22, padding: 20, marginTop: 4 },
  heroKicker: { fontSize: 12, fontWeight: '700', letterSpacing: 1.2, color: ui.muted },
  heroTitle: { marginTop: 6, fontSize: 26, lineHeight: 31, fontWeight: '800', color: ui.text },
  heroText: { marginTop: 8, marginBottom: 16, fontSize: 15, lineHeight: 22, color: ui.muted },

  sectionHead: { marginTop: 26, marginBottom: 10, paddingHorizontal: 4 },
  sectionTitle: { fontSize: 20, fontWeight: '800', color: ui.text },
  sectionHint: { marginTop: 2, fontSize: 13, color: ui.muted },

  card: { backgroundColor: ui.card, borderRadius: ui.radius, padding: 16, marginBottom: 10 },
  cardHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  cardHeadText: { flex: 1 },
  iconBubble: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: ui.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: ui.text },
  cardWhere: { marginTop: 2, fontSize: 13, color: ui.muted },
  body: { fontSize: 15, lineHeight: 22, color: ui.text, marginBottom: 12 },

  bar: { flexDirection: 'row', borderRadius: 10, overflow: 'hidden' },

  schemeHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  schemeBody: { marginTop: 16 },
  label: { fontSize: 12, fontWeight: '700', letterSpacing: 0.6, color: ui.muted, textTransform: 'uppercase', marginBottom: 4 },
  tip: { flexDirection: 'row', backgroundColor: ui.pill, borderRadius: 12, padding: 12, marginBottom: 14 },
  tipText: { flex: 1, marginLeft: 8, fontSize: 14, lineHeight: 20, color: ui.text },
  tryButton: {
    height: 46,
    borderRadius: 23,
    backgroundColor: ui.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tryText: { marginLeft: 8, color: '#FFFFFF', fontSize: 15, fontWeight: '700' },

  communityCard: {
    marginTop: 16,
    backgroundColor: ui.primary,
    borderRadius: 22,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  communityTitle: { fontSize: 18, fontWeight: '800', color: '#FFFFFF' },
  communityText: { marginTop: 4, fontSize: 14, lineHeight: 20, color: '#D1D5DB', paddingRight: 12 },
});

export default StyleGuideScreen;
