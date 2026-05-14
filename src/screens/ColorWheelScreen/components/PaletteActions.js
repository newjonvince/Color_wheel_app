// PaletteActions.js — Copy-all and Share palette buttons
import React, { useState, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, Share, StyleSheet, Animated } from 'react-native';
import PropTypes from 'prop-types';
import { getColorName } from '../../../utils/colorNames';

let _Clipboard = null;
let _clipboardAttempted = false;
const getClipboard = () => {
  if (_clipboardAttempted) return _Clipboard;
  _clipboardAttempted = true;
  try {
    _Clipboard = require('expo-clipboard');
  } catch (_) {
    _Clipboard = null;
  }
  return _Clipboard;
};

const TOAST_DURATION = 1800;

export const PaletteActions = React.memo(({ palette, selectedColor }) => {
  const [toastMsg, setToastMsg] = useState('');
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastTimer = useRef(null);

  const showToast = useCallback((msg) => {
    setToastMsg(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    Animated.sequence([
      Animated.timing(toastOpacity, { toValue: 1, duration: 150, useNativeDriver: true }),
      Animated.delay(TOAST_DURATION - 300),
      Animated.timing(toastOpacity, { toValue: 0, duration: 150, useNativeDriver: true }),
    ]).start();
    toastTimer.current = setTimeout(() => setToastMsg(''), TOAST_DURATION);
  }, [toastOpacity]);

  const handleCopyAll = useCallback(async () => {
    const colors = (palette?.length ? palette : [selectedColor]).filter(Boolean);
    const text = colors.map(h => h.toUpperCase()).join(', ');
    try {
      const Clipboard = getClipboard();
      if (Clipboard?.setStringAsync) {
        await Clipboard.setStringAsync(text);
      } else if (Clipboard?.setString) {
        Clipboard.setString(text);
      }
      showToast(`Copied ${colors.length} color${colors.length > 1 ? 's' : ''}`);
    } catch (err) {
      showToast('Copy failed');
    }
  }, [palette, selectedColor, showToast]);

  const handleShare = useCallback(async () => {
    const colors = (palette?.length ? palette : [selectedColor]).filter(Boolean);
    const lines = colors.map((hex, i) => {
      const name = getColorName(hex);
      return `${i + 1}. ${hex.toUpperCase()}${name ? `  —  ${name}` : ''}`;
    });
    const message = `My Color Palette\n\n${lines.join('\n')}\n\nCreated with Fashion Color Wheel`;
    try {
      await Share.share({ message, title: 'My Color Palette' });
    } catch (err) {
      if (err?.message !== 'The user did not share') {
        showToast('Share failed');
      }
    }
  }, [palette, selectedColor, showToast]);

  return (
    <View style={styles.container}>
      <TouchableOpacity style={[styles.btn, styles.copyBtn]} onPress={handleCopyAll} accessibilityLabel="Copy all hex codes" accessibilityRole="button">
        <Text style={styles.btnText}>Copy All</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.btn, styles.shareBtn]} onPress={handleShare} accessibilityLabel="Share palette" accessibilityRole="button">
        <Text style={[styles.btnText, styles.shareBtnText]}>Share Palette</Text>
      </TouchableOpacity>

      {toastMsg ? (
        <Animated.View style={[styles.toast, { opacity: toastOpacity }]}>
          <Text style={styles.toastText}>{toastMsg}</Text>
        </Animated.View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    marginTop: 12,
    marginHorizontal: 0,
    alignItems: 'center',
    position: 'relative',
  },
  btn: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
    marginRight: 8,
  },
  copyBtn: {
    borderColor: '#999',
    backgroundColor: '#fff',
  },
  shareBtn: {
    borderColor: '#0d47a1',
    backgroundColor: '#0d47a1',
  },
  btnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },
  shareBtnText: {
    color: '#fff',
  },
  toast: {
    position: 'absolute',
    right: 0,
    bottom: -28,
    backgroundColor: 'rgba(0,0,0,0.72)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 6,
  },
  toastText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
});

PaletteActions.propTypes = {
  palette: PropTypes.arrayOf(PropTypes.string),
  selectedColor: PropTypes.string,
};

PaletteActions.displayName = 'PaletteActions';
