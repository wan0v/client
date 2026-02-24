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
  imageWidth: number | null;
  imageHeight: number | null;
  siteName: string | null;
  favicon: string | null;
}

function safeParseUrl(url: string): URL | null {
  try { return new URL(url); } catch { return null; }
}

function getTwitchEmbed(url: string): { kind: "channel" | "video" | "clip"; value: string } | null {
  const u = safeParseUrl(url);
  if (!u) return null;
  const host = u.hostname.replace(/^www\./, "").toLowerCase();

  if (host === "clips.twitch.tv") {
    const slug = u.pathname.split("/").filter(Boolean)[0];
    return slug ? { kind: "clip", value: slug } : null;
  }

  if (host !== "twitch.tv") return null;

  const parts = u.pathname.split("/").filter(Boolean);
  if (parts.length === 0) return null;

  // twitch.tv/videos/<id>
  if (parts[0] === "videos" && parts[1] && /^\d+$/.test(parts[1])) {
    return { kind: "video", value: `v${parts[1]}` };
  }

  // twitch.tv/<channel>/clip/<slug>
  const clipIdx = parts.findIndex((p) => p === "clip");
  if (clipIdx !== -1) {
    const slug = parts[clipIdx + 1];
    return slug ? { kind: "clip", value: slug } : null;
  }

  // twitch.tv/<channel>
  const channel = parts[0];
  if (!channel) return null;
  if (["directory", "downloads", "jobs", "login", "p", "search", "settings", "signup"].includes(channel)) return null;
  return { kind: "channel", value: channel };
}

function getYouTubeVideoId(url: string): string | null {
  const u = safeParseUrl(url);
  if (!u) return null;
  const host = u.hostname.replace(/^www\./, "").toLowerCase();

  // youtu.be/<id>
  if (host === "youtu.be") {
    const id = u.pathname.split("/").filter(Boolean)[0];
    return id || null;
  }

  if (host !== "youtube.com" && host !== "m.youtube.com" && host !== "music.youtube.com") return null;

  // youtube.com/watch?v=<id>
  const v = u.searchParams.get("v");
  if (v) return v;

  // youtube.com/shorts/<id>, /embed/<id>
  const parts = u.pathname.split("/").filter(Boolean);
  const idx = parts.findIndex((p) => p === "shorts" || p === "embed");
  if (idx !== -1) {
    const id = parts[idx + 1];
    return id || null;
  }

  return null;
}

function getVimeoVideoId(url: string): string | null {
  const u = safeParseUrl(url);
  if (!u) return null;
  const host = u.hostname.replace(/^www\./, "").toLowerCase();

  // vimeo.com/<id>
  if (host === "vimeo.com") {
    const id = u.pathname.split("/").filter(Boolean)[0];
    return id && /^\d+$/.test(id) ? id : null;
  }

  // player.vimeo.com/video/<id>
  if (host === "player.vimeo.com") {
    const parts = u.pathname.split("/").filter(Boolean);
    if (parts[0] === "video") {
      const id = parts[1];
      return id && /^\d+$/.test(id) ? id : null;
    }
  }

  return null;
}

function isSoundCloudUrl(url: string): boolean {
  const u = safeParseUrl(url);
  if (!u) return false;
  const host = u.hostname.replace(/^www\./, "").toLowerCase();
  return host === "soundcloud.com" || host === "on.soundcloud.com";
}

type SpotifyEmbedInfo = { embedSrc: string; height: number };

function getSpotifyEmbed(url: string): SpotifyEmbedInfo | null {
  const u = safeParseUrl(url);
  if (!u) return null;
  const host = u.hostname.replace(/^www\./, "").toLowerCase();
  if (host !== "open.spotify.com") return null;

  const parts = u.pathname.split("/").filter(Boolean);
  const type = parts[0];
  const id = parts[1];
  if (!type || !id) return null;

  const allowed = new Set(["track", "album", "playlist", "artist", "show", "episode"]);
  if (!allowed.has(type)) return null;

  const embedSrc = `https://open.spotify.com/embed/${type}/${encodeURIComponent(id)}`;
  const height = type === "track" || type === "episode" ? 152 : 352;
  return { embedSrc, height };
}

function getTikTokVideoId(url: string): string | null {
  const u = safeParseUrl(url);
  if (!u) return null;
  const host = u.hostname.replace(/^www\./, "").toLowerCase();
  if (host !== "tiktok.com" && host !== "vm.tiktok.com" && host !== "vt.tiktok.com") return null;

  // Most common: /@user/video/<id>
  const m1 = u.pathname.match(/\/video\/(\d{10,})/);
  if (m1?.[1]) return m1[1];

  // Fallback: any long numeric id in path
  const m2 = u.pathname.match(/(\d{10,})/);
  if (m2?.[1]) return m2[1];

  return null;
}

function getInstagramEmbedSrc(url: string): string | null {
  const u = safeParseUrl(url);
  if (!u) return null;
  const host = u.hostname.replace(/^www\./, "").toLowerCase();
  if (host !== "instagram.com") return null;
  const parts = u.pathname.split("/").filter(Boolean);
  if (parts.length < 2) return null;
  const kind = parts[0];
  const shortcode = parts[1];
  if (!shortcode) return null;
  if (kind !== "p" && kind !== "reel" && kind !== "tv") return null;
  return `https://www.instagram.com/${kind}/${encodeURIComponent(shortcode)}/embed/`;
}

function isXUrl(url: string): boolean {
  const u = safeParseUrl(url);
  if (!u) return false;
  const host = u.hostname.replace(/^www\./, "").toLowerCase();
  return host === "x.com" || host === "twitter.com";
}

type EmbedType =
  | "image"
  | "video"
  | "audio"
  | "youtube"
  | "vimeo"
  | "twitch"
  | "soundcloud"
  | "spotify"
  | "tiktok"
  | "instagram"
  | "x"
  | "link";

function getEmbedType(url: string): EmbedType {
  if (getTwitchEmbed(url)) return "twitch";
  if (getYouTubeVideoId(url)) return "youtube";
  if (getVimeoVideoId(url)) return "vimeo";
  if (getTikTokVideoId(url)) return "tiktok";
  if (getInstagramEmbedSrc(url)) return "instagram";
  if (getSpotifyEmbed(url)) return "spotify";
  if (isSoundCloudUrl(url)) return "soundcloud";
  if (isXUrl(url)) return "x";
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

type RemoteImageMetadata = { width: number | null; height: number | null };

function parseRemoteImageMetadata(raw: unknown): RemoteImageMetadata | null {
  if (typeof raw !== "object" || raw === null) return null;
  const rec = raw as Record<string, unknown>;
  const width = typeof rec.width === "number" ? rec.width : null;
  const height = typeof rec.height === "number" ? rec.height : null;
  return { width, height };
}

const ImageEmbed = ({ url, serverHost, onDismiss }: { url: string; serverHost: string; onDismiss: () => void }) => {
  const [cached, setCached] = useState(() => imageEmbedSizeCache.get(url));

  useEffect(() => {
    setCached(imageEmbedSizeCache.get(url));
  }, [url]);

  useEffect(() => {
    if (cached) return;
    const accessToken = getServerAccessToken(serverHost);
    if (!accessToken) return;
    const base = getServerHttpBase(serverHost);
    let cancelled = false;
    fetch(`${base}/api/media/metadata?url=${encodeURIComponent(url)}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("metadata_failed"))))
      .then((j: unknown) => {
        if (cancelled) return;
        const meta = parseRemoteImageMetadata(j);
        if (!meta?.width || !meta.height) return;
        imageEmbedSizeCache.set(url, { width: meta.width, height: meta.height });
        setCached({ width: meta.width, height: meta.height });
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [cached, serverHost, url]);

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

const TwitchEmbed = ({ url, onDismiss }: { url: string; onDismiss: () => void }) => {
  const embed = getTwitchEmbed(url);
  if (!embed) return null;
  const parent = (() => {
    try {
      const h = window.location.hostname;
      return h || "localhost";
    } catch { return "localhost"; }
  })();
  const base = embed.kind === "clip" ? "https://clips.twitch.tv/embed" : "https://player.twitch.tv/";
  const src = (() => {
    const u = new URL(base);
    if (embed.kind === "clip") {
      u.searchParams.set("clip", embed.value);
      u.searchParams.set("autoplay", "false");
    } else if (embed.kind === "video") {
      u.searchParams.set("video", embed.value);
      u.searchParams.set("autoplay", "false");
      u.searchParams.set("muted", "true");
    } else {
      u.searchParams.set("channel", embed.value);
      u.searchParams.set("autoplay", "false");
      u.searchParams.set("muted", "true");
    }
    u.searchParams.set("parent", parent);
    return u.toString();
  })();

  return (
    <div className="link-embed-container">
      <DismissButton onDismiss={onDismiss} />
      <iframe
        className="link-embed-iframe"
        src={src}
        title="Twitch"
        loading="lazy"
        allow="autoplay; fullscreen"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
      />
    </div>
  );
};

const SoundCloudEmbed = ({ url, onDismiss }: { url: string; onDismiss: () => void }) => {
  const src = `https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}&auto_play=false&hide_related=true&show_comments=false&show_reposts=false&visual=false`;
  return (
    <div className="link-embed-container">
      <DismissButton onDismiss={onDismiss} />
      <iframe
        className="link-embed-iframe-soundcloud"
        src={src}
        title="SoundCloud"
        loading="lazy"
        allow="autoplay"
        referrerPolicy="strict-origin-when-cross-origin"
      />
    </div>
  );
};

const SpotifyEmbed = ({ url, onDismiss }: { url: string; onDismiss: () => void }) => {
  const info = getSpotifyEmbed(url);
  if (!info) return null;
  return (
    <div className="link-embed-container">
      <DismissButton onDismiss={onDismiss} />
      <iframe
        className="link-embed-iframe-spotify"
        src={info.embedSrc}
        title="Spotify"
        height={info.height}
        loading="lazy"
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        referrerPolicy="strict-origin-when-cross-origin"
      />
    </div>
  );
};

const TikTokEmbed = ({ url, onDismiss }: { url: string; onDismiss: () => void }) => {
  const id = getTikTokVideoId(url);
  if (!id) return null;
  const src = `https://www.tiktok.com/player/v1/${encodeURIComponent(id)}`;
  return (
    <div className="link-embed-container">
      <DismissButton onDismiss={onDismiss} />
      <iframe
        className="link-embed-iframe-tiktok"
        src={src}
        title="TikTok"
        loading="lazy"
        allow="autoplay; fullscreen"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
      />
    </div>
  );
};

const InstagramEmbed = ({ url, onDismiss }: { url: string; onDismiss: () => void }) => {
  const src = getInstagramEmbedSrc(url);
  if (!src) return null;
  return (
    <div className="link-embed-container">
      <DismissButton onDismiss={onDismiss} />
      <iframe
        className="link-embed-iframe-instagram"
        src={src}
        title="Instagram"
        loading="lazy"
        allow="autoplay; fullscreen"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
      />
    </div>
  );
};

const YouTubeEmbed = ({ url, onDismiss }: { url: string; onDismiss: () => void }) => {
  const videoId = getYouTubeVideoId(url);
  if (!videoId) return null;
  const embedUrl = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}`;
  return (
    <div className="link-embed-container">
      <DismissButton onDismiss={onDismiss} />
      <iframe
        className="link-embed-iframe"
        src={embedUrl}
        title="YouTube video"
        loading="lazy"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
      />
    </div>
  );
};

const VimeoEmbed = ({ url, onDismiss }: { url: string; onDismiss: () => void }) => {
  const videoId = getVimeoVideoId(url);
  if (!videoId) return null;
  const embedUrl = `https://player.vimeo.com/video/${encodeURIComponent(videoId)}`;
  return (
    <div className="link-embed-container">
      <DismissButton onDismiss={onDismiss} />
      <iframe
        className="link-embed-iframe"
        src={embedUrl}
        title="Vimeo video"
        loading="lazy"
        allow="autoplay; fullscreen; picture-in-picture"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
      />
    </div>
  );
};

type OEmbedPayload = { html: string };

function safeJsonParseOEmbed(raw: unknown): OEmbedPayload | null {
  if (typeof raw !== "object" || raw === null) return null;
  const rec = raw as Record<string, unknown>;
  if (typeof rec.html !== "string") return null;
  return { html: rec.html };
}

const XEmbed = ({ url, serverHost, onDismiss }: { url: string; serverHost: string; onDismiss: () => void }) => {
  const [html, setHtml] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setHtml(null);
    setFailed(false);
  }, [url]);

  useEffect(() => {
    if (html || failed) return;
    const accessToken = getServerAccessToken(serverHost);
    if (!accessToken) { setFailed(true); return; }
    const base = getServerHttpBase(serverHost);
    let cancelled = false;
    fetch(`${base}/api/oembed?url=${encodeURIComponent(url)}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("oembed_failed"))))
      .then((j: unknown) => {
        if (cancelled) return;
        const parsed = safeJsonParseOEmbed(j);
        if (!parsed) { setFailed(true); return; }
        setHtml(parsed.html);
      })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [url, serverHost, html, failed]);

  if (failed) return null;
  if (!html) {
    return (
      <div className="link-embed-container">
        <DismissButton onDismiss={onDismiss} />
        <div className="link-embed-twitter-skeleton">
          <SkeletonBase width="100%" height="100%" borderRadius="var(--radius-4)" />
        </div>
      </div>
    );
  }

  const srcDoc = `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><style>html,body{margin:0;padding:0;background:transparent;}body{display:flex;justify-content:center;}blockquote{margin:0!important;}</style></head><body>${html}<script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script></body></html>`;

  return (
    <div className="link-embed-container">
      <DismissButton onDismiss={onDismiss} />
      <iframe
        className="link-embed-iframe-twitter"
        title="X"
        sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
        srcDoc={srcDoc}
      />
    </div>
  );
};

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
