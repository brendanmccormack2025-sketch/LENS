import * as ImagePicker from 'expo-image-picker';
import type { AnalyzeRequest } from './types';

/** Opens the photo library (screenshots live there) and returns a ready request. */
export async function pickScreenshot(): Promise<AnalyzeRequest | null> {
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.6, // keeps upload small; text in screenshots stays legible
    base64: true,
    allowsEditing: false,
  });
  return toRequest(res);
}

/** Takes a photo of something physical (a letter, a parking-meter sticker, a screen). */
export async function takePhoto(): Promise<AnalyzeRequest | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) return null;
  const res = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.6, base64: true });
  return toRequest(res);
}

function toRequest(res: ImagePicker.ImagePickerResult): AnalyzeRequest | null {
  if (res.canceled || !res.assets[0]?.base64) return null;
  const a = res.assets[0];
  const mediaType = a.mimeType === 'image/png' ? 'image/png' : 'image/jpeg';
  return { kind: 'image', imageBase64: a.base64!, mediaType };
}
