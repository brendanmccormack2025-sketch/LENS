import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { CallStatus } from '../../modules/wary-native';
import { Card, SectionLabel } from '../components/ui';
import { getCallStatus, nativeAvailable, openCallSettings, syncCallList } from '../lib/callProtection';
import { getManual, setManual, type ManualProtection } from '../lib/setup';
import { colors, radius, type } from '../theme';

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <View style={s.step}>
      <Text style={s.num}>{n}</Text>
      <Text style={[s.body, { flex: 1 }]}>{children}</Text>
    </View>
  );
}

const B = ({ children }: { children: React.ReactNode }) => <Text style={s.bold}>{children}</Text>;

function DoneButton({ done, onPress }: { done: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [s.done, done && s.doneOn, pressed && { opacity: 0.85 }]}
    >
      <Text style={[s.doneText, done && { color: colors.onMint }]}>{done ? '✓ Turned on' : 'I’ve turned it on'}</Text>
    </Pressable>
  );
}

export default function Watch() {
  const [calls, setCalls] = useState<CallStatus>('unknown');
  const [manual, setManualState] = useState({ texts: false, safari: false });

  useFocusEffect(
    useCallback(() => {
      getCallStatus().then(setCalls);
      getManual().then(setManualState);
    }, [])
  );

  const toggle = async (p: ManualProtection) => {
    const next = !manual[p];
    await setManual(p, next);
    setManualState({ ...manual, [p]: next });
  };

  return (
    <ScrollView style={s.fill} contentContainerStyle={s.wrap}>
      <Text style={s.hero}>Protection that works while Wary is closed</Text>
      <Text style={s.lead}>
        Turn these on once. iPhone requires you to switch them on yourself in Settings — Wary can’t do it for you.
      </Text>

      <SectionLabel>1 · SCAM CALLS</SectionLabel>
      <Card style={{ gap: 14 }}>
        <Text style={s.body}>
          When a number other people have reported calls you, your iPhone shows <B>“Wary: Reported scam”</B> on the call
          screen — before you answer.
        </Text>
        <Step n={1}>
          Open <B>Settings</B> → <B>Apps</B> → <B>Phone</B>
        </Step>
        <Step n={2}>
          Tap <B>Call Blocking & Identification</B> and turn on <B>Wary</B>
        </Step>
        {calls === 'enabled' ? (
          <Text style={[s.status, { color: colors.safe }]}>✓ Wary is labeling calls</Text>
        ) : nativeAvailable() ? (
          <Pressable
            onPress={async () => {
              await openCallSettings();
            }}
            style={s.cta}
            accessibilityRole="button"
          >
            <Text style={s.ctaText}>Open call settings</Text>
          </Pressable>
        ) : null}
        <Text style={s.small}>
          Numbers come from complaints people file with the FTC, updated every weekday. A number needs several reports
          before Wary labels it. Your contacts always show their normal names.
        </Text>
        {calls === 'enabled' ? (
          <Pressable onPress={() => syncCallList(true)}>
            <Text style={s.link}>Refresh the list now</Text>
          </Pressable>
        ) : null}
      </Card>

      <SectionLabel>2 · SCAM TEXTS</SectionLabel>
      <Card style={{ gap: 14 }}>
        <Text style={s.body}>
          Texts from numbers you don’t know are checked as they arrive. Likely scams go straight to your <B>Junk</B>{' '}
          folder.
        </Text>
        <Step n={1}>
          Open <B>Settings</B> → <B>Apps</B> → <B>Messages</B>
        </Step>
        <Step n={2}>
          Under <B>Unknown Senders</B>, turn on <B>Screen Unknown Senders</B>
        </Step>
        <Step n={3}>
          Tap <B>Text Message Filter</B> and choose <B>Wary</B>
        </Step>
        <Text style={s.small}>
          On older iPhones: Settings → Messages → Unknown & Spam → choose Wary under SMS Filtering.
        </Text>
        <DoneButton done={manual.texts} onPress={() => toggle('texts')} />
        <Text style={s.small}>
          iPhone only lets Wary see texts from unknown numbers — never your contacts, and never iMessages. Everything is
          checked on your phone; nothing is sent anywhere.
        </Text>
      </Card>

      <SectionLabel>3 · FAKE WEBSITES</SectionLabel>
      <Card style={{ gap: 14 }}>
        <Text style={s.body}>
          If you open a fake website in Safari — like a pretend bank or delivery login — Wary puts a{' '}
          <B>red warning</B> at the top of the page.
        </Text>
        <Step n={1}>
          Open <B>Settings</B> → <B>Apps</B> → <B>Safari</B> → <B>Extensions</B>
        </Step>
        <Step n={2}>
          Tap <B>Wary</B>, turn it on, and set <B>All Websites</B> to <B>Allow</B>
        </Step>
        <DoneButton done={manual.safari} onPress={() => toggle('safari')} />
        <Text style={s.small}>
          Works in Safari only. For links in other apps, use Share → Wary.
        </Text>
      </Card>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.bg },
  wrap: { padding: 20, gap: 10, paddingBottom: 48 },
  hero: { color: colors.text, ...type.title, fontSize: 26 },
  lead: { color: colors.textMuted, ...type.body, marginBottom: 6 },
  body: { color: colors.text, ...type.body },
  bold: { fontWeight: '700', color: colors.text },
  small: { color: colors.textMuted, ...type.small },
  status: { fontSize: 17, fontWeight: '700' },
  link: { color: colors.mint, fontSize: 16, fontWeight: '600' },
  step: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  num: {
    color: colors.onMint,
    backgroundColor: colors.mint,
    width: 28,
    height: 28,
    borderRadius: 14,
    textAlign: 'center',
    lineHeight: 28,
    fontWeight: '800',
    overflow: 'hidden',
  },
  cta: { backgroundColor: colors.mint, borderRadius: radius, paddingVertical: 14, alignItems: 'center' },
  ctaText: { color: colors.onMint, fontSize: 17, fontWeight: '800' },
  done: {
    borderWidth: 2,
    borderColor: colors.mint,
    borderRadius: radius,
    paddingVertical: 12,
    alignItems: 'center',
  },
  doneOn: { backgroundColor: colors.mint },
  doneText: { color: colors.mint, fontSize: 17, fontWeight: '700' },
});
