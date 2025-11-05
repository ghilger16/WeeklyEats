import { useCallback, useEffect, useState } from "react";
import {
  FamilyMemberRecord,
  addFamilyMember,
  getFamilyMembers,
  removeFamilyMember,
  updateFamilyMemberName,
} from "../stores/familyMembersStorage";

export type UseFamilyMembersResult = {
  members: FamilyMemberRecord[];
  isLoading: boolean;
  refresh: () => Promise<void>;
  addMember: (name: string) => Promise<void>;
  removeMember: (id: string) => Promise<void>;
  renameMember: (id: string, name: string) => Promise<void>;
};

export const useFamilyMembers = (): UseFamilyMembersResult => {
  const [members, setMembers] = useState<FamilyMemberRecord[]>([]);
  const [isLoading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const stored = await getFamilyMembers();
    setMembers(stored);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const addMember = useCallback(async (name: string) => {
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

  return {
    members,
    isLoading,
    refresh: load,
    addMember,
    removeMember: removeMemberHandler,
    renameMember: renameMemberHandler,
  };
};
