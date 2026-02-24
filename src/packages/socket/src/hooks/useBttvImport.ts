import { useCallback, useMemo, useState } from "react";
import toast from "react-hot-toast";

import { getServerAccessToken, getServerHttpBase } from "@/common";

import {
  BTTV_EMOTE_URL_RE,
  BTTV_USER_URL_RE,
  type BttvEmote,
  type BttvEmoteWithMeta,
  downloadAsFileWithProgress,
  sanitizeName,
  validateName,
} from "../utils/bttvImportUtils";
import { stageEmojiViaXhr } from "../utils/stageEmojiViaXhr";
import { getFreshServerAccessToken, type TokenRefreshSocketLike } from "../utils/tokenManager";

interface UseBttvImportParams {
  host: string;
  accessToken: string | null;
  socket: TokenRefreshSocketLike | null;
  existingNames: Set<string>;
}

export function useBttvImport({
  host,
  accessToken,
  socket,
  existingNames,
}: UseBttvImportParams) {
  const [url, setUrl] = useState("");
  const [fetching, setFetching] = useState(false);
  const [importing, setImporting] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [emotes, setEmotes] = useState<BttvEmoteWithMeta[]>([]);
  const [filterText, setFilterText] = useState("");

  const effectiveAccessToken = useMemo(
    () => accessToken || getServerAccessToken(host),
    [accessToken, host],
  );
  const base = useMemo(() => getServerHttpBase(host), [host]);

  const selectedEmotes = useMemo(
    () => emotes.filter((e) => e.selected),
    [emotes],
  );

  const validSelectedCount = useMemo(
    () => selectedEmotes.filter((e) => !e.nameError).length,
    [selectedEmotes],
  );

  const filteredEmotes = useMemo(() => {
    if (!filterText) return emotes;
    const lower = filterText.toLowerCase();
    return emotes.filter(
      (e) =>
        e.code.toLowerCase().includes(lower) ||
        e.name.toLowerCase().includes(lower),
    );
  }, [emotes, filterText]);

  const revalidateAll = useCallback(
    (items: BttvEmoteWithMeta[]): BttvEmoteWithMeta[] => {
      const selectedNames = items
        .filter((e) => e.selected)
        .map((e) => e.name);
      return items.map((e) => {
        if (!e.selected) return { ...e, nameError: null, nameWarning: null };
        const idx = selectedNames.indexOf(e.name);
        const { error, warning } = validateName(e.name, existingNames, selectedNames, idx);
        return { ...e, nameError: error, nameWarning: warning };
      });
    },
    [existingNames],
  );

  const handleFetch = useCallback(async () => {
    const trimmed = url.trim();
    const userMatch = trimmed.match(BTTV_USER_URL_RE);
    const emoteMatch = trimmed.match(BTTV_EMOTE_URL_RE);
    if (!userMatch && !emoteMatch) {
      toast.error("Invalid BetterTTV URL. Expected: https://betterttv.com/users/... or https://betterttv.com/emotes/...");
      return;
    }

    setFetching(true);
    try {
      if (emoteMatch) {
        const emoteId = emoteMatch[1];
        const resp = await fetch(`${base}/api/emojis/bttv/emote/${emoteId}`);
        if (!resp.ok) {
          const data = await resp.json().catch(() => ({}));
          throw new Error(
            (typeof data?.message === "string" && data.message) ||
              `Failed to fetch (${resp.status})`,
          );
        }
        const data: unknown = await resp.json();
        const root = (data && typeof data === "object") ? (data as Record<string, unknown>) : {};
        const emoteRaw = (root.emote && typeof root.emote === "object") ? (root.emote as Record<string, unknown>) : null;
        const id = typeof emoteRaw?.id === "string" ? emoteRaw.id : emoteId;
        const code = typeof emoteRaw?.code === "string" ? emoteRaw.code : "";
        const imageType = typeof emoteRaw?.imageType === "string" ? emoteRaw.imageType : "png";
        const animated = typeof emoteRaw?.animated === "boolean" ? emoteRaw.animated : imageType.toLowerCase() === "gif";
        if (!code) throw new Error("BetterTTV returned an invalid emote payload.");

        const withMeta: BttvEmoteWithMeta[] = [
          {
            id,
            code,
            imageType,
            animated,
            selected: true,
            name: sanitizeName(code),
            nameError: null,
            nameWarning: null,
            status: "idle",
            progress: 0,
            lastError: null,
          },
        ];
        const validated = revalidateAll(withMeta);
        setEmotes(validated);
        setUsername("Single emote");
        toast.success("Found 1 emote");
      } else if (userMatch) {
        const userId = userMatch[1];
        const resp = await fetch(`${base}/api/emojis/bttv/user/${userId}`);
        if (!resp.ok) {
          const data = await resp.json().catch(() => ({}));
          throw new Error(
            (typeof data?.message === "string" && data.message) ||
              `Failed to fetch (${resp.status})`,
          );
        }
        const data = await resp.json();
        const all: BttvEmote[] = [
          ...(data.channelEmotes || []),
          ...(data.sharedEmotes || []),
        ];
        if (all.length === 0) {
          toast.error("No emotes found for this user.");
          setFetching(false);
          return;
        }
        const withMeta: BttvEmoteWithMeta[] = all.map((e) => ({
          ...e,
          selected: true,
          name: sanitizeName(e.code),
          nameError: null,
          nameWarning: null,
          status: "idle",
          progress: 0,
          lastError: null,
        }));
        const validated = revalidateAll(withMeta);
        setEmotes(validated);
        setUsername(data.username || null);
        toast.success(`Found ${all.length} emote(s)`);
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to fetch BetterTTV emotes.",
      );
    } finally {
      setFetching(false);
    }
  }, [url, base, revalidateAll]);

  const toggleSelect = useCallback(
    (id: string) => {
      setEmotes((prev) => {
        const updated = prev.map((e) =>
          e.id === id ? { ...e, selected: !e.selected } : e,
        );
        return revalidateAll(updated);
      });
    },
    [revalidateAll],
  );

  const toggleAll = useCallback(
    (selected: boolean) => {
      setEmotes((prev) => {
        const updated = prev.map((e) => ({ ...e, selected }));
        return revalidateAll(updated);
      });
    },
    [revalidateAll],
  );

  const updateName = useCallback(
    (id: string, newName: string) => {
      const sanitized = newName.replace(/[^A-Za-z0-9_]/g, "");
      setEmotes((prev) => {
        const updated = prev.map((e) =>
          e.id === id ? { ...e, name: sanitized } : e,
        );
        return revalidateAll(updated);
      });
    },
    [revalidateAll],
  );

  const handleImport = useCallback(async () => {
    const toImportRaw = selectedEmotes.filter((e) => !e.nameError);
    if (toImportRaw.length === 0) return;
    if (!effectiveAccessToken) {
      toast.error("Not authenticated. Join the server first.");
      return;
    }

    const byName = new Map<string, BttvEmoteWithMeta>();
    for (const e of toImportRaw) {
      if (byName.has(e.name)) byName.delete(e.name);
      byName.set(e.name, e);
    }
    const toImport = Array.from(byName.values());
    if (toImport.length !== toImportRaw.length) {
      toast(`Duplicate emoji IDs detected — importing ${toImport.length}/${toImportRaw.length} (last wins).`);
    }

    setImporting(true);
    try {
      let successCount = 0;

      const importOne = async (emote: BttvEmoteWithMeta) => {
        setEmotes((prev) => prev.map((e) => (
          e.id === emote.id
            ? { ...e, status: "downloading", progress: 0, lastError: null }
            : e
        )));

        try {
          const fallbackMime =
            emote.imageType === "gif" ? "image/gif"
              : emote.imageType === "webp" ? "image/webp"
              : "image/png";
          const file = await downloadAsFileWithProgress({
            url: `${base}/api/emojis/bttv/file/${emote.id}`,
            name: emote.name,
            fallbackMime,
            onProgress: (pct) => {
              setEmotes((prev) => prev.map((e) => (
                e.id === emote.id
                  ? { ...e, status: "downloading", progress: pct, lastError: null }
                  : e
              )));
            },
          });

          setEmotes((prev) => prev.map((e) => (
            e.id === emote.id
              ? { ...e, status: "uploading", progress: 0, lastError: null }
              : e
          )));

          const token = await getFreshServerAccessToken(host, socket);
          if (!token) throw new Error("Not authenticated. Join the server first.");

          let result = await stageEmojiViaXhr({
            base,
            accessToken: token,
            file,
            name: emote.name,
            onProgress: (pct) => {
              setEmotes((prev) => prev.map((e) => (
                e.id === emote.id
                  ? { ...e, status: "uploading", progress: pct }
                  : e
              )));
            },
            onUploadFinished: () => {
              setEmotes((prev) => prev.map((e) => (
                e.id === emote.id && e.status === "uploading"
                  ? { ...e, status: "processing", progress: 100 }
                  : e
              )));
            },
          });

          if (!result.ok && result.status === 401 && (result.error === "token_invalid" || result.error === "token_stale")) {
            const refreshed = await getFreshServerAccessToken(host, socket, { force: true });
            if (refreshed) {
              result = await stageEmojiViaXhr({
                base,
                accessToken: refreshed,
                file,
                name: emote.name,
                onProgress: (pct) => {
                  setEmotes((prev) => prev.map((e) => (
                    e.id === emote.id
                      ? { ...e, status: "uploading", progress: pct }
                      : e
                  )));
                },
                onUploadFinished: () => {
                  setEmotes((prev) => prev.map((e) => (
                    e.id === emote.id && e.status === "uploading"
                      ? { ...e, status: "processing", progress: 100 }
                      : e
                  )));
                },
              });
            }
          }

          if (result.ok) {
            successCount++;
            toast.success(`:${emote.name}: queued for processing.`);
            setEmotes((prev) => prev.filter((e) => e.id !== emote.id));
          } else {
          toast.error(`:${emote.name}: — ${result.message}`);
            setEmotes((prev) => prev.map((e) => (
              e.id === emote.id
                ? { ...e, status: "error", progress: 0, lastError: result.message }
                : e
            )));
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Import failed.";
          toast.error(`:${emote.name}: — ${msg}`);
          setEmotes((prev) => prev.map((e) => (
            e.id === emote.id
              ? { ...e, status: "error", progress: 0, lastError: msg }
              : e
          )));
        }
      };

      const concurrencyLimit = Math.min(3, toImport.length);
      let nextIndex = 0;
      const worker = async () => {
        while (nextIndex < toImport.length) {
          const i = nextIndex;
          nextIndex++;
          const emote = toImport[i];
          if (!emote) break;
          await importOne(emote);
        }
      };

      await Promise.all(Array.from({ length: concurrencyLimit }, worker));

      if (successCount > 0) {
        toast.success(`Imported ${successCount} emoji(s)!`);
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Import failed.",
      );
    } finally {
      setImporting(false);
    }
  }, [selectedEmotes, base, effectiveAccessToken, host, socket]);

  const handleClear = useCallback(() => {
    setEmotes([]);
    setUsername(null);
    setUrl("");
    setFilterText("");
  }, []);

  return {
    url,
    setUrl,
    fetching,
    importing,
    username,
    emotes,
    filterText,
    setFilterText,
    selectedEmotes,
    validSelectedCount,
    filteredEmotes,
    handleFetch,
    toggleSelect,
    toggleAll,
    updateName,
    handleImport,
    handleClear,
  };
}
