// components/WebCaptureModal.js
// "Find a picture on the web": an in-app Google Images browser with a Capture button. Capture
// snapshots what is on screen, then the crop step trims it down to the picture itself.
//
// Props:
//  - visible: boolean
//  - onClose(): void
//  - onCaptured(uri: string): void   cropped local JPEG; the caller closes the modal
//
// Browsing is limited to Google with SafeSearch on. Captured pictures belong to other people, so
// palettes made from them are saved private-only (enforced by the backend).

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { View, Text, Pressable, Modal, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { snapshotToFile } from '../utils/viewSnapshot';
import ImageCropper from './ImageCropper';
import { ui } from './palettes/theme';

// Native module: only present in app builds that include it
let WebView = null;
try {
  WebView = require('react-native-webview').WebView;
} catch (error) {
  console.warn('WebCaptureModal: react-native-webview not available', error?.message);
}

const START_URL = 'https://www.google.com/imghp?hl=en&safe=active';
const HOST_RE = /^https?:\/\/([^/?#:]+)/i;
const ALLOWED_HOST = /(^|\.)(google\.[a-z]{2,3}(\.[a-z]{2})?|gstatic\.com|googleusercontent\.com)$/i;
const SEARCH_RE = /^https?:\/\/[^/]+\/search\?/i;

const NavButton = ({ icon, label, onPress, disabled }) => (
  <Pressable
    style={styles.navButton}
    onPress={onPress}
    disabled={disabled}
    hitSlop={8}
    accessibilityRole="button"
    accessibilityLabel={label}
    accessibilityState={{ disabled: !!disabled }}
  >
    <Ionicons name={icon} size={24} color={disabled ? ui.line : ui.text} />
  </Pressable>
);

function Browser({ onShot, onClose }) {
  const insets = useSafeAreaInsets();
  const webRef = useRef(null);
  const shotRef = useRef(null);
  const noticeTimer = useRef(null);
  const lastRewrite = useRef(null);
  const [uri, setUri] = useState(START_URL);
  const [nav, setNav] = useState({ canGoBack: false, canGoForward: false });
  const [loading, setLoading] = useState(true);
  const [capturing, setCapturing] = useState(false);
  const [notice, setNotice] = useState(null);

  useEffect(() => () => clearTimeout(noticeTimer.current), []);

  const flash = useCallback((text) => {
    setNotice(text);
    clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 3200);
  }, []);

  // Keep the main page on Google, and keep SafeSearch on for every search
  const gate = useCallback((request) => {
    const url = String(request?.url || '');
    if (request?.isTopFrame === false) return true;
    if (/^(about|data|blob):/i.test(url)) return true;
    const host = HOST_RE.exec(url)?.[1];
    if (!host || !ALLOWED_HOST.test(host)) {
      flash('Other sites are turned off here. Open the picture in the results, then tap Capture.');
      return false;
    }
    if (SEARCH_RE.test(url) && !/[?&]safe=active(&|#|$)/i.test(url)) {
      const [main, hash] = url.split('#');
      // Rewrite each search once: if Google sends us back to the same URL, let it through
      // rather than bouncing forever
      if (lastRewrite.current !== main) {
        lastRewrite.current = main;
        setUri(`${main}&safe=active${hash ? `#${hash}` : ''}`);
        return false;
      }
    }
    return true;
  }, [flash]);

  const capture = useCallback(async () => {
    if (capturing) return;
    setCapturing(true);
    try {
      onShot(await snapshotToFile(shotRef, 'web-capture'));
    } catch (error) {
      console.warn('WebCaptureModal: capture failed', error?.message);
      Alert.alert('Could not capture', 'Please try again.');
    } finally {
      setCapturing(false);
    }
  }, [capturing, onShot]);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
          <Ionicons name="close" size={26} color={ui.text} />
        </Pressable>
        <View style={styles.topText}>
          <Text style={styles.title}>Find a picture</Text>
          <Text style={styles.subtitle}>Search, open a picture, then tap Capture</Text>
        </View>
        <View style={styles.topSpacer}>
          {loading && <ActivityIndicator color={ui.muted} />}
        </View>
      </View>

      {/* collapsable={false} keeps this a real native view so it can be snapshotted */}
      <View ref={shotRef} collapsable={false} style={styles.web}>
        {WebView ? (
          <WebView
            ref={webRef}
            source={{ uri }}
            style={styles.webView}
            onShouldStartLoadWithRequest={gate}
            onNavigationStateChange={(state) => setNav({ canGoBack: !!state.canGoBack, canGoForward: !!state.canGoForward })}
            onLoadStart={() => setLoading(true)}
            onLoadEnd={() => setLoading(false)}
            onError={() => { setLoading(false); flash('The page could not load. Check your connection.'); }}
            allowsBackForwardNavigationGestures
            allowsLinkPreview={false}
            allowsInlineMediaPlayback
            setSupportMultipleWindows={false}
            decelerationRate="normal"
          />
        ) : (
          <View style={styles.unavailable}>
            <Text style={styles.unavailableTitle}>Update needed</Text>
            <Text style={styles.unavailableText}>Web search needs the latest version of the app.</Text>
          </View>
        )}
      </View>

      {!!notice && (
        <View style={styles.notice} pointerEvents="none">
          <Text style={styles.noticeText}>{notice}</Text>
        </View>
      )}

      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        <NavButton icon="chevron-back" label="Back" disabled={!nav.canGoBack} onPress={() => webRef.current?.goBack()} />
        <NavButton icon="chevron-forward" label="Forward" disabled={!nav.canGoForward} onPress={() => webRef.current?.goForward()} />
        <Pressable
          style={[styles.capture, (!WebView || capturing) && styles.disabled]}
          onPress={capture}
          disabled={!WebView || capturing}
          accessibilityRole="button"
          accessibilityLabel="Capture what is on screen"
        >
          {capturing
            ? <ActivityIndicator color="#FFFFFF" />
            : (
              <>
                <Ionicons name="scan-outline" size={20} color="#FFFFFF" />
                <Text style={styles.captureText}>Capture</Text>
              </>
            )}
        </Pressable>
        <NavButton icon="refresh" label="Reload" onPress={() => webRef.current?.reload()} />
        <NavButton icon="search" label="New search" onPress={() => setUri(`${START_URL}&t=${Date.now()}`)} />
      </View>
    </View>
  );
}

export function WebCaptureModal({ visible, onClose, onCaptured }) {
  const [shot, setShot] = useState(null); // snapshot waiting to be cropped

  useEffect(() => {
    if (!visible) setShot(null);
  }, [visible]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <GestureHandlerRootView style={styles.flex}>
        {visible && (
          <>
            {/* The browser stays mounted under the crop step so Back returns to the same page */}
            <Browser onShot={setShot} onClose={onClose} />
            {shot && (
              <View style={StyleSheet.absoluteFill}>
                <ImageCropper image={shot} onBack={() => setShot(null)} onDone={onCaptured} />
              </View>
            )}
          </>
        )}
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  root: { flex: 1, backgroundColor: ui.card },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: ui.line,
  },
  topText: { flex: 1, alignItems: 'center' },
  title: { fontSize: 16, fontWeight: '700', color: ui.text },
  subtitle: { marginTop: 1, fontSize: 12, color: ui.muted },
  topSpacer: { width: 26, alignItems: 'center' },

  web: { flex: 1, backgroundColor: '#FFFFFF' },
  webView: { flex: 1, backgroundColor: '#FFFFFF' },
  unavailable: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  unavailableTitle: { fontSize: 18, fontWeight: '700', color: ui.text },
  unavailableText: { marginTop: 8, fontSize: 14, color: ui.muted, textAlign: 'center' },

  notice: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 110,
    backgroundColor: 'rgba(31,35,40,0.94)',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  noticeText: { color: '#FFFFFF', fontSize: 13, lineHeight: 18, textAlign: 'center' },

  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: ui.line,
    backgroundColor: ui.card,
  },
  navButton: { width: 44, height: 46, alignItems: 'center', justifyContent: 'center' },
  capture: {
    flex: 1,
    height: 46,
    marginHorizontal: 6,
    borderRadius: 23,
    backgroundColor: ui.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureText: { marginLeft: 8, color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  disabled: { opacity: 0.5 },
});

export default WebCaptureModal;
