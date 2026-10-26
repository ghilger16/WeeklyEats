import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as DocumentPicker from "expo-document-picker";
import { Backup, MAX_BACKUP_LENGTH, parseBackup } from "./backup";

export async function exportBackupFile(backup: Backup) {
  if (!FileSystem.cacheDirectory || !await Sharing.isAvailableAsync()) throw new Error("File sharing is unavailable on this device.");
  const uri = `${FileSystem.cacheDirectory}WeeklyEats-backup-${backup.createdAt.replace(/[:.]/g, "-")}.json`;
  const text = JSON.stringify(backup, null, 2);
  parseBackup(text);
  await FileSystem.writeAsStringAsync(uri, text);
  const info = await FileSystem.getInfoAsync(uri);
  if (!info.exists || info.isDirectory || info.size > MAX_BACKUP_LENGTH) throw new Error("The backup exceeds the 20 MB file limit.");
  if (await FileSystem.readAsStringAsync(uri) !== text) throw new Error("The backup file could not be verified.");
  await Sharing.shareAsync(uri, { mimeType: "application/json", UTI: "public.json", dialogTitle: "Save WeeklyEats Backup" });
  // Sharing completion does not prove that the user saved the file.
}
export async function pickBackupFile(): Promise<Backup | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: ["application/json", "text/plain"], copyToCacheDirectory: true, multiple: false });
  if (result.canceled) return null;
  const asset = result.assets[0];
  try {
    const info = await FileSystem.getInfoAsync(asset.uri);
    if (!info.exists || info.isDirectory || info.size > MAX_BACKUP_LENGTH) throw new Error("Choose a backup file smaller than 20 MB.");
    return parseBackup(await FileSystem.readAsStringAsync(asset.uri));
  } finally {
    await FileSystem.deleteAsync(asset.uri, { idempotent: true }).catch(() => {});
  }
}
