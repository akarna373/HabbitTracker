import { Asset, requestPermissionsAsync } from "expo-media-library";
import * as Sharing from "expo-sharing";
import type { RefObject } from "react";
import type { View } from "react-native";
import { captureRef } from "react-native-view-shot";
import { toFileUri } from "./shareCard";

// The phone-side half of sharing the progress card: turning the card into a picture, handing it to
// the share sheet, and saving it to the gallery. Kept thin and free of app logic (what is on the card
// is decided in lib/shareCard.ts, which is tested); it needs a real device to run.

// The saved picture's size: 4:5 portrait, 1080 wide.
export const CARD_PIXEL_WIDTH = 1080;
export const CARD_PIXEL_HEIGHT = 1350;

// Renders the card view to a PNG in the app's temporary folder and returns its file URI. The picture is
// drawn at the size above whatever the phone's screen density is.
export async function captureCard(view: RefObject<View | null>, fileName: string): Promise<string> {
  const path = await captureRef(view, {
    format: "png",
    quality: 1,
    result: "tmpfile",
    width: CARD_PIXEL_WIDTH,
    height: CARD_PIXEL_HEIGHT,
    fileName,
  });
  return toFileUri(path);
}

export async function canShareImages(): Promise<boolean> {
  try {
    return await Sharing.isAvailableAsync();
  } catch {
    return false;
  }
}

// Opens the phone's own share sheet (WhatsApp, Instagram, Messages, ...) with the picture.
export async function shareImage(uri: string): Promise<void> {
  await Sharing.shareAsync(uri, { mimeType: "image/png", dialogTitle: "Share your progress" });
}

export type SaveResult = "saved" | "denied" | "failed";

// Puts the picture in the phone's gallery. Saving a new picture needs no permission on newer Android, so
// it is tried first; only if that is refused does it ask, and asks for write-only access (it never needs
// to read the person's photos).
export async function saveImageToGallery(uri: string): Promise<SaveResult> {
  try {
    await Asset.create(uri);
    return "saved";
  } catch {
    // fall through and ask for permission
  }
  try {
    const permission = await requestPermissionsAsync(true);
    if (!permission.granted) return "denied";
    await Asset.create(uri);
    return "saved";
  } catch {
    return "failed";
  }
}
