import { StyleSheet, View } from 'react-native';
import type { AnalyzeResponse } from '../lib/types';
import { colors, radius, type } from '../theme';
import { AppText as Text } from './AppText';
import { Card, SectionLabel, verdictStyle } from './ui';

/** The analysis itself. Used by the app's result screen and the share card. */
export function ResultView({ data, compact = false }: { data: AnalyzeResponse; compact?: boolean }) {
  const { analysis: a, scansRemainingToday } = data;
  const v = verdictStyle[a.verdict];

  return (
    <View style={{ gap: 8 }}>
      <View style={[s.verdict, { borderColor: v.color }]}>
        <View style={[s.badge, { backgroundColor: v.color }]}>
          <Text style={s.badgeIcon}>{v.icon}</Text>
        </View>
        <Text style={[s.verdictLabel, { color: v.color }]}>{v.label}</Text>
        <Text style={s.headline}>{a.headline}</Text>
        <Text style={s.confidence}>Wary confidence: {a.confidence}</Text>
      </View>

      {a.next_steps.length > 0 && (
        <>
          <SectionLabel>WHAT TO DO</SectionLabel>
          <Card style={{ gap: 12 }}>
            {a.next_steps.map((step, i) => (
              <View key={i} style={s.stepRow}>
                <Text style={s.stepNum}>{i + 1}</Text>
                <Text style={[s.body, { flex: 1 }]}>{step}</Text>
              </View>
            ))}
          </Card>
        </>
      )}

      {a.red_flags.length > 0 && (
        <>
          <SectionLabel>WARNING SIGNS</SectionLabel>
          <View style={{ gap: 10 }}>
            {a.red_flags.map((f, i) => (
              <Card key={i}>
                <Text style={s.flagTitle}>⚠︎ {f.signal}</Text>
                <Text style={s.small}>{f.why}</Text>
              </Card>
            ))}
          </View>
        </>
      )}

      <SectionLabel>WHAT YOU’RE LOOKING AT</SectionLabel>
      <Card>
        <Text style={s.body}>{a.what_it_is}</Text>
      </Card>

      {!compact && a.reassuring_signs.length > 0 && (
        <>
          <SectionLabel>REASSURING SIGNS</SectionLabel>
          <Card style={{ gap: 6 }}>
            {a.reassuring_signs.map((r, i) => (
              <Text key={i} style={s.small}>
                ✓ {r}
              </Text>
            ))}
          </Card>
        </>
      )}

      {!compact && a.link_checks && a.link_checks.length > 0 && (
        <>
          <SectionLabel>LINK DETAILS</SectionLabel>
          {a.link_checks.map((l, i) => (
            <Card key={i} style={{ gap: 4 }}>
              <Text style={s.mono}>{l.hostname}</Text>
              {l.redirects > 0 && <Text style={s.small}>Redirects {l.redirects}× before landing on {safeHost(l.finalUrl)}</Text>}
              {l.knownThreat && <Text style={[s.small, { color: colors.danger }]}>On Google’s list of unsafe sites</Text>}
            </Card>
          ))}
        </>
      )}

      <SectionLabel>WHAT WARY CAN’T CHECK</SectionLabel>
      <Text style={s.small}>{a.cannot_verify}</Text>

      {scansRemainingToday !== null && (
        <Text style={[s.small, { marginTop: 12, textAlign: 'center' }]}>{scansRemainingToday} free scans left today</Text>
      )}
    </View>
  );
}

const safeHost = (u: string) => {
  try {
    return new URL(u).hostname;
  } catch {
    return u;
  }
};

const s = StyleSheet.create({
  verdict: { borderWidth: 2, borderRadius: radius, padding: 20, alignItems: 'center', gap: 8, backgroundColor: colors.surface },
  badge: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  badgeIcon: { fontSize: 28, fontWeight: '900', color: colors.onMint },
  verdictLabel: { ...type.label, fontSize: 16 },
  headline: { color: colors.text, ...type.title, textAlign: 'center' },
  confidence: { color: colors.textMuted, ...type.small },
  body: { color: colors.text, ...type.body },
  small: { color: colors.textMuted, ...type.small },
  flagTitle: { color: colors.text, fontSize: 17, fontWeight: '600', marginBottom: 4 },
  stepRow: { flexDirection: 'row', gap: 12 },
  stepNum: { color: colors.mint, fontSize: 18, fontWeight: '800', width: 20 },
  mono: { color: colors.text, fontFamily: 'Menlo', fontSize: 16 },
});
