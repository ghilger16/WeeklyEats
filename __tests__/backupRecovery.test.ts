jest.mock("@react-native-async-storage/async-storage", () => require("@react-native-async-storage/async-storage/jest/async-storage-mock"));
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BACKUP_KEYS, captureBackup, parseBackup, stageRestore, recoverOnStartup, PENDING_RESTORE_KEY, RESTORE_JOURNAL_KEY, PREVIOUS_BACKUP_KEY } from "../services/recovery/backup";

const originalMultiSet = (AsyncStorage.multiSet as jest.Mock).getMockImplementation()!;
beforeEach(async () => { jest.restoreAllMocks(); (AsyncStorage.multiSet as jest.Mock).mockImplementation(originalMultiSet); await AsyncStorage.clear(); });
const saveMeals = (title: string) => AsyncStorage.setItem("@weeklyeats/meals", JSON.stringify([{ id: "meal-1", title }]));

it("round trips every supported key byte-for-byte, excluding credentials and device state", async () => {
  await AsyncStorage.multiSet(BACKUP_KEYS.map(key => [key, `saved ${key}`]));
  await AsyncStorage.multiSet([["@weeklyeats/onboardingAccount", '{"password":"secret"}'], ["@weeklyeats/analytics-install-id", "device"], ["weeklyeats.notificationSchedule", "schedule"]]);
  const backup = await captureBackup();
  expect(JSON.stringify(backup)).not.toContain("secret");
  expect(Object.keys(backup.entries)).toEqual([...BACKUP_KEYS]);
  expect(parseBackup(JSON.stringify(backup))).toEqual(backup);
  await AsyncStorage.multiRemove([...BACKUP_KEYS]);
  await stageRestore(backup);
  await recoverOnStartup();
  for (const key of BACKUP_KEYS) expect(await AsyncStorage.getItem(key)).toBe(`saved ${key}`);
  expect(await AsyncStorage.getItem("@weeklyeats/analytics-install-id")).toBe("device");
  expect(await AsyncStorage.getItem("weeklyeats.notificationSchedule")).toBe("schedule");
});

it("validates without writing and rejects truncated, edited, incomplete, unrelated and newer files", async () => {
  await saveMeals("Original");
  const backup = await captureBackup();
  jest.clearAllMocks();
  const write = jest.spyOn(AsyncStorage, "multiSet");
  const edited = { ...backup, entries: { ...backup.entries, "@weeklyeats/meals": "[]" } };
  const missing = { ...backup, entries: {} };
  for (const raw of ["{", "{}", JSON.stringify(edited), JSON.stringify(missing), JSON.stringify({ ...backup, version: 2 })]) {
    expect(() => parseBackup(raw)).toThrow();
  }
  expect(write).not.toHaveBeenCalled();
});

it("stages without modifying data, then replaces absent keys and saves the pre-restore copy", async () => {
  await saveMeals("From backup");
  const backup = await captureBackup();
  await saveMeals("Current");
  await AsyncStorage.setItem("@weeklyeats/weekPlanHistory", "[]");
  await stageRestore(backup);
  expect(await AsyncStorage.getItem("@weeklyeats/meals")).toContain("Current");
  await expect(recoverOnStartup()).resolves.toContain("Backup restored");
  expect(await AsyncStorage.getItem("@weeklyeats/meals")).toContain("From backup");
  expect(await AsyncStorage.getItem("@weeklyeats/weekPlanHistory")).toBeNull();
  const previous = parseBackup((await AsyncStorage.getItem(PREVIOUS_BACKUP_KEY))!);
  expect(previous.entries["@weeklyeats/meals"]).toContain("Current");
  expect(await AsyncStorage.getItem(RESTORE_JOURNAL_KEY)).toBeNull();
  expect(await AsyncStorage.getItem(PENDING_RESTORE_KEY)).toBeNull();
});

it("rolls back a partially written restore and verifies the original data", async () => {
  await saveMeals("Backup"); const backup = await captureBackup();
  await saveMeals("Keep me"); await stageRestore(backup);
  const original = originalMultiSet;
  let failed = false;
  jest.spyOn(AsyncStorage, "multiSet").mockImplementation(async rows => {
    await original(rows);
    if (!failed && rows.some(([key]) => key === "@weeklyeats/meals")) {
      failed = true; throw new Error("disk error after write");
    }
  });
  await expect(recoverOnStartup()).resolves.toContain("previous data was recovered");
  expect(await AsyncStorage.getItem("@weeklyeats/meals")).toContain("Keep me");
  expect(await AsyncStorage.getItem(RESTORE_JOURNAL_KEY)).toBeNull();
});

it("recovers a process termination using the journal before mounting the app", async () => {
  await saveMeals("Before crash");
  const before = await captureBackup();
  await AsyncStorage.setItem(RESTORE_JOURNAL_KEY, JSON.stringify(before));
  await saveMeals("Partial restore");
  await AsyncStorage.setItem(PENDING_RESTORE_KEY, "pending");
  await expect(recoverOnStartup()).resolves.toContain("interrupted restore was rolled back");
  expect(await AsyncStorage.getItem("@weeklyeats/meals")).toContain("Before crash");
  expect(await AsyncStorage.getItem(PENDING_RESTORE_KEY)).toBeNull();
});

it("keeps the journal and blocks startup if rollback cannot be verified", async () => {
  await saveMeals("Original");
  await AsyncStorage.setItem(RESTORE_JOURNAL_KEY, JSON.stringify(await captureBackup()));
  jest.spyOn(AsyncStorage, "multiSet").mockRejectedValueOnce(new Error("disk unavailable"));
  await expect(recoverOnStartup()).rejects.toThrow();
  expect(await AsyncStorage.getItem(RESTORE_JOURNAL_KEY)).not.toBeNull();
  await recoverOnStartup();
  expect(await AsyncStorage.getItem(RESTORE_JOURNAL_KEY)).toBeNull();
});

it("does not mutate user data when a pending restore is invalid", async () => {
  await saveMeals("Original");
  await AsyncStorage.setItem(PENDING_RESTORE_KEY, "bad data");
  await expect(recoverOnStartup()).resolves.toContain("not changed");
  expect(await AsyncStorage.getItem("@weeklyeats/meals")).toContain("Original");
});
