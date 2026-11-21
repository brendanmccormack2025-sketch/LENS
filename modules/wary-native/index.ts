import { requireOptionalNativeModule } from 'expo';

type CallStatus = 'enabled' | 'disabled' | 'unknown';

interface WaryNativeModule {
  writeSharedFile(group: string, name: string, base64: string): Promise<number>;
  reloadCallDirectory(identifier: string): Promise<void>;
  callDirectoryStatus(identifier: string): Promise<CallStatus>;
  openCallSettings(): Promise<void>;
  isPasscodeSet(): boolean;
  readSharedNumber(group: string, key: string): number | null;
}

/** Null in Expo Go / web, where the native module isn't compiled in. */
export const WaryNative = requireOptionalNativeModule<WaryNativeModule>('WaryNative');
export type { CallStatus };
