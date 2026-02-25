import { ContextMenu, Flex } from "@radix-ui/themes";
import React, { type ReactNode } from "react";
import {
  MdCloudDownload,
  MdContentCopy,
  MdDelete,
  MdEdit,
  MdFlag,
  MdImage,
  MdOpenInNew,
  MdReply,
} from "react-icons/md";

import { copyImageToClipboard } from "../utils/mediaClipboard";

interface MessageActions {
  messageText?: string | null;
  onReply?: () => void;
  onEdit?: () => void;
  onReport?: () => void;
  onDelete?: () => void;
  canEdit?: boolean;
  canDelete?: boolean;
}

interface MediaContextMenuProps {
  children: ReactNode;
  src: string;
  fileName?: string | null;
  isImage?: boolean;
  messageActions?: MessageActions;
}

function triggerDownload(url: string, fileName?: string | null) {
  const a = document.createElement("a");
  a.href = url.includes("?") ? `${url}&download=1` : `${url}?download=1`;
  a.download = fileName || "";
  a.rel = "noopener noreferrer";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
  }
}

export function MediaContextMenu({ children, src, fileName, isImage, messageActions }: MediaContextMenuProps) {
  const hasMessageActions = messageActions && (
    messageActions.onReply || messageActions.onEdit || messageActions.onReport || messageActions.onDelete
  );

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger onContextMenu={(e: React.MouseEvent) => e.stopPropagation()}>
        {children}
      </ContextMenu.Trigger>
      <ContextMenu.Content style={{ minWidth: 180 }}>
        {isImage && (
          <ContextMenu.Item onClick={() => copyImageToClipboard(src)}>
            <Flex align="center" gap="1">
              <MdImage size={14} />
              Copy Image
            </Flex>
          </ContextMenu.Item>
        )}
        <ContextMenu.Item onClick={() => triggerDownload(src, fileName)}>
          <Flex align="center" gap="1">
            <MdCloudDownload size={14} />
            Save As
          </Flex>
        </ContextMenu.Item>
        <ContextMenu.Item onClick={() => copyToClipboard(src)}>
          <Flex align="center" gap="1">
            <MdContentCopy size={14} />
            Copy Link
          </Flex>
        </ContextMenu.Item>
        <ContextMenu.Separator />
        <ContextMenu.Item onClick={() => window.open(src, "_blank", "noopener,noreferrer")}>
          <Flex align="center" gap="1">
            <MdOpenInNew size={14} />
            Open in Browser
          </Flex>
        </ContextMenu.Item>

        {hasMessageActions && (
          <>
            <ContextMenu.Separator />
            {messageActions.messageText && (
              <ContextMenu.Item onClick={() => copyToClipboard(messageActions.messageText!)}>
                <Flex align="center" gap="1">
                  <MdContentCopy size={14} />
                  Copy Message
                </Flex>
              </ContextMenu.Item>
            )}
            {messageActions.onReply && (
              <ContextMenu.Item onClick={messageActions.onReply}>
                <Flex align="center" gap="1">
                  <MdReply size={14} />
                  Reply
                </Flex>
              </ContextMenu.Item>
            )}
            {messageActions.canEdit && messageActions.onEdit && (
              <ContextMenu.Item onClick={messageActions.onEdit}>
                <Flex align="center" gap="1">
                  <MdEdit size={14} />
                  Edit Message
                </Flex>
              </ContextMenu.Item>
            )}
            {messageActions.onReport && (
              <ContextMenu.Item onClick={messageActions.onReport} color="red">
                <Flex align="center" gap="1">
                  <MdFlag size={14} />
                  Report
                </Flex>
              </ContextMenu.Item>
            )}
            {messageActions.canDelete && messageActions.onDelete && (
              <ContextMenu.Item onClick={messageActions.onDelete} color="red">
                <Flex align="center" gap="1">
                  <MdDelete size={14} />
                  Delete Message
                </Flex>
              </ContextMenu.Item>
            )}
          </>
        )}
      </ContextMenu.Content>
    </ContextMenu.Root>
  );
}
