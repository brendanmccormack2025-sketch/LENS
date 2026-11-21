import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { AppState, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { CallStatus } from '../../modules/wary-native';
import { PrimaryButton } from '../components/ui';
import { setPending } from '../lib/analyze';
import {
  getCallStatus,
  isPasscodeSet,
  lastSync,
  nativeAvailable,
  safariLastSeen,
  syncCallList,
  type CallSyncInfo,
} from '../lib/callProtection';
import { pickScreenshot } from '../lib/pickImage';
import { getManual, isOnboarded } from '../lib/setup';
import { colors, radius, type } from '../theme';

type Row = { key: string; title: string; on: boolean | null; detail: string; action?: string; onPress?: () => void };

export default function Home() {
  const [calls, setCalls] = useState<CallStatus>('unknown');
  const [sync, setSync] = useState<CallSyncInfo | null>(null);
  const [manual, setManualState] = useState({ texts: false, safari: false });
  const [passcode, setPasscode] = useState<boolean | null>(null);

  const refresh = useCallback(async () => {
    const [status, m, s] = await Promise.all([getCallStatus(), getManual(), lastSync()]);
    setCalls(status);
    setManualState({ texts: m.texts, safari: m.safari || safariLastSeen() != null });
    setSync(s);
    setPasscode(isPasscodeSet());
    // Keep the caller list fresh whenever Wary is opened.
    syncCallList()
      .then((info) => info && setSync(info))
      .catch(() => {});
  }, []);

  useFocusEffect(
    useCallback(() => {
      // First launch: walk through setup before anything else.
      isOnboarded().then((ok) => !ok && router.push('/setup'));
      refresh();
      // Re-check when the user comes back from Settings.
      const sub = AppState.addEventListener('change', (st) => st === 'active' && refresh());
      return () => sub.remove();
    }, [refresh])
  );

  const callsDetail =
    calls === 'enabled'
      ? sync?.entries
        ? `Labeling ${sync.entries.toLocaleString()} reported scam numbers`
        : 'On — getting the reported-number list'
      : nativeAvailable()
        ? 'Warn me on the call screen about reported scam numbers'
        : 'Available in the App Store version of Wary';

  const rows: Row[] = [
    {
      key: 'calls',
      title: 'Scam calls',
      on: calls === 'enabled',
      detail: callsDetail,
      action: calls === 'enabled' ? undefined : 'Turn on',
      onPress: calls === 'enabled' ? undefined : () => router.push('/setup'),
    },
    {
      key: 'texts',
      title: 'Scam texts',
      on: manual.texts,
      detail: manual.texts ? 'Scam texts from unknown numbers go to Junk' : 'Send scam texts straight to Junk',
      action: manual.texts ? undefined : 'Set up',
      onPress: () => router.push('/setup'),
    },
    {
      key: 'safari',
      title: 'Fake websites',
      on: manual.safari,
      detail: manual.safari ? 'Red warning on fake sites in Safari' : 'Warn me on fake websites in Safari',
      action: manual.safari ? undefined : 'Set up',
      onPress: () => router.push('/setup'),
    },
    {
      key: 'passcode',
      title: 'Phone lock',
      on: passcode,
      detail:
        passcode === false
          ? 'No passcode — anyone who picks up your phone can open it'
          : passcode
            ? 'Passcode is on'
            : 'Make sure your iPhone has a passcode',
      action: passcode === false ? 'Fix' : undefined,
      onPress: passcode === false ? () => Linking.openSettings() : undefined,
    },
  ];

  const onCount = rows.filter((r) => r.on).length;
  const allOn = onCount === rows.length;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={s.wrap}>
        <Text style={s.brand}>WARY</Text>

        <Pressable
          onPress={allOn ? undefined : () => router.push('/setup')}
          disabled={allOn}
          style={[s.status, { borderColor: allOn ? colors.safe : colors.caution }]}
        >
          <Text style={[s.statusIcon, { color: allOn ? colors.safe : colors.caution }]}>{allOn ? '✓' : '!'}</Text>
          <Text style={s.hero}>{allOn ? 'You’re protected' : 'Finish setting up'}</Text>
          <Text style={s.sub}>
            {allOn
              ? 'Wary is watching your calls, texts and Safari — even while the app is closed.'
              : `${onCount} of ${rows.length} protections on. Tap to finish — about a minute.`}
          </Text>
        </Pressable>

        <View style={{ gap: 10 }}>
          {rows.map((r) => (
            <Pressable
              key={r.key}
              onPress={r.onPress}
              disabled={!r.onPress}
              accessibilityRole={r.onPress ? 'button' : undefined}
              style={({ pressed }) => [s.row, pressed && r.onPress ? { backgroundColor: colors.surfaceRaised } : null]}
            >
              <View
                style={[s.dot, { backgroundColor: r.on ? colors.safe : r.on === false ? colors.caution : colors.border }]}
              >
                <Text style={s.dotText}>{r.on ? '✓' : ''}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.rowTitle}>{r.title}</Text>
                <Text style={s.rowDetail}>{r.detail}</Text>
              </View>
              {r.action ? <Text style={s.action}>{r.action}</Text> : null}
            </Pressable>
          ))}
        </View>

        <View style={s.tip}>
          <Text style={s.tipTitle}>Unknown caller, nobody there?</Text>
          <Text style={s.tipBody}>
            That’s usually a robot checking your number is real. Don’t speak — just hang up. Wary labels numbers other
            people have reported, so you can skip them.
          </Text>
        </View>

        <Text style={s.section}>CHECK SOMETHING YOURSELF</Text>
        <PrimaryButton
          label="CHECK A SCREENSHOT"
          sub="A text, email, pop-up or post you’re unsure about"
          onPress={async () => {
            const req = await pickScreenshot();
            if (!req) return;
            setPending(req);
            router.push('/result');
          }}
        />
        <View style={s.smallRow}>
          <SmallButton label="Link or message" onPress={() => router.push('/link')} />
          <SmallButton label="QR code" onPress={() => router.push('/qr')} />
        </View>

        <Text style={s.foot}>
          Wary gives its best judgement and shows you why. It can be wrong — when money or passwords are involved, contact
          the company using a number or app you already trust.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function SmallButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [s.small, pressed && { opacity: 0.8 }]}>
      <Text style={s.smallText}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  wrap: { padding: 20, gap: 16, paddingBottom: 48 },
  brand: { color: colors.mint, ...type.label, fontSize: 15, letterSpacing: 4, marginTop: 8 },
  status: { borderWidth: 2, borderRadius: radius, padding: 20, backgroundColor: colors.surface, gap: 6 },
  statusIcon: { fontSize: 28, fontWeight: '900' },
  hero: { color: colors.text, ...type.hero },
  sub: { color: colors.textMuted, ...type.body },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: radius,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dot: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  dotText: { color: colors.onMint, fontWeight: '900', fontSize: 16 },
  rowTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
  rowDetail: { color: colors.textMuted, ...type.small, marginTop: 2 },
  action: { color: colors.mint, fontSize: 16, fontWeight: '700' },
  link: { color: colors.mint, fontSize: 16, fontWeight: '600' },
  tip: { backgroundColor: colors.surfaceRaised, borderRadius: radius, padding: 16, gap: 6 },
  tipTitle: { color: colors.text, fontSize: 17, fontWeight: '700' },
  tipBody: { color: colors.textMuted, ...type.small },
  section: { color: colors.mintDim, ...type.label, marginTop: 8 },
  smallRow: { flexDirection: 'row', gap: 10 },
  small: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: radius,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  smallText: { color: colors.text, fontSize: 16, fontWeight: '600' },
  foot: { color: colors.textMuted, ...type.small, marginTop: 8 },
});
