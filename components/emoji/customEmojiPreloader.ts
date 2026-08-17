import { Asset } from "expo-asset";
import { CUSTOM_EMOJI_ASSETS } from "./customEmojiRegistry";

let preloadPromise: Promise<Asset[]> | null = null;

export const preloadCustomEmojiAssets = () => {
  preloadPromise ??= Asset.loadAsync([...CUSTOM_EMOJI_ASSETS]);
  return preloadPromise;
};
