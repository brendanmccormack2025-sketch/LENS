import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card, SectionLabel } from '../components/ui';
import { colors, type } from '../theme';

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <View style={s.step}>
      <Text style={s.num}>{n}</Text>
      <Text style={[s.body, { flex: 1 }]}>{children}</Text>
    </View>
  );
}

const B = ({ children }: { children: React.ReactNode }) => <Text style={s.bold}>{children}</Text>;

export default function Watch() {
  return (
    <ScrollView style={s.fill} contentContainerStyle={s.wrap}>
      <Text style={s.hero}>Protection that works while Wary is closed</Text>
      <Text style={s.lead}>
        Turn these on once. After that, Wary checks things for you automatically — right on your iPhone, without
        sending your messages or browsing anywhere.
      </Text>

      <SectionLabel>1 · SCAM TEXT FILTER</SectionLabel>
      <Card style={{ gap: 14 }}>
        <Text style={s.body}>
          Texts from numbers you don’t know are checked as they arrive. Likely scams go straight to your{' '}
          <B>Junk</B> folder, so you never have to see them.
        </Text>
        <Step n={1}>
          Open the <B>Settings</B> app
        </Step>
        <Step n={2}>
          Tap <B>Apps</B>, then <B>Messages</B> (on older iPhones, just <B>Messages</B>)
        </Step>
        <Step n={3}>
          Tap <B>Unknown & Spam</B>, then under SMS Filtering choose <B>WARY</B>
        </Step>
        <Text style={s.small}>
          iPhone only lets Wary see texts from unknown numbers — never your contacts, and never iMessages. Only one
          filter app can be on at a time.
        </Text>
      </Card>

      <SectionLabel>2 · SAFARI WARNINGS</SectionLabel>
      <Card style={{ gap: 14 }}>
        <Text style={s.body}>
          If you open a fake website in Safari — like a pretend bank or delivery login — Wary puts a{' '}
          <B>red warning</B> at the top of the page.
        </Text>
        <Step n={1}>
          Open <B>Settings</B> → <B>Apps</B> → <B>Safari</B> → <B>Extensions</B>
        </Step>
        <Step n={2}>
          Tap <B>WARY</B> and turn it <B>on</B>
        </Step>
        <Step n={3}>
          Set <B>All Websites</B> to <B>Allow</B> so Wary can warn you on any site
        </Step>
        <Text style={s.small}>
          Works in Safari only. Links opened inside other apps (like Instagram) or in Chrome aren’t covered — for those,
          use Share → Wary.
        </Text>
      </Card>

      <SectionLabel>EVERYTHING ELSE</SectionLabel>
      <Card>
        <Text style={s.body}>
          For anything else — an email, a WhatsApp message, a post — tap <B>Share</B> and choose <B>WARY</B>. You’ll
          get an answer without leaving the app you’re in.
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
});
