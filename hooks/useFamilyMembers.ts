import { useContext } from "react";
import { FamilyMembersContext } from "../providers/family-members/FamilyMembersProvider";

export const useFamilyMembers = () => {
  const context = useContext(FamilyMembersContext);
  if (!context) {
    throw new Error(
      "useFamilyMembers must be used within a FamilyMembersProvider"
    );
  }
  return context;
};
