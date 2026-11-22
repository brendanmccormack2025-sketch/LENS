import * as ImagePicker from 'expo-image-picker';
import { getThumbnailAsync } from 'expo-video-thumbnails';
import { prepareImage } from './prepareImage';
import type { AnalyzeRequest } from './types';

/** Opens the photo library — screenshots, photos or videos — and returns a ready request. */
export async function pickScreenshot(): Promise<AnalyzeRequest | null> {
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], allowsEditing: false });
  return toRequest(res);
}

const FRAME_COUNT = 4;

/**
 * The AI can't watch video, so we take a few still frames spread across it
 * (smaller than screenshots, to keep the upload light). Audio isn't checked.
 */
async function videoToRequest(uri: string, durationMs: number | null | undefined): Promise<AnalyzeRequest> {
  const total = durationMs && durationMs > 0 ? durationMs : 4000;
  const times = Array.from({ length: FRAME_COUNT }, (_, i) => Math.round((total * (i + 0.5)) / FRAME_COUNT));
  const frames = [];
  for (const time of times) {
    try {
      const thumb = await getThumbnailAsync(uri, { time, quality: 0.8 });
      const img = await prepareImage(thumb.uri, 1024);
      frames.push({ imageBase64: img.imageBase64, mediaType: 'image/jpeg' as const });
    } catch {
      // A frame past the end or unreadable — skip it.
    }
  }
  if (!frames.length) throw new Error('Could not read that video');
  return { kind: 'video', frames, durationSec: durationMs ? Math.round(durationMs / 1000) : null };
}

/** Takes a photo of something physical (a letter, a parking-meter sticker, a screen). */
export async function takePhoto(): Promise<AnalyzeRequest | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) return null;
  const res = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'] });
  return toRequest(res);
}

async function toRequest(res: ImagePicker.ImagePickerResult): Promise<AnalyzeRequest | null> {
  const asset = res.canceled ? null : res.assets[0];
  if (!asset?.uri) return null;
  if (asset.type === 'video') return videoToRequest(asset.uri, asset.duration);
  return prepareImage(asset.uri);
}
