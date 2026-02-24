import { Flex } from "@radix-ui/themes";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { MdClose } from "react-icons/md";

import { getServerAccessToken, getServerHttpBase } from "@/common";

import { SkeletonBase } from "./skeletons/SkeletonBase";

const URL_REGEX = /https?:\/\/[^\s<>[\](){}'"`,]+[^\s<>[\](){}'"`,.:;!?)]/gi;

const IMAGE_EXT = /\.(jpe?g|png|gif|webp|svg|bmp|avif)(\?[^\s]*)?$/i;
const VIDEO_EXT = /\.(mp4|webm|mov|ogv)(\?[^\s]*)?$/i;
const AUDIO_EXT = /\.(mp3|wav|ogg|flac|aac|m4a|opus)(\?[^\s]*)?$/i;

interface LinkPreviewData {
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
  siteName: string | null;
  favicon: string | null;
}

type EmbedType = "image" | "video" | "audio" | "link";

function getEmbedType(url: string): EmbedType {
  if (IMAGE_EXT.test(url)) return "image";
  if (VIDEO_EXT.test(url)) return "video";
  if (AUDIO_EXT.test(url)) return "audio";
  return "link";
}

function extractUrls(text: string | null): string[] {
  if (!text) return [];
  let cleaned = text.replace(/```[\s\S]*?```/g, "");
  cleaned = cleaned.replace(/`[^`]+`/g, "");
  cleaned = cleaned.replace(/!\[[^\]]*\]\([^)]+\)/g, "");
  const matches = cleaned.match(URL_REGEX);
  if (!matches) return [];
  return [...new Set(matches)];
}

const DISMISSED_KEY = "gryt:dismissed-embeds";

function getDismissedEmbeds(): Set<string> {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function dismissEmbed(messageId: string, url: string): void {
  const dismissed = getDismissedEmbeds();
  dismissed.add(`${messageId}:${url}`);
  const arr = [...dismissed];
  if (arr.length > 1000) arr.splice(0, arr.length - 1000);
  localStorage.setItem(DISMISSED_KEY, JSON.stringify(arr));
}

function isEmbedDismissed(messageId: string, url: string): boolean {
  return getDismissedEmbeds().has(`${messageId}:${url}`);
}

const DismissButton = ({ onDismiss }: { onDismiss: () => void }) => (
  <button
    className="link-embed-dismiss"
    onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDismiss(); }}
    title="Remove embed"
  >
    <MdClose size={14} />
  </button>
);

const imageEmbedSizeCache = new Map<string, { width: number; height: number }>();

const ImageEmbed = ({ url, onDismiss }: { url: string; onDismiss: () => void }) => {
  const cached = imageEmbedSizeCache.get(url);
  return (
    <div className="link-embed-container">
      <DismissButton onDismiss={onDismiss} />
      <img
        src={url}
        alt="Embedded image"
        className="link-embed-image"
        width={cached?.width}
        height={cached?.height}
        loading="lazy"
        decoding="async"
        onLoad={(e) => {
          const img = e.currentTarget;
          if (img.naturalWidth > 0 && img.naturalHeight > 0) {
            imageEmbedSizeCache.set(url, { width: img.naturalWidth, height: img.naturalHeight });
          }
        }}
        onClick={() => window.open(url, "_blank")}
      />
    </div>
  );
};

const VideoEmbed = ({ url, onDismiss }: { url: string; onDismiss: () => void }) => (
  <div className="link-embed-container">
    <DismissButton onDismiss={onDismiss} />
    <video src={url} controls className="link-embed-video" preload="metadata" />
  </div>
);

const AudioEmbed = ({ url, onDismiss }: { url: string; onDismiss: () => void }) => (
  <div className="link-embed-container link-embed-audio-wrap">
    <DismissButton onDismiss={onDismiss} />
    <audio src={url} controls className="link-embed-audio" preload="metadata" />
  </div>
);

const previewCache = new Map<string, LinkPreviewData>();

const LinkPreviewSkeleton = memo(({ url, onDismiss }: { url: string; onDismiss: () => void }) => {
  const hostname = (() => {
    try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
  })();

  return (
    <div className="link-embed-container">
      <DismissButton onDismiss={onDismiss} />
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="link-embed-card"
        aria-busy="true"
      >
        <div className="link-embed-card-accent" />
        <div className="link-embed-card-inner">
          <div className="link-embed-card-body">
            <div className="link-embed-card-site">
              <SkeletonBase width={16} height={16} borderRadius="2px" />
              <span className="link-embed-card-hostname">{hostname}</span>
            </div>
            <SkeletonBase width="70%" height={14} borderRadius="var(--radius-2)" />
            <SkeletonBase width="55%" height={14} borderRadius="var(--radius-2)" />
            <SkeletonBase width="90%" height={12} borderRadius="var(--radius-2)" />
            <SkeletonBase width="75%" height={12} borderRadius="var(--radius-2)" />
          </div>
          <div className="link-embed-card-image-wrap">
            <SkeletonBase width="100%" height="100%" borderRadius="0" />
          </div>
        </div>
      </a>
    </div>
  );
});

LinkPreviewSkeleton.displayName = "LinkPreviewSkeleton";

const LinkPreviewCard = memo(({
  url,
  serverHost,
  onDismiss,
}: {
  url: string;
  serverHost: string;
  onDismiss: () => void;
}) => {
  const [data, setData] = useState<LinkPreviewData | null>(() => previewCache.get(url) ?? null);
  const [failed, setFailed] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [url, data?.image]);

  useEffect(() => {
    if (data) return;
    let cancelled = false;
    const accessToken = getServerAccessToken(serverHost);
    if (!accessToken) { setFailed(true); return; }

    const base = getServerHttpBase(serverHost);
    fetch(`${base}/api/link-preview?url=${encodeURIComponent(url)}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error("fetch failed");
        return res.json();
      })
      .then((d: LinkPreviewData) => {
        if (cancelled) return;
        previewCache.set(url, d);
        setData(d);
      })
      .catch(() => { if (!cancelled) setFailed(true); });

    return () => { cancelled = true; };
  }, [url, serverHost, data]);

  if (failed) return null;
  if (!data) return <LinkPreviewSkeleton url={url} onDismiss={onDismiss} />;

  const hostname = (() => {
    try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
  })();

  return (
    <div className="link-embed-container">
      <DismissButton onDismiss={onDismiss} />
      <a href={url} target="_blank" rel="noopener noreferrer" className="link-embed-card">
        <div className="link-embed-card-accent" />
        <div className="link-embed-card-inner">
          <div className="link-embed-card-body">
            <div className="link-embed-card-site">
              {data.favicon && (
                <img
                  src={data.favicon}
                  alt=""
                  className="link-embed-card-favicon"
                  loading="lazy"
                  decoding="async"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              )}
              <span className="link-embed-card-hostname">
                {data.siteName || hostname}
              </span>
            </div>
            {data.title && (
              <div className="link-embed-card-title">{data.title}</div>
            )}
            {data.description && (
              <div className="link-embed-card-description">
                {data.description.length > 200 ? data.description.slice(0, 200) + "\u2026" : data.description}
              </div>
            )}
          </div>
          <div className="link-embed-card-image-wrap">
            {data.image && !imageFailed ? (
              <img
                src={data.image}
                alt={data.title || "Preview"}
                className="link-embed-card-image"
                loading="lazy"
                decoding="async"
                onError={() => setImageFailed(true)}
              />
            ) : (
              <div className="link-embed-card-image-placeholder" />
            )}
          </div>
        </div>
      </a>
    </div>
  );
});

LinkPreviewCard.displayName = "LinkPreviewCard";

export const MessageEmbeds = memo(({
  messageId,
  text,
  serverHost,
}: {
  messageId: string;
  text: string | null;
  serverHost: string;
}) => {
  const urls = useMemo(() => extractUrls(text), [text]);

  const [dismissed, setDismissed] = useState<Set<string>>(() => {
    const set = new Set<string>();
    for (const u of urls) {
      if (isEmbedDismissed(messageId, u)) set.add(u);
    }
    return set;
  });

  const handleDismiss = useCallback((url: string) => {
    dismissEmbed(messageId, url);
    setDismissed((prev) => new Set(prev).add(url));
  }, [messageId]);

  const visibleUrls = useMemo(() => urls.filter((u) => !dismissed.has(u)), [urls, dismissed]);

  if (visibleUrls.length === 0) return null;

  return (
    <Flex direction="column" gap="2" style={{ marginTop: "4px" }}>
      {visibleUrls.map((url) => {
        const type = getEmbedType(url);
        switch (type) {
          case "image":
            return <ImageEmbed key={url} url={url} onDismiss={() => handleDismiss(url)} />;
          case "video":
            return <VideoEmbed key={url} url={url} onDismiss={() => handleDismiss(url)} />;
          case "audio":
            return <AudioEmbed key={url} url={url} onDismiss={() => handleDismiss(url)} />;
          case "link":
            return <LinkPreviewCard key={url} url={url} serverHost={serverHost} onDismiss={() => handleDismiss(url)} />;
        }
      })}
    </Flex>
  );
});

MessageEmbeds.displayName = "MessageEmbeds";
