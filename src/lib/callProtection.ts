import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { WaryNative, type CallStatus } from '../../modules/wary-native';
import { ensureSession, supabase } from './supabase';

export const APP_GROUP = 'group.com.brendanmccormack.lens';
export const CALLER_ID_EXTENSION = 'com.brendanmccormack.lens.callerid';
const LAST_SYNC = 'calls.lastSync';
const SYNC_EVERY_MS = 20 * 60 * 60 * 1000; // FTC data updates once per weekday

export interface CallSyncInfo {
  entries: number;
  version: string | null;
  syncedAt: number;
}

export const nativeAvailable = () => Platform.OS === 'ios' && WaryNative != null;

export async function getCallStatus(): Promise<CallStatus> {
  if (!nativeAvailable()) return 'unknown';
  try {
    return await WaryNative!.callDirectoryStatus(CALLER_ID_EXTENSION);
  } catch {
    return 'unknown';
  }
}

export async function lastSync(): Promise<CallSyncInfo | null> {
  const raw = await AsyncStorage.getItem(LAST_SYNC);
  return raw ? (JSON.parse(raw) as CallSyncInfo) : null;
}

/**
 * Downloads the reported-caller list, writes it to the shared App Group and asks iOS
 * to reload Wary's Caller ID extension. Runs at most about once a day unless forced.
 * iOS gives apps no background schedule for this, so it runs when Wary is opened.
 */
export async function syncCallList(force = false): Promise<CallSyncInfo | null> {
  if (!nativeAvailable()) return null;
  const prev = await lastSync();
  if (!force && prev && Date.now() - prev.syncedAt < SYNC_EVERY_MS) return prev;

  await ensureSession();
  const { data, error } = await supabase.functions.invoke<{ blob: string; entries: number; version: string | null }>(
    'CallList',
    { method: 'GET' }
  );
  if (error || !data) return prev;
  // Don't replace a working list with an empty one (e.g. before the first FTC import).
  if (!data.entries && prev?.entries) return prev;

  await WaryNative!.writeSharedFile(APP_GROUP, 'calllist.bin', data.blob);
  if ((await getCallStatus()) === 'enabled') {
    await WaryNative!.reloadCallDirectory(CALLER_ID_EXTENSION).catch(() => {});
  }
  const info: CallSyncInfo = { entries: data.entries, version: data.version, syncedAt: Date.now() };
  await AsyncStorage.setItem(LAST_SYNC, JSON.stringify(info));
  return info;
}

export async function openCallSettings() {
  if (nativeAvailable()) await WaryNative!.openCallSettings().catch(() => {});
}

export function isPasscodeSet(): boolean | null {
  if (!nativeAvailable()) return null;
  try {
    return WaryNative!.isPasscodeSet();
  } catch {
    return null;
  }
}

/** When the Safari extension last reported in (seconds since 1970), or null if never. */
export function safariLastSeen(): number | null {
  if (!nativeAvailable()) return null;
  try {
    return WaryNative!.readSharedNumber(APP_GROUP, 'safari.lastSeen');
  } catch {
    return null;
  }
}
