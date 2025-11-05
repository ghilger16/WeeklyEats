import AsyncStorage from "@react-native-async-storage/async-storage";

export type FamilyMemberRecord = {
  id: string;
  name: string;
};

const STORAGE_KEY = "@weeklyeats/familyMembers";

const parseMembers = (raw: string | null): FamilyMemberRecord[] => {
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .map((item) => {
        if (!item || typeof item !== "object") {
          return null;
        }
        const id = (item as { id?: unknown }).id;
        const name = (item as { name?: unknown }).name;
        if (typeof id !== "string" || typeof name !== "string") {
          return null;
        }
        return {
          id,
          name,
        };
      })
      .filter((member): member is FamilyMemberRecord => Boolean(member));
  } catch (error) {
    console.warn("[familyMembersStorage] Failed to parse members", error);
    return [];
  }
};

const serializeMembers = (members: FamilyMemberRecord[]): string => {
  try {
    return JSON.stringify(members);
  } catch (error) {
    console.warn("[familyMembersStorage] Failed to serialize members", error);
    return "[]";
  }
};

export const getFamilyMembers = async (): Promise<FamilyMemberRecord[]> => {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return parseMembers(raw);
  } catch (error) {
    console.warn("[familyMembersStorage] Failed to read members", error);
    return [];
  }
};

export const setFamilyMembers = async (
  members: FamilyMemberRecord[]
): Promise<void> => {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, serializeMembers(members));
  } catch (error) {
    console.warn("[familyMembersStorage] Failed to write members", error);
  }
};

export const addFamilyMember = async (
  name: string
): Promise<FamilyMemberRecord[]> => {
  const trimmed = name.trim();
  if (!trimmed) {
    return getFamilyMembers();
  }

  const existing = await getFamilyMembers();
  const next: FamilyMemberRecord[] = [
    {
      id: `member-${Date.now().toString(36)}-${Math.random()
        .toString(36)
        .slice(2, 8)}`,
      name: trimmed,
    },
    ...existing,
  ];
  await setFamilyMembers(next);
  return next;
};

export const removeFamilyMember = async (
  id: string
): Promise<FamilyMemberRecord[]> => {
  const existing = await getFamilyMembers();
  const next = existing.filter((member) => member.id !== id);
  await setFamilyMembers(next);
  return next;
};

export const updateFamilyMemberName = async (
  id: string,
  name: string
): Promise<FamilyMemberRecord[]> => {
  const trimmed = name.trim();
  if (!trimmed) {
    return removeFamilyMember(id);
  }
  const existing = await getFamilyMembers();
  const next = existing.map((member) =>
    member.id === id ? { ...member, name: trimmed } : member
  );
  await setFamilyMembers(next);
  return next;
};

export const familyMembersStorageKey = STORAGE_KEY;
