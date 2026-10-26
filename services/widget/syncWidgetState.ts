import { Platform } from "react-native";
import { saveTodayWidgetPayload, TodayWidgetPayload } from "../../stores/todayWidgetStorage";
import { readWidgetSource } from "../../stores/widgetSourceStorage";
import { buildWidgetSnapshot, WidgetSource } from "../../utils/todayWidgetPlan";

export function createWidgetSync(dependencies: {
  read: () => Promise<WidgetSource>;
  save: (payload: TodayWidgetPayload, force: boolean) => Promise<boolean>;
  now: () => Date;
  settle: () => Promise<void>;
}) {
  let revision = 0;
  let running: Promise<void> | null = null;
  let lastFingerprint: string | undefined;
  let forceRevision = 0;
  let completedForceRevision = 0;
  return (force = false) => {
    revision += 1;
    if (force) forceRevision = revision;
    if (running) return running;
    running = (async () => {
      let processed = 0;
      while (processed !== revision) {
        await dependencies.settle();
        const readingRevision = revision;
        const source = await dependencies.read();
        // A save happened during the read. Discard this mixed/stale candidate.
        if (readingRevision !== revision) continue;
        const payload = buildWidgetSnapshot(source, dependencies.now());
        const { generatedAtISO, snapshotGeneratedAt, ...content } = payload;
        const fingerprint = JSON.stringify(content);
        const requestedForceRevision = forceRevision;
        const forceSave = requestedForceRevision > completedForceRevision;
        if (forceSave || fingerprint !== lastFingerprint) {
          if (!await dependencies.save(payload, forceSave)) throw new Error("Widget shared-data write failed");
          lastFingerprint = fingerprint;
          completedForceRevision = requestedForceRevision;
          if (__DEV__) console.log("[WeeklyEatsWidget] snapshot saved", {
            requestedDate: payload.snapshotDate, generated: snapshotGeneratedAt,
            mealDate: payload.today.dateKey, mealId: payload.today.mealId,
            weekStartDate: payload.today.weekStartDate, served: payload.todayOutcome ?? "pending",
            timezone: payload.snapshotTimeZone,
          });
        }
        processed = readingRevision;
      }
    })().finally(() => { running = null; });
    return running;
  };
}

const sync = createWidgetSync({ read: readWidgetSource, save: saveTodayWidgetPayload,
  now: () => new Date(), settle: () => new Promise((resolve) => setTimeout(resolve, 100)) });

export const syncWidgetState = () => Platform.OS === "ios" ? sync() : Promise.resolve();

export const repairWidget = () => {
  if (Platform.OS !== "ios") return Promise.reject(new Error("Widget repair is available on iPhone."));
  return sync(true);
};
