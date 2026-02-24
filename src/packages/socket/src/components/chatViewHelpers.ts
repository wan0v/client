import type { ChatMessage } from "./chatUtils";
import { toDate } from "./chatUtils";
import type { MessageMeta } from "./MessageRow";

export const GROUP_GAP_MS = 5 * 60 * 1000;

export function getAttachmentPreview(msg: ChatMessage): string {
  const enriched = msg.enriched_attachments;
  if (enriched && enriched.length > 0) {
    const names = enriched.map((a) => a.original_name).filter(Boolean) as string[];
    if (names.length > 0) return names.join(", ");
  }
  return "Attachment";
}

export function getReplyPreview(msg: ChatMessage | null | undefined, maxLen: number): string {
  if (!msg) return "Original message";
  if (msg.text) return msg.text.length > maxLen ? msg.text.slice(0, maxLen) + "..." : msg.text;
  return getAttachmentPreview(msg);
}

export function buildMessageMetadata(
  chatMessages: ChatMessage[],
  newMessageMarkerId: string | null,
  currentUserId: string | undefined,
  currentUserNickname: string | undefined,
  getSenderName: (msg: ChatMessage) => string,
  getSenderAvatarUrl: (msg: ChatMessage) => string | undefined,
): MessageMeta[] {
  let lastDay: string | null = null;
  return chatMessages.map((m, i): MessageMeta => {
    const prev = i > 0 ? chatMessages[i - 1] : null;
    const d = toDate(m.created_at);
    const dayKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    const needsDayBreak = dayKey !== lastDay;
    lastDay = dayKey;

    const timeSincePrev = prev ? d.getTime() - toDate(prev.created_at).getTime() : Infinity;
    const isFirstInGroup =
      !prev || prev.sender_server_id !== m.sender_server_id || timeSincePrev > GROUP_GAP_MS || needsDayBreak;

    const showNewMessageDivider = !!(newMessageMarkerId && prev && prev.message_id === newMessageMarkerId);

    const isSelf = !!currentUserId && m.sender_server_id === currentUserId;
    const senderName = isSelf ? (currentUserNickname || "You") : getSenderName(m);
    const avatarUrl = getSenderAvatarUrl(m);
    const isFirstEdited = isFirstInGroup && !!m.edited_at;

    return {
      isFirstInGroup,
      dayBreak: needsDayBreak ? d : null,
      showNewMessageDivider,
      senderName,
      avatarUrl,
      isSelf,
      isFirstEdited,
    };
  });
}

export function buildMessageMap(chatMessages: ChatMessage[]): Map<string, ChatMessage> {
  const map = new Map<string, ChatMessage>();
  for (const m of chatMessages) map.set(m.message_id, m);
  return map;
}
