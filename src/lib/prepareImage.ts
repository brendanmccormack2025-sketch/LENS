import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import type { AnalyzeRequest } from './types';

// Claude downsamples anything past ~1568px on the long edge anyway, so sending
// more just costs upload time and memory (which share extensions have little of).
const MAX_EDGE = 1568;

/** Local image file → small JPEG request ready for the analyze endpoint. */
export async function prepareImage(uri: string, maxEdge = MAX_EDGE): Promise<Extract<AnalyzeRequest, { kind: 'image' }>> {
  const original = await ImageManipulator.manipulate(uri).renderAsync();
  const { width, height } = original;
  const longEdge = Math.max(width, height);

  const sized =
    longEdge > maxEdge
      ? await ImageManipulator.manipulate(original)
          .resize(width >= height ? { width: maxEdge } : { height: maxEdge })
          .renderAsync()
      : original;

  const out = await sized.saveAsync({ base64: true, format: SaveFormat.JPEG, compress: 0.7 });
  if (!out.base64) throw new Error('Could not read that image');
  return { kind: 'image', imageBase64: out.base64, mediaType: 'image/jpeg' };
}
