import type { Link, PhrasingContent, Root, Text } from "mdast";
import type { Plugin } from "unified";
import { CONTINUE, visit } from "unist-util-visit";

export type MentionableMember = {
  nickname: string;
  serverUserId: string;
};

function buildReplacements(
  value: string,
  sortedMembers: MentionableMember[],
  nicknameToId: Map<string, string>,
): PhrasingContent[] | null {
  const parts: PhrasingContent[] = [];
  let remaining = value;
  let changed = false;

  while (remaining.length > 0) {
    let earliest = -1;
    let matchedLen = 0;
    let matchedNickname: string | null = null;

    for (const m of sortedMembers) {
      const nick = m.nickname;
      const idx = remaining.toLowerCase().indexOf(`@${nick.toLowerCase()}`);
      if (idx === -1) continue;
      if (idx > 0 && /\w/.test(remaining[idx - 1])) continue;
      const afterIdx = idx + 1 + nick.length;
      if (afterIdx < remaining.length && /\w/.test(remaining[afterIdx])) continue;
      if (earliest === -1 || idx < earliest || (idx === earliest && nick.length > matchedLen)) {
        earliest = idx;
        matchedLen = nick.length;
        matchedNickname = nick;
      }
    }

    if (earliest === -1) {
      parts.push({ type: "text", value: remaining } as Text);
      break;
    }

    if (earliest > 0) {
      parts.push({ type: "text", value: remaining.slice(0, earliest) } as Text);
    }

    const original = remaining.slice(earliest + 1, earliest + 1 + matchedLen);
    const id = matchedNickname ? nicknameToId.get(matchedNickname.toLowerCase()) : undefined;
    parts.push({
      type: "link",
      url: id ? `mention:${id}` : "mention:",
      children: [{ type: "text", value: `@${original}` } as Text],
    } as Link);

    changed = true;
    remaining = remaining.slice(earliest + 1 + matchedLen);
  }

  return changed ? parts : null;
}

export function createRemarkMention(members: MentionableMember[]): Plugin<[], Root> {
  const sorted = [...members].sort((a, b) => b.nickname.length - a.nickname.length);
  const nicknameToId = new Map<string, string>();
  for (const m of members) {
    const key = m.nickname.toLowerCase();
    if (!nicknameToId.has(key)) nicknameToId.set(key, m.serverUserId);
  }

  return () => (tree: Root) => {
    if (sorted.length === 0) return;

    visit(tree, "text", (node: Text, index, parent) => {
      if (!parent || index == null) return;
      if (parent.type === "link") return;
      if (!node.value.includes("@")) return;

      const replacements = buildReplacements(node.value, sorted, nicknameToId);
      if (!replacements) return;

      parent.children.splice(index, 1, ...replacements);
      return [CONTINUE, index] as const;
    });
  };
}
