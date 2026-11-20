import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PrimaryButton } from '../components/ui';
import { setPending } from '../lib/analyze';
import { colors, radius, type } from '../theme';

/**
 * Important: we never open the QR destination. We show it, then send it to the
 * server for checks. The user decides whether to visit after seeing the result.
 */
export default function QrScreen() {
  const [perm, requestPerm] = useCameraPermissions();
  const [code, setCode] = useState<string | null>(null);
  const locked = useRef(false);

  if (!perm) return <View style={s.fill} />;

  if (!perm.granted) {
    return (
      <SafeAreaView style={[s.fill, s.center]}>
        <Text style={s.title}>Camera access needed</Text>
        <Text style={s.body}>Wary uses the camera only while this screen is open, to read the QR code.</Text>
        <PrimaryButton label="ALLOW CAMERA" onPress={requestPerm} />
        <Pressable onPress={() => router.back()} style={{ padding: 16 }}>
          <Text style={s.link}>Not now</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const check = () => {
    if (!code) return;
    const isUrl = /^https?:\/\//i.test(code) || /^[\w-]+(\.[\w-]+)+(\/|$)/.test(code);
    setPending(isUrl ? { kind: 'url', url: code, source: 'qr' } : { kind: 'text', text: `QR code contents: ${code}` });
    router.replace('/result');
  };

  return (
    <View style={s.fill}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={({ data }) => {
          if (locked.current) return;
          locked.current = true;
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setCode(data);
        }}
      />
      <SafeAreaView style={s.overlay} edges={['top', 'bottom']}>
        <Pressable onPress={() => router.back()} style={s.close} accessibilityLabel="Close">
          <Text style={s.closeText}>✕</Text>
        </Pressable>
        <View style={s.frame} />
        {code ? (
          <View style={s.sheet}>
            <Text style={s.sheetLabel}>THIS CODE POINTS TO</Text>
            <Text style={s.code} numberOfLines={4} selectable>
              {code}
            </Text>
            <PrimaryButton label="CHECK BEFORE OPENING" onPress={check} />
            <Pressable
              onPress={() => {
                setCode(null);
                locked.current = false;
              }}
              style={{ padding: 12, alignItems: 'center' }}
            >
              <Text style={s.link}>Scan a different code</Text>
            </Pressable>
          </View>
        ) : (
          <Text style={s.hint}>Point your camera at a QR code</Text>
        )}
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.bg },
  center: { justifyContent: 'center', padding: 24, gap: 16 },
  title: { color: colors.text, ...type.title },
  body: { color: colors.textMuted, ...type.body },
  link: { color: colors.mint, fontSize: 17, fontWeight: '600' },
  overlay: { flex: 1, justifyContent: 'space-between', padding: 20 },
  close: { alignSelf: 'flex-end', width: 48, height: 48, borderRadius: 24, backgroundColor: '#000a', alignItems: 'center', justifyContent: 'center' },
  closeText: { color: '#fff', fontSize: 22 },
  frame: { alignSelf: 'center', width: 240, height: 240, borderWidth: 3, borderColor: colors.mint, borderRadius: 24 },
  hint: { color: '#fff', textAlign: 'center', fontSize: 18, backgroundColor: '#000a', padding: 12, borderRadius: radius, overflow: 'hidden' },
  sheet: { backgroundColor: colors.surface, borderRadius: radius, padding: 18, gap: 12 },
  sheetLabel: { color: colors.mintDim, ...type.label },
  code: { color: colors.text, fontSize: 17, fontFamily: 'Menlo' },
});
