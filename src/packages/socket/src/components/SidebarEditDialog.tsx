import { Dialog, Flex, IconButton, Select, Switch, Text, TextField } from "@radix-ui/themes";
import { MdClose } from "react-icons/md";

import type { SidebarItem } from "@/settings/src/types/server";

interface SidebarEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedSidebarItem: SidebarItem | null;
  sheetChannelName: string;
  setSheetChannelName: (v: string) => void;
  sheetChannelIsVoice: boolean;
  setSheetChannelIsVoice: (v: boolean) => void;
  sheetRequirePtt: boolean;
  setSheetRequirePtt: (v: boolean) => void;
  sheetDisableRnnoise: boolean;
  setSheetDisableRnnoise: (v: boolean) => void;
  sheetMaxBitrate: string;
  setSheetMaxBitrate: (v: string) => void;
  sheetEsportsMode: boolean;
  setSheetEsportsMode: (v: boolean) => void;
  sheetTextInVoice: boolean;
  setSheetTextInVoice: (v: boolean) => void;
  sheetSpacerHeight: string;
  setSheetSpacerHeight: (v: string) => void;
  sheetSeparatorLabel: string;
  setSheetSeparatorLabel: (v: string) => void;
  debouncedSaveSidebar: () => void;
  flushSaveSidebar: () => void;
  closeEditDialog: () => void;
}

export const SidebarEditDialog = ({
  open,
  onOpenChange,
  selectedSidebarItem,
  sheetChannelName, setSheetChannelName,
  sheetChannelIsVoice, setSheetChannelIsVoice,
  sheetRequirePtt, setSheetRequirePtt,
  sheetDisableRnnoise, setSheetDisableRnnoise,
  sheetMaxBitrate, setSheetMaxBitrate,
  sheetEsportsMode, setSheetEsportsMode,
  sheetTextInVoice, setSheetTextInVoice,
  sheetSpacerHeight, setSheetSpacerHeight,
  sheetSeparatorLabel, setSheetSeparatorLabel,
  debouncedSaveSidebar, flushSaveSidebar, closeEditDialog,
}: SidebarEditDialogProps) => (
  <Dialog.Root open={open} onOpenChange={(o) => { if (!o) { flushSaveSidebar(); closeEditDialog(); } else { onOpenChange(o); } }}>
    <Dialog.Content maxWidth="480px">
      <Flex direction="column" gap="4">
        <Flex align="center" justify="between">
          <Dialog.Title as="h2" size="5" weight="bold" style={{ margin: 0 }}>
            {selectedSidebarItem?.kind === "channel" ? "Channel settings"
              : selectedSidebarItem?.kind === "separator" ? "Separator settings"
              : "Spacer settings"}
          </Dialog.Title>
          <Dialog.Close>
            <IconButton variant="soft" color="gray">
              <MdClose size={16} />
            </IconButton>
          </Dialog.Close>
        </Flex>

        {selectedSidebarItem?.kind === "channel" && (
          <>
            <Flex direction="column" gap="2">
              <Text size="2" weight="medium">Name</Text>
              <TextField.Root
                value={sheetChannelName}
                onChange={(e) => setSheetChannelName(e.target.value)}
                onBlur={flushSaveSidebar}
                onKeyDown={(e) => { if (e.key === "Enter") { flushSaveSidebar(); closeEditDialog(); } }}
                placeholder="Channel name"
              />
            </Flex>
            <Flex align="center" justify="between">
              <Text size="2" weight="medium">Voice channel</Text>
              <Switch checked={sheetChannelIsVoice} onCheckedChange={(v) => { setSheetChannelIsVoice(v); debouncedSaveSidebar(); }} />
            </Flex>
            {sheetChannelIsVoice && (
              <>
                <Flex align="center" justify="between">
                  <Flex direction="column" gap="1">
                    <Text size="2" weight="medium">eSports Mode</Text>
                    <Text size="1" color="gray">Lowest latency: PTT, no RNNoise, 128 kbps bitrate, 10ms Opus</Text>
                  </Flex>
                  <Switch checked={sheetEsportsMode} onCheckedChange={(v) => {
                    setSheetEsportsMode(v);
                    if (v) { setSheetRequirePtt(true); setSheetDisableRnnoise(true); }
                    debouncedSaveSidebar();
                  }} />
                </Flex>
                <Flex align="center" justify="between">
                  <Flex direction="column" gap="1">
                    <Text size="2" weight="medium">Require Push to Talk</Text>
                    <Text size="1" color="gray">Users must hold a key to transmit</Text>
                  </Flex>
                  <Switch checked={sheetRequirePtt} onCheckedChange={(v) => { setSheetRequirePtt(v); debouncedSaveSidebar(); }} />
                </Flex>
                <Flex align="center" justify="between">
                  <Flex direction="column" gap="1">
                    <Text size="2" weight="medium">Disable Noise Reduction</Text>
                    <Text size="1" color="gray">Raw audio with no processing for lower latency</Text>
                  </Flex>
                  <Switch checked={sheetDisableRnnoise} disabled={sheetEsportsMode} onCheckedChange={(v) => { setSheetDisableRnnoise(v); debouncedSaveSidebar(); }} />
                </Flex>
                <Flex direction="column" gap="2">
                  <Text size="2" weight="medium">Max Bitrate</Text>
                  <Select.Root
                    value={sheetMaxBitrate || "default"}
                    onValueChange={(v) => { setSheetMaxBitrate(v === "default" ? "" : v); debouncedSaveSidebar(); }}
                  >
                    <Select.Trigger />
                    <Select.Content>
                      <Select.Item value="default">Default</Select.Item>
                      <Select.Separator />
                      <Select.Item value="32000">32 kbps</Select.Item>
                      <Select.Item value="64000">64 kbps</Select.Item>
                      <Select.Item value="96000">96 kbps</Select.Item>
                      <Select.Item value="128000">128 kbps</Select.Item>
                      <Select.Item value="256000">256 kbps</Select.Item>
                      <Select.Item value="510000">510 kbps</Select.Item>
                    </Select.Content>
                  </Select.Root>
                </Flex>
                <Flex align="center" justify="between">
                  <Flex direction="column" gap="1">
                    <Text size="2" weight="medium">Enable Text Chat</Text>
                    <Text size="1" color="gray">Allow text messages in this voice channel</Text>
                  </Flex>
                  <Switch checked={sheetTextInVoice} onCheckedChange={(v) => { setSheetTextInVoice(v); debouncedSaveSidebar(); }} />
                </Flex>
              </>
            )}
          </>
        )}

        {selectedSidebarItem?.kind === "spacer" && (
          <Flex direction="column" gap="2">
            <Text size="2" weight="medium">Height</Text>
            <TextField.Root
              value={sheetSpacerHeight}
              onChange={(e) => setSheetSpacerHeight(e.target.value)}
              onBlur={flushSaveSidebar}
              onKeyDown={(e) => { if (e.key === "Enter") { flushSaveSidebar(); closeEditDialog(); } }}
              placeholder="16"
            />
          </Flex>
        )}

        {selectedSidebarItem?.kind === "separator" && (
          <Flex direction="column" gap="2">
            <Text size="2" weight="medium">Label</Text>
            <TextField.Root
              value={sheetSeparatorLabel}
              onChange={(e) => setSheetSeparatorLabel(e.target.value)}
              onBlur={flushSaveSidebar}
              onKeyDown={(e) => { if (e.key === "Enter") { flushSaveSidebar(); closeEditDialog(); } }}
              placeholder="Optional"
            />
          </Flex>
        )}
      </Flex>
    </Dialog.Content>
  </Dialog.Root>
);
