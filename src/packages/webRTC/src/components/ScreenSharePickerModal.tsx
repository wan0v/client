import { Badge, Button, Checkbox, Dialog, Flex, IconButton, Select, Text } from "@radix-ui/themes";
import { useCallback, useEffect, useState } from "react";
import { MdClose, MdMonitor, MdScreenShare, MdWindow } from "react-icons/md";

import type { ScreenShareQuality } from "@/audio";

import { type DesktopSource, isElectron } from "../../../../lib/electron";

interface ScreenSharePickerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quality: ScreenShareQuality;
  onQualityChange: (q: ScreenShareQuality) => void;
  onStart: (opts: { sourceId?: string; withAudio: boolean }) => void;
}

const QUALITY_OPTIONS: { value: ScreenShareQuality; label: string }[] = [
  { value: "native", label: "Native" },
  { value: "1080p", label: "1080p" },
  { value: "720p", label: "720p" },
  { value: "480p", label: "480p" },
];

type Tab = "screens" | "windows";

export function ScreenSharePickerModal({ open, onOpenChange, quality, onQualityChange, onStart }: ScreenSharePickerModalProps) {
  const [sources, setSources] = useState<DesktopSource[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<Tab>("screens");
  const [selected, setSelected] = useState<string | null>(null);
  const [includeAudio, setIncludeAudio] = useState(true);
  const inElectron = isElectron();

  const loadSources = useCallback(async () => {
    if (!inElectron) return;
    const api = window.electronAPI;
    if (!api) return;
    setLoading(true);
    try {
      const s = await api.getDesktopSources();
      setSources(s);
      if (s.length > 0 && !selected) {
        const screens = s.filter((x) => x.sourceType === "screen");
        setSelected(screens[0]?.id ?? s[0].id);
      }
    } finally {
      setLoading(false);
    }
  }, [inElectron, selected]);

  useEffect(() => {
    if (open && inElectron) {
      loadSources();
    }
    if (!open) {
      setSelected(null);
      setSources([]);
    }
  }, [open, inElectron, loadSources]);

  useEffect(() => {
    if (!open || !inElectron) return;
    const interval = setInterval(loadSources, 3000);
    return () => clearInterval(interval);
  }, [open, inElectron, loadSources]);

  const filteredSources = sources.filter((s) =>
    tab === "screens" ? s.sourceType === "screen" : s.sourceType === "window",
  );

  const handleShare = () => {
    onStart({ sourceId: selected ?? undefined, withAudio: includeAudio });
    onOpenChange(false);
  };

  if (!inElectron) {
    if (open) {
      onStart({ withAudio: includeAudio });
      onOpenChange(false);
    }
    return null;
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content style={{ maxWidth: 640 }}>
        <Flex direction="column" gap="4">
          <Flex align="center" justify="between">
            <Flex align="center" gap="2">
              <MdScreenShare size={16} />
              <Dialog.Title>Share your screen</Dialog.Title>
            </Flex>
            <Dialog.Close>
              <IconButton variant="ghost" color="gray" onClick={() => onOpenChange(false)}>
                <MdClose size={16} />
              </IconButton>
            </Dialog.Close>
          </Flex>

          <Flex gap="2">
            <Button
              variant={tab === "screens" ? "solid" : "soft"}
              color={tab === "screens" ? undefined : "gray"}
              size="1"
              onClick={() => setTab("screens")}
            >
              <MdMonitor size={14} />
              Screens
            </Button>
            <Button
              variant={tab === "windows" ? "solid" : "soft"}
              color={tab === "windows" ? undefined : "gray"}
              size="1"
              onClick={() => setTab("windows")}
            >
              <MdWindow size={14} />
              Windows
            </Button>
          </Flex>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
              gap: 8,
              maxHeight: 320,
              overflow: "auto",
            }}
          >
            {loading && sources.length === 0 && (
              <Text size="2" color="gray" style={{ gridColumn: "1 / -1", textAlign: "center", padding: 24 }}>
                Loading sources...
              </Text>
            )}
            {!loading && filteredSources.length === 0 && (
              <Text size="2" color="gray" style={{ gridColumn: "1 / -1", textAlign: "center", padding: 24 }}>
                No {tab === "screens" ? "screens" : "windows"} found
              </Text>
            )}
            {filteredSources.map((src) => (
              <Flex
                key={src.id}
                direction="column"
                gap="1"
                onClick={() => setSelected(src.id)}
                style={{
                  cursor: "pointer",
                  borderRadius: "var(--radius-3)",
                  border: selected === src.id ? "2px solid var(--accent-9)" : "2px solid transparent",
                  padding: 4,
                  background: selected === src.id ? "var(--accent-3)" : "var(--gray-3)",
                  transition: "border-color 0.15s, background 0.15s",
                }}
              >
                <div style={{ position: "relative", aspectRatio: "16 / 9", borderRadius: "var(--radius-2)", overflow: "hidden", background: "#000" }}>
                  {src.thumbnail ? (
                    <img
                      src={src.thumbnail}
                      alt={src.name}
                      style={{ width: "100%", height: "100%", objectFit: "contain" }}
                      draggable={false}
                    />
                  ) : (
                    <Flex align="center" justify="center" style={{ width: "100%", height: "100%" }}>
                      {src.sourceType === "screen" ? <MdMonitor size={24} /> : <MdWindow size={24} />}
                    </Flex>
                  )}
                  {selected === src.id && (
                    <Badge
                      color="blue"
                      variant="solid"
                      size="1"
                      style={{ position: "absolute", top: 4, right: 4 }}
                    >
                      Selected
                    </Badge>
                  )}
                </div>
                <Flex align="center" gap="1" px="1">
                  {src.appIcon && src.sourceType === "window" && (
                    <img src={src.appIcon} alt="" style={{ width: 14, height: 14 }} draggable={false} />
                  )}
                  <Text size="1" truncate style={{ flex: 1 }}>
                    {src.name}
                  </Text>
                </Flex>
              </Flex>
            ))}
          </div>

          <Flex align="center" gap="4">
            <Text as="label" size="2" style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
              <Checkbox size="1" checked={includeAudio} onCheckedChange={(v) => setIncludeAudio(v === true)} />
              Include audio
            </Text>

            <Flex align="center" gap="2" ml="auto">
              <Text size="2">Quality</Text>
              <Select.Root value={quality} onValueChange={(v) => onQualityChange(v as ScreenShareQuality)}>
                <Select.Trigger variant="soft" />
                <Select.Content>
                  {QUALITY_OPTIONS.map((o) => (
                    <Select.Item key={o.value} value={o.value}>{o.label}</Select.Item>
                  ))}
                </Select.Content>
              </Select.Root>
            </Flex>
          </Flex>

          <Flex justify="end" gap="2">
            <Button variant="soft" color="gray" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleShare} disabled={inElectron && !selected}>
              Share
            </Button>
          </Flex>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}
