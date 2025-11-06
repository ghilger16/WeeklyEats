import {
  PropsWithChildren,
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  FamilyMemberRecord,
  addFamilyMember,
  getFamilyMembers,
  removeFamilyMember,
  updateFamilyMemberName,
} from "../../stores/familyMembersStorage";

type FamilyMembersContextValue = {
  members: FamilyMemberRecord[];
  isLoading: boolean;
  refresh: () => Promise<void>;
  addMember: (name: string) => Promise<void>;
  removeMember: (id: string) => Promise<void>;
  renameMember: (id: string, name: string) => Promise<void>;
};

export const FamilyMembersContext =
  createContext<FamilyMembersContextValue | null>(null);

export function FamilyMembersProvider({ children }: PropsWithChildren) {
  const [members, setMembers] = useState<FamilyMemberRecord[]>([]);
  const [isLoading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const stored = await getFamilyMembers();
    setMembers(stored);
    setLoading(false);
  }, []);

  const addMemberHandler = useCallback(async (name: string) => {
    const next = await addFamilyMember(name);
    setMembers(next);
  }, []);

  const removeMemberHandler = useCallback(async (id: string) => {
    const next = await removeFamilyMember(id);
    setMembers(next);
  }, []);

  const renameMemberHandler = useCallback(async (id: string, name: string) => {
    const next = await updateFamilyMemberName(id, name);
    setMembers(next);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const value = useMemo<FamilyMembersContextValue>(
    () => ({
      members,
      isLoading,
      refresh: load,
      addMember: addMemberHandler,
      removeMember: removeMemberHandler,
      renameMember: renameMemberHandler,
    }),
    [addMemberHandler, isLoading, load, members, removeMemberHandler, renameMemberHandler]
  );

  return (
    <FamilyMembersContext.Provider value={value}>
      {children}
    </FamilyMembersContext.Provider>
  );
}
