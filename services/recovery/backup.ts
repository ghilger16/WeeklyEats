import AsyncStorage from "@react-native-async-storage/async-storage";

// Explicit list: never export passwords, analytics IDs, purchases, debug overrides,
// notification request IDs, or the derived widget snapshot.
export const BACKUP_KEYS = [
  "@weeklyeats/meals", "@weeklyeats/servedMeals", "@weeklyeats/familyMembers",
  "@weeklyeats/dayPins", "@weeklyeats/cuisineSides", "@weeklyeats/mealIngredientSuggestions",
  "@weeklyeats/weekPlan", "@weeklyeats/weekPlanSides", "@weeklyeats/weekPlanByWeek",
  "@weeklyeats/weekPlanSidesByWeek", "@weeklyeats/weekPlanStreak", "@weeklyeats/weekPlanHistory",
  "@weeklyeats/weekPlanDraftByWeek", "@weeklyeats/groceryListsByWeek", "@weeklyeats/groceryListViewMode",
  "@weeklyeats/onboardingCompleted", "@weeklyeats/firstWeekExperienceActive",
  "@weeklyeats/firstFullWeekPlanned", "@weeklyeats/ratingDisplayMode",
  "weeklyeats.weekStartDay", "weeklyeats.themePreference", "weeklyeats.notificationPreferences",
  "weekly-eats:ingredient-classification-preferences:v1",
] as const;
export const MAX_BACKUP_LENGTH = 20 * 1024 * 1024;
export const PENDING_RESTORE_KEY = "weeklyeats.recovery.pending";
export const RESTORE_JOURNAL_KEY = "weeklyeats.recovery.journal";
export const PREVIOUS_BACKUP_KEY = "weeklyeats.recovery.previous";
type Entries = Record<string, string | null>;
export type Backup = { format: "WeeklyEatsBackup"; version: 1; createdAt: string; entries: Entries; checksum: string };
const isObject = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);

// Detect accidental truncation/edits; this is not encryption or authentication.
function checksum(entries: Entries): string {
  const input = JSON.stringify(BACKUP_KEYS.map(key => [key, entries[key]]));
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) hash = Math.imul(hash ^ input.charCodeAt(i), 16777619);
  return (hash >>> 0).toString(16).padStart(8, "0");
}
export async function captureBackup(): Promise<Backup> {
  const entries = Object.fromEntries(await AsyncStorage.multiGet([...BACKUP_KEYS]));
  return { format: "WeeklyEatsBackup", version: 1, createdAt: new Date().toISOString(), entries, checksum: checksum(entries) };
}
export function parseBackup(text: string): Backup {
  if (text.length > MAX_BACKUP_LENGTH) throw new Error("This backup is too large to restore.");
  let value: unknown;
  try { value = JSON.parse(text); } catch { throw new Error("This file is not valid backup JSON."); }
  if (!isObject(value) || value.format !== "WeeklyEatsBackup" || value.version !== 1 ||
      typeof value.createdAt !== "string" || !Number.isFinite(Date.parse(value.createdAt)) || !isObject(value.entries)) {
    throw new Error("Choose a supported WeeklyEats backup file.");
  }
  const entries = value.entries;
  if (Object.keys(entries).length !== BACKUP_KEYS.length || BACKUP_KEYS.some(key =>
    !Object.prototype.hasOwnProperty.call(entries, key) || (entries[key] !== null && typeof entries[key] !== "string"))) {
    throw new Error("This backup is incomplete or contains unsupported data.");
  }
  if (value.checksum !== checksum(entries as Entries)) throw new Error("This backup has changed or is damaged. Choose the original exported file.");
  return value as Backup;
}
export function backupMealCount(backup: Backup): number {
  try { const meals = JSON.parse(backup.entries["@weeklyeats/meals"] ?? "[]"); return Array.isArray(meals) ? meals.length : 0; }
  catch { return 0; }
}
async function applyBackup(backup: Backup) {
  const present: [string, string][] = [];
  const absent: string[] = [];
  BACKUP_KEYS.forEach(key => {
    const value = backup.entries[key];
    if (value === null) absent.push(key); else present.push([key, value]);
  });
  if (present.length) await AsyncStorage.multiSet(present);
  if (absent.length) await AsyncStorage.multiRemove(absent);
  const actual = Object.fromEntries(await AsyncStorage.multiGet([...BACKUP_KEYS]));
  if (BACKUP_KEYS.some(key => actual[key] !== backup.entries[key])) throw new Error("Backup verification failed.");
}
export async function stageRestore(backup: Backup) {
  const serialized = JSON.stringify(backup);
  parseBackup(serialized);
  await AsyncStorage.setItem(PENDING_RESTORE_KEY, serialized);
}

// Runs before any providers/screens mount. A terminated restore rolls back on
// next launch; no stale in-memory stores can overwrite newly restored data.
let startupRecovery: Promise<string | null> | null = null;
export function recoverOnStartup(): Promise<string | null> {
  if (!startupRecovery) startupRecovery = finishRecovery().finally(() => { startupRecovery = null; });
  return startupRecovery;
}
async function finishRecovery(): Promise<string | null> {
  const journal = await AsyncStorage.getItem(RESTORE_JOURNAL_KEY);
  if (journal) {
    await applyBackup(parseBackup(journal));
    await AsyncStorage.removeItem(PENDING_RESTORE_KEY);
    await AsyncStorage.removeItem(RESTORE_JOURNAL_KEY);
    return "An interrupted restore was rolled back. Your previous data is available.";
  }
  const pending = await AsyncStorage.getItem(PENDING_RESTORE_KEY);
  if (!pending) return null;
  let backup: Backup;
  try { backup = parseBackup(pending); }
  catch {
    await AsyncStorage.removeItem(PENDING_RESTORE_KEY);
    return "The pending backup could not be validated. Your existing data was not changed.";
  }
  const before = JSON.stringify(await captureBackup());
  parseBackup(before);
  await AsyncStorage.setItem(PREVIOUS_BACKUP_KEY, before);
  await AsyncStorage.setItem(RESTORE_JOURNAL_KEY, before);
  try {
    await applyBackup(backup);
    await AsyncStorage.removeItem(PENDING_RESTORE_KEY);
    await AsyncStorage.removeItem(RESTORE_JOURNAL_KEY);
    return "Backup restored. Your previous data is also available under Export Pre-Restore Backup.";
  } catch {
    // Leave the journal in place if rollback itself fails; startup stays blocked.
    await applyBackup(parseBackup(before));
    await AsyncStorage.removeItem(PENDING_RESTORE_KEY);
    await AsyncStorage.removeItem(RESTORE_JOURNAL_KEY);
    return "Restore failed. Your previous data was recovered; nothing was replaced.";
  }
}
