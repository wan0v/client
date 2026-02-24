import { Flex } from "@radix-ui/themes";
import { memo, useCallback, useEffect, useMemo, useState } from "react";

import { getServerAccessToken, getServerHttpBase } from "@/common";

import {
  AudioEmbed,
  DismissButton,
  ImageEmbed,
  InstagramEmbed,
  SoundCloudEmbed,
  SpotifyEmbed,
  TikTokEmbed,
  TwitchEmbed,
  VideoEmbed,
  VimeoEmbed,
  XEmbed,
  YouTubeEmbed,
} from "./EmbedRenderers";
import {
  dismissEmbed,
  extractUrls,
  getEmbedType,
  isEmbedDismissed,
  type LinkPreviewData,
  previewCache,
} from "./embedUtils";
import { SkeletonBase } from "./skeletons/SkeletonBase";

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
          <div
            className="link-embed-card-image-wrap"
            style={
              data.imageWidth && data.imageHeight
                ? { aspectRatio: `${data.imageWidth} / ${data.imageHeight}` }
                : undefined
            }
          >
            {data.image && !imageFailed ? (
              <img
                src={data.image}
                alt={data.title || "Preview"}
                className="link-embed-card-image"
                width={data.imageWidth ?? undefined}
                height={data.imageHeight ?? undefined}
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
            return <ImageEmbed key={url} url={url} serverHost={serverHost} onDismiss={() => handleDismiss(url)} />;
          case "video":
            return <VideoEmbed key={url} url={url} onDismiss={() => handleDismiss(url)} />;
          case "audio":
            return <AudioEmbed key={url} url={url} onDismiss={() => handleDismiss(url)} />;
          case "youtube":
            return <YouTubeEmbed key={url} url={url} onDismiss={() => handleDismiss(url)} />;
          case "vimeo":
            return <VimeoEmbed key={url} url={url} onDismiss={() => handleDismiss(url)} />;
          case "twitch":
            return <TwitchEmbed key={url} url={url} onDismiss={() => handleDismiss(url)} />;
          case "soundcloud":
            return <SoundCloudEmbed key={url} url={url} onDismiss={() => handleDismiss(url)} />;
          case "spotify":
            return <SpotifyEmbed key={url} url={url} onDismiss={() => handleDismiss(url)} />;
          case "tiktok":
            return <TikTokEmbed key={url} url={url} onDismiss={() => handleDismiss(url)} />;
          case "instagram":
            return <InstagramEmbed key={url} url={url} onDismiss={() => handleDismiss(url)} />;
          case "x":
            return <XEmbed key={url} url={url} serverHost={serverHost} onDismiss={() => handleDismiss(url)} />;
          case "link":
            return <LinkPreviewCard key={url} url={url} serverHost={serverHost} onDismiss={() => handleDismiss(url)} />;
        }
      })}
    </Flex>
  );
});

MessageEmbeds.displayName = "MessageEmbeds";
