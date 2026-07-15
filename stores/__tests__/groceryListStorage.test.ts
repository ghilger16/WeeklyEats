jest.mock(
  "@react-native-async-storage/async-storage",
  () => require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

import {
  createGroceryList,
  reconcileGroceryList,
} from "../groceryListStorage";
import { GroceryListItem } from "../../types/groceryList";

const plannedItem = (id: string): GroceryListItem => ({
  id,
  name: id,
  category: "other",
  source: "planned",
  sortIndex: 0,
});

describe("reconcileGroceryList", () => {
  it("replaces planned items while preserving manual items and valid checks", () => {
    const stored = createGroceryList("2026-07-12", [
      plannedItem("kept"),
      plannedItem("removed"),
    ]);
    stored.manualItems = [
      {
        ...plannedItem("manual"),
        name: "Paper towels",
        source: "manual",
      },
    ];
    stored.checkedItems = ["kept", "removed", "manual"];

    const reconciled = reconcileGroceryList(
      "2026-07-12",
      [plannedItem("kept"), plannedItem("added")],
      stored,
    );

    expect(reconciled.items.map((item) => item.id)).toEqual(["kept", "added"]);
    expect(reconciled.manualItems).toEqual(stored.manualItems);
    expect(reconciled.checkedItems).toEqual(["kept", "manual"]);
  });

  it("creates a new list when the week has no stored list", () => {
    const reconciled = reconcileGroceryList(
      "2026-07-19",
      [plannedItem("new")],
      null,
    );

    expect(reconciled.weekId).toBe("2026-07-19");
    expect(reconciled.items.map((item) => item.id)).toEqual(["new"]);
    expect(reconciled.manualItems).toEqual([]);
  });

  it("preserves a checked ingredient when its meal moves to another day", () => {
    const originalItem: GroceryListItem = {
      ...plannedItem("tue-meal-1-0"),
      name: "Butter",
      mealId: "meal-1",
      category: "dairy",
    };
    const movedItem: GroceryListItem = {
      ...originalItem,
      id: "thu-meal-1-0",
    };
    const stored = createGroceryList("2026-07-12", [originalItem]);
    stored.checkedItems = [originalItem.id];

    const reconciled = reconcileGroceryList(
      "2026-07-12",
      [movedItem],
      stored,
    );

    expect(reconciled.checkedItems).toEqual([movedItem.id]);
  });
});
