import { FamilyMemberRecord } from "../stores/familyMembersStorage";

const sanitizeName = (name: string): string =>
  name.trim().replace(/\s+/g, " ");

const uniqueCandidates = (values: string[]): string[] => {
  const seen = new Set<string>();
  return values
    .map((value) => value.toUpperCase())
    .filter((value) => {
      if (!value) {
        return false;
      }
      const cleaned = value.slice(0, 2);
      if (seen.has(cleaned)) {
        return false;
      }
      seen.add(cleaned);
      return true;
    });
};

const buildCandidatesForSingleWord = (word: string): string[] => {
  const letters = word.toUpperCase();
  const attempts: string[] = [];
  if (!letters) {
    return attempts;
  }
  attempts.push(letters[0]!);
  if (letters.length >= 2) {
    attempts.push(letters.slice(0, 2));
  }
  for (let i = 1; i < letters.length; i += 1) {
    attempts.push(`${letters[0]!}${letters[i]!}`);
  }
  attempts.push(`${letters[0]!}.`);
  attempts.push(`${letters[0]!}²`);
  return uniqueCandidates(attempts);
};

const buildCandidatesForMultiWord = (parts: string[]): string[] => {
  const upperParts = parts.map((part) => part.toUpperCase());
  const first = upperParts[0] ?? "";
  const last = upperParts[upperParts.length - 1] ?? "";
  const attempts: string[] = [];
  if (first && last) {
    attempts.push(`${first[0] ?? ""}${last[0] ?? ""}`);
  }
  if (first.length >= 2) {
    attempts.push(first.slice(0, 2));
  }
  if (last.length >= 2) {
    attempts.push(last.slice(0, 2));
  }
  for (let i = 1; i < first.length; i += 1) {
    attempts.push(`${first[0] ?? ""}${first[i] ?? ""}`);
  }
  for (let i = 1; i < last.length; i += 1) {
    attempts.push(`${first[0] ?? ""}${last[i] ?? ""}`);
  }
  if (upperParts.length > 2) {
    for (let i = 1; i < upperParts.length - 1; i += 1) {
      const segment = upperParts[i];
      if (segment) {
        attempts.push(`${first[0] ?? ""}${segment[0] ?? ""}`);
      }
    }
  }
  attempts.push(`${first[0] ?? ""}.`);
  attempts.push(`${first[0] ?? ""}²`);
  return uniqueCandidates(attempts);
};

const fallbackInitial = (
  prefix: string,
  used: Set<string>
): string => {
  let counter = 2;
  const upperPrefix = prefix.toUpperCase() || "M";
  while (counter < 100) {
    const candidate = `${upperPrefix}${counter}`;
    if (!used.has(candidate)) {
      return candidate;
    }
    counter += 1;
  }
  return `${upperPrefix}${Math.random().toString(36).slice(2, 4)}`.toUpperCase();
};

export const deriveFamilyInitials = (
  members: FamilyMemberRecord[]
): Record<string, string> => {
  const used = new Set<string>();
  const result: Record<string, string> = {};

  members.forEach((member) => {
    const cleanName = sanitizeName(member.name);
    if (!cleanName) {
      const fallback = fallbackInitial("M", used);
      used.add(fallback);
      result[member.id] = fallback;
      return;
    }
    const parts = cleanName.split(" ");
    const candidates =
      parts.length === 1
        ? buildCandidatesForSingleWord(parts[0]!)
        : buildCandidatesForMultiWord(parts);

    let chosen = candidates.find((candidate) => !used.has(candidate));
    if (!chosen) {
      chosen = fallbackInitial(parts[0]?.[0] ?? "M", used);
    }
    used.add(chosen);
    result[member.id] = chosen;
  });

  return result;
};
