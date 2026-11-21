import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

export interface MockRow {
  label: string;
  value?: string;
  toggle?: boolean; // shows an iOS-style switch, on or off
  highlight?: boolean; // the thing to tap
}

/**
 * A small drawing of the iPhone Settings screen the user is about to see, with the
 * row they need highlighted. Drawn (not a screenshot) so it stays accurate and light.
 */
export function SettingsMock({ title, rows }: { title: string; rows: MockRow[] }) {
  return (
    <View style={s.phone} accessibilityLabel={`Settings screen: ${title}`}>
      <Text style={s.title}>{title}</Text>
      <View style={s.group}>
        {rows.map((r, i) => (
          <View key={i} style={[s.row, i > 0 && s.divider, r.highlight && s.hl]}>
            <Text style={[s.label, r.highlight && s.hlText]}>{r.label}</Text>
            {r.toggle !== undefined ? (
              <View style={[s.switch, r.toggle && s.switchOn]}>
                <View style={[s.knob, r.toggle && s.knobOn]} />
              </View>
            ) : r.value ? (
              <Text style={s.value}>{r.value} ›</Text>
            ) : (
              <Text style={s.value}>›</Text>
            )}
          </View>
        ))}
      </View>
      {rows.some((r) => r.highlight) ? <Text style={s.hint}>☝︎ Tap the highlighted row</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  phone: { backgroundColor: '#F2F2F7', borderRadius: 22, padding: 14, gap: 8 },
  title: { fontSize: 17, fontWeight: '700', color: '#000', textAlign: 'center', marginBottom: 4 },
  group: { backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 14, gap: 8 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#C6C6C8' },
  hl: { backgroundColor: '#FFF4C2', borderWidth: 2, borderColor: colors.caution, borderRadius: 10 },
  label: { flex: 1, fontSize: 16, color: '#000' },
  hlText: { fontWeight: '700' },
  value: { fontSize: 16, color: '#8E8E93' },
  switch: { width: 46, height: 28, borderRadius: 14, backgroundColor: '#E5E5EA', padding: 2 },
  switchOn: { backgroundColor: '#34C759' },
  knob: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#fff' },
  knobOn: { marginLeft: 18 },
  hint: { fontSize: 14, color: '#3C3C43', textAlign: 'center' },
});
