import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { router, useFocusEffect, useIsFocused } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PrimaryButton, QuestionInput } from '../components/ui';
import { setPending } from '../lib/analyze';
import { pickScreenshot } from '../lib/pickImage';
import { prepareImage } from '../lib/prepareImage';
import { isOnboarded } from '../lib/setup';
import { useProtectionSummary } from '../lib/useProtection';
import { colors, radius, type } from '../theme';

/**
 * Wary opens straight to the scanner: point the camera at anything confusing —
 * a pop-up on a computer, a letter, a sign, a text on someone else's phone, a QR code —
 * tap once, and get "what is this, and should I trust it?".
 */
export default function Scanner() {
  const [perm, requestPerm] = useCameraPermissions();
  const focused = useIsFocused();
  const camera = useRef<CameraView>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [torch, setTorch] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const protection = useProtectionSummary();

  useFocusEffect(
    useCallback(() => {
      // First launch: set up the background protections before anything else.
      isOnboarded().then((ok) => !ok && router.push('/setup'));
      setBusy(false);
      setQr(null);
    }, [])
  );

  const capture = async () => {
    if (!camera.current || !ready || busy) return;
    setBusy(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const photo = await camera.current.takePictureAsync({ quality: 0.8 });
      if (!photo?.uri) throw new Error('no photo');
      setPending(await prepareImage(photo.uri));
      router.push('/result');
    } catch {
      setBusy(false);
    }
  };

  const fromPhotos = async () => {
    const req = await pickScreenshot();
    if (!req) return;
    setPending(req);
    router.push('/result');
  };

  const checkQr = () => {
    if (!qr) return;
    const isUrl = /^https?:\/\//i.test(qr) || /^[\w-]+(\.[\w-]+)+(\/|$)/.test(qr);
    setPending(isUrl ? { kind: 'url', url: qr, source: 'qr' } : { kind: 'text', text: `QR code contents: ${qr}` });
    router.push('/result');
  };

  const statusChip = protection.loaded ? (
    <Pressable
      onPress={() => router.push('/protection')}
      accessibilityRole="button"
      accessibilityLabel={protection.allOn ? 'Protected. Open protection settings' : 'Finish setting up protection'}
      style={[s.chip, { borderColor: protection.allOn ? colors.safe : colors.caution }]}
    >
      <Text style={[s.chipText, { color: protection.allOn ? colors.safe : colors.caution }]}>
        {protection.allOn ? '✓ Protected' : `! ${protection.on} of ${protection.total} on`}
      </Text>
    </Pressable>
  ) : null;

  // No camera permission yet (or denied): explain, and offer the non-camera ways in.
  if (!perm?.granted) {
    return (
      <SafeAreaView style={s.fill}>
        <View style={s.topBar}>
          <Text style={s.brand}>WARY</Text>
          {statusChip}
        </View>
        <View style={s.permWrap}>
          <Text style={s.permTitle}>Point your camera at anything confusing</Text>
          <Text style={s.permBody}>
            A pop-up on your computer, a letter, a text, a QR code — Wary tells you what it is and whether to trust it.
            The camera is only used while this screen is open.
          </Text>
          {perm?.canAskAgain !== false ? (
            <PrimaryButton label="TURN ON CAMERA" onPress={requestPerm} />
          ) : (
            <Text style={s.permBody}>Camera access is off. You can turn it on in Settings → Apps → Wary.</Text>
          )}
          <View style={s.altRow}>
            <AltButton label="Choose a photo or video" onPress={fromPhotos} />
            <AltButton label="Paste a link or text" onPress={() => router.push('/link')} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={s.fill}>
      <CameraView
        ref={camera}
        style={StyleSheet.absoluteFill}
        facing="back"
        active={focused}
        enableTorch={torch}
        animateShutter={false}
        onCameraReady={() => setReady(true)}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={({ data }) => {
          if (data && data !== qr) {
            Haptics.selectionAsync();
            setQr(data);
          }
        }}
      />

      <SafeAreaView style={s.overlay} edges={['top', 'bottom']}>
        <View style={s.topBar}>
          <Text style={s.brand}>WARY</Text>
          {statusChip}
        </View>

        <View style={s.middle}>
          {busy ? (
            <View style={s.busy}>
              <ActivityIndicator color={colors.mint} size="large" />
              <Text style={s.busyText}>Taking a look…</Text>
            </View>
          ) : qr ? (
            <View style={s.qrCard}>
              <Text style={s.qrLabel}>QR CODE FOUND</Text>
              <Text style={s.qrData} numberOfLines={2}>
                {qr}
              </Text>
              <PrimaryButton label="CHECK BEFORE OPENING" onPress={checkQr} />
              <Pressable onPress={() => setQr(null)} style={{ padding: 8, alignItems: 'center' }}>
                <Text style={s.dismiss}>Dismiss</Text>
              </Pressable>
            </View>
          ) : (
            <View style={s.frame} />
          )}
        </View>

        <View style={{ paddingHorizontal: 20, marginBottom: 10 }}>
          <QuestionInput dark />
        </View>
        <Text style={s.hint}>Point at a pop-up, letter, message or QR code — or tap Photos for a screenshot or video</Text>

        <View style={s.controls}>
          <SideButton label="Photos" icon="🖼" onPress={fromPhotos} />
          <Pressable
            onPress={capture}
            disabled={!ready || busy}
            accessibilityRole="button"
            accessibilityLabel="Check what the camera sees"
            style={({ pressed }) => [s.shutter, pressed && { transform: [{ scale: 0.94 }] }, (!ready || busy) && { opacity: 0.5 }]}
          >
            <View style={s.shutterInner}>
              <Text style={s.shutterText}>CHECK</Text>
            </View>
          </Pressable>
          <SideButton label="Paste" icon="🔗" onPress={() => router.push('/link')} />
        </View>
        <Pressable onPress={() => setTorch((t) => !t)} style={s.torch} accessibilityLabel="Toggle flashlight">
          <Text style={s.torchText}>{torch ? 'Light on' : 'Light off'}</Text>
        </Pressable>
      </SafeAreaView>
    </View>
  );
}

function SideButton({ label, icon, onPress }: { label: string; icon: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={s.side}>
      <Text style={s.sideIcon}>{icon}</Text>
      <Text style={s.sideLabel}>{label}</Text>
    </Pressable>
  );
}

function AltButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={s.alt}>
      <Text style={s.altText}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  fill: { flex: 1, backgroundColor: '#000' },
  overlay: { flex: 1, justifyContent: 'space-between' },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 8 },
  brand: { color: colors.mint, ...type.label, fontSize: 16, letterSpacing: 4 },
  chip: { borderWidth: 2, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#000b' },
  chipText: { fontSize: 15, fontWeight: '800' },
  middle: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  frame: { width: '86%', aspectRatio: 0.8, borderWidth: 3, borderColor: colors.mint, borderRadius: 28, opacity: 0.85 },
  busy: { backgroundColor: '#000c', padding: 24, borderRadius: radius, alignItems: 'center', gap: 12 },
  busyText: { color: colors.text, ...type.body },
  qrCard: { backgroundColor: colors.surface, borderRadius: radius, padding: 18, gap: 10, width: '100%' },
  qrLabel: { color: colors.mintDim, ...type.label },
  qrData: { color: colors.text, fontSize: 16, fontFamily: 'Menlo' },
  dismiss: { color: colors.textMuted, fontSize: 16 },
  hint: { color: '#fff', textAlign: 'center', fontSize: 16, paddingHorizontal: 28, marginBottom: 14, textShadowColor: '#000', textShadowRadius: 6 },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-evenly', paddingBottom: 8 },
  shutter: { width: 96, height: 96, borderRadius: 48, borderWidth: 5, borderColor: '#fff', padding: 5 },
  shutterInner: { flex: 1, borderRadius: 40, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' },
  shutterText: { color: colors.onMint, fontWeight: '900', fontSize: 15, letterSpacing: 1 },
  side: { width: 76, alignItems: 'center', gap: 4, paddingVertical: 8, borderRadius: radius, backgroundColor: '#000a' },
  sideIcon: { fontSize: 24 },
  sideLabel: { color: '#fff', fontSize: 14, fontWeight: '600' },
  torch: { alignSelf: 'center', paddingVertical: 6, paddingHorizontal: 14 },
  torchText: { color: '#ddd', fontSize: 14 },
  permWrap: { flex: 1, justifyContent: 'center', padding: 24, gap: 18, backgroundColor: colors.bg },
  permTitle: { color: colors.text, ...type.hero },
  permBody: { color: colors.textMuted, ...type.body },
  altRow: { gap: 10 },
  alt: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: radius, paddingVertical: 16, alignItems: 'center' },
  altText: { color: colors.text, fontSize: 17, fontWeight: '600' },
});
