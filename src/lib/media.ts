import * as ImagePicker from 'expo-image-picker';

import { MAX_VIDEO_BYTES, MAX_VIDEO_SECONDS } from './constants';
import { supabase } from './supabase';
import { uuid } from './uuid';

export type PickedMedia = {
  uri: string;
  kind: 'image' | 'video';
  mimeType: string;
  width: number;
  height: number;
  fileSize?: number;
};

export type Bucket = 'avatars' | 'media' | 'chat';

function guessMime(asset: ImagePicker.ImagePickerAsset): string {
  if (asset.mimeType) return asset.mimeType;
  const ext = (asset.fileName ?? asset.uri).split('.').pop()?.toLowerCase();
  if (asset.type === 'video') return ext === 'mov' ? 'video/quicktime' : 'video/mp4';
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'heic' || ext === 'heif') return 'image/heic';
  return 'image/jpeg';
}

function extensionFor(mime: string): string {
  switch (mime) {
    case 'image/png': return 'png';
    case 'image/webp': return 'webp';
    case 'image/heic':
    case 'image/heif': return 'heic';
    case 'video/quicktime': return 'mov';
    case 'video/mp4': return 'mp4';
    default: return 'jpg';
  }
}

function toPicked(asset: ImagePicker.ImagePickerAsset): PickedMedia {
  return {
    uri: asset.uri,
    kind: asset.type === 'video' ? 'video' : 'image',
    mimeType: guessMime(asset),
    width: asset.width,
    height: asset.height,
    fileSize: asset.fileSize,
  };
}

function validate(items: PickedMedia[]): PickedMedia[] {
  for (const item of items) {
    if (item.kind === 'video' && item.fileSize && item.fileSize > MAX_VIDEO_BYTES) {
      throw new Error('Videos must be under 50 MB. Try a shorter clip.');
    }
  }
  return items;
}

type PickOptions = {
  allowVideo?: boolean;
  multiple?: boolean;
  max?: number;
  crop?: [number, number];
};

/** Opens the system photo library. No permission prompt is required. */
export async function pickFromLibrary(options: PickOptions = {}): Promise<PickedMedia[]> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: options.allowVideo ? ['images', 'videos'] : ['images'],
    allowsMultipleSelection: Boolean(options.multiple),
    selectionLimit: options.multiple ? options.max ?? 4 : 1,
    allowsEditing: Boolean(options.crop) && !options.multiple,
    aspect: options.crop,
    quality: 0.75,
    videoMaxDuration: MAX_VIDEO_SECONDS,
  });
  if (result.canceled) return [];
  return validate(result.assets.map(toPicked));
}

export async function takePhoto(crop?: [number, number]): Promise<PickedMedia | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Camera access is turned off. You can enable it in Settings.');
  }
  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    allowsEditing: Boolean(crop),
    aspect: crop,
    quality: 0.75,
  });
  if (result.canceled || !result.assets[0]) return null;
  return toPicked(result.assets[0]);
}

/**
 * Uploads a local file to Supabase Storage and returns the object path.
 * Paths always start with a folder the storage policies check
 * (the user's id, or the conversation id for chat images).
 */
export async function uploadToBucket(bucket: Bucket, folder: string, media: PickedMedia): Promise<string> {
  const path = `${folder}/${uuid()}.${extensionFor(media.mimeType)}`;
  const response = await fetch(media.uri);
  const body = await response.arrayBuffer();
  const { error } = await supabase.storage.from(bucket).upload(path, body, {
    contentType: media.mimeType,
    cacheControl: '31536000',
    upsert: false,
  });
  if (error) throw error;
  return path;
}

export function publicUrl(bucket: 'avatars' | 'media', path: string): string {
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

/** Upload to a public bucket and return the public URL. */
export async function uploadPublic(bucket: 'avatars' | 'media', userId: string, media: PickedMedia): Promise<string> {
  const path = await uploadToBucket(bucket, userId, media);
  return publicUrl(bucket, path);
}

export async function uploadManyPublic(userId: string, items: PickedMedia[]): Promise<string[]> {
  return Promise.all(items.map((item) => uploadPublic('media', userId, item)));
}
