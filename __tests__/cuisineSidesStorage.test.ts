import AsyncStorage from "@react-native-async-storage/async-storage";
import { CUISINE_SIDES_STORAGE_KEY, getCuisineSidesSnapshot, loadCuisineSides, normalizeCuisineSides, saveCuisineSides } from "../stores/cuisineSidesStorage";

jest.mock("@react-native-async-storage/async-storage", () => require("@react-native-async-storage/async-storage/jest/async-storage-mock"));

it("normalizes, deduplicates and caps custom suggestions at six", () => {
  expect(normalizeCuisineSides([" Beans ", "beans", "", null, "Green  Beans", "Rice", "Corn", "Rolls", "Salad", "Extra"]))
    .toEqual(["Beans", "Green Beans", "Rice", "Corn", "Rolls", "Salad"]);
});

it("hydrates saved overrides and serializes cuisine writes without losing other cuisines", async () => {
  await AsyncStorage.setItem(CUISINE_SIDES_STORAGE_KEY, JSON.stringify({ american: ["Baked Beans"], unknown: ["Ignore"] }));
  await loadCuisineSides();
  expect(getCuisineSidesSnapshot()).toEqual({ american: ["Baked Beans"] });
  await Promise.all([saveCuisineSides("italian", ["Garlic Bread"]), saveCuisineSides("mexican", [])]);
  const persisted = JSON.parse((await AsyncStorage.getItem(CUISINE_SIDES_STORAGE_KEY))!);
  expect(persisted).toEqual({ american: ["Baked Beans"], italian: ["Garlic Bread"], mexican: [] });
  expect(getCuisineSidesSnapshot()).toEqual(persisted);
});

it("keeps the previous suggestions when persistence fails", async () => {
  const before = getCuisineSidesSnapshot();
  (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(new Error("disk full"));
  await expect(saveCuisineSides("american", ["New side"])).rejects.toThrow("disk full");
  expect(getCuisineSidesSnapshot()).toBe(before);
});
