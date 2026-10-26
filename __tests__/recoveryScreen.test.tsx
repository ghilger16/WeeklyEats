import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { Alert } from "react-native";
import { reloadAppAsync } from "expo";
import RecoveryScreen from "../app/modals/recovery";
import { captureBackup, stageRestore } from "../services/recovery/backup";
import { exportBackupFile, pickBackupFile } from "../services/recovery/backupFiles";
import { repairWidget } from "../services/widget/syncWidgetState";

jest.mock("@react-native-async-storage/async-storage", () => require("@react-native-async-storage/async-storage/jest/async-storage-mock"));
jest.mock("expo", () => ({ reloadAppAsync: jest.fn().mockResolvedValue(undefined) }));
jest.mock("expo-router", () => ({ useRouter: () => ({ back: jest.fn() }) }));
jest.mock("react-native-safe-area-context", () => ({ SafeAreaView: require("react-native").View }));
jest.mock("../providers/theme/ThemeController", () => ({ useThemeController: () => ({ theme: { color: { bg: "white", ink: "black", accent: "pink", subtleInk: "gray" } } }) }));
jest.mock("../components/settings/SettingsRow", () => ({ __esModule: true, default: ({ label, onPress }: any) => {
  const { Pressable, Text } = require("react-native");
  return <Pressable onPress={onPress}><Text>{label}</Text></Pressable>;
} }));
jest.mock("../services/recovery/backupFiles", () => ({ exportBackupFile: jest.fn(), pickBackupFile: jest.fn() }));
jest.mock("../services/recovery/backup", () => ({ ...jest.requireActual("../services/recovery/backup"), stageRestore: jest.fn() }));
jest.mock("../services/widget/syncWidgetState", () => ({ repairWidget: jest.fn() }));

beforeEach(() => { jest.clearAllMocks(); jest.spyOn(Alert, "alert").mockImplementation(() => {}); });
it("leaves data alone when the picker is canceled", async () => {
  jest.mocked(pickBackupFile).mockResolvedValue(null);
  const screen = render(<RecoveryScreen />);
  fireEvent.press(screen.getByText("Restore Backup"));
  await waitFor(() => expect(pickBackupFile).toHaveBeenCalled());
  expect(stageRestore).not.toHaveBeenCalled();
  expect(reloadAppAsync).not.toHaveBeenCalled();
});
it("checks the file without staging a restore", async () => {
  jest.mocked(pickBackupFile).mockResolvedValue(await captureBackup());
  const screen = render(<RecoveryScreen />);
  fireEvent.press(screen.getByText("Check Backup File"));
  await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith("Backup verified", expect.any(String)));
  expect(stageRestore).not.toHaveBeenCalled();
});
it("requires explicit confirmation and keeps editing blocked until restart", async () => {
  const backup = await captureBackup();
  jest.mocked(pickBackupFile).mockResolvedValue(backup);
  const screen = render(<RecoveryScreen />);
  fireEvent.press(screen.getByText("Restore Backup"));
  await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith("Replace saved data?", expect.any(String), expect.any(Array), expect.any(Object)));
  expect(stageRestore).not.toHaveBeenCalled();
  const buttons = jest.mocked(Alert.alert).mock.calls[0][2]!;
  await act(async () => { buttons[1].onPress!(); });
  expect(stageRestore).toHaveBeenCalledWith(backup);
  expect(reloadAppAsync).toHaveBeenCalled();
  expect(screen.getByText("Restart to finish restoring")).toBeTruthy();
});
it("does not equate a dismissed share sheet with a saved backup", async () => {
  const screen = render(<RecoveryScreen />);
  fireEvent.press(screen.getByText("Export Backup"));
  await waitFor(() => expect(exportBackupFile).toHaveBeenCalled());
  await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith("Check your saved backup", expect.stringContaining("Closing the share sheet does not save a backup")));
});
it("reports a widget repair failure without claiming success", async () => {
  jest.mocked(repairWidget).mockRejectedValueOnce(new Error("Shared storage unavailable"));
  const screen = render(<RecoveryScreen />);
  fireEvent.press(screen.getByText("Repair Widget"));
  await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith("Recovery action couldn’t finish", "Shared storage unavailable"));
});

it("canceling the replacement confirmation does not stage or restart", async () => {
  jest.mocked(pickBackupFile).mockResolvedValue(await captureBackup());
  const screen = render(<RecoveryScreen />);
  fireEvent.press(screen.getByText("Restore Backup"));
  await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith("Replace saved data?", expect.any(String), expect.any(Array), expect.any(Object)));
  await act(async () => { jest.mocked(Alert.alert).mock.calls[0][2]![0].onPress!(); });
  expect(stageRestore).not.toHaveBeenCalled();
  expect(reloadAppAsync).not.toHaveBeenCalled();
});
