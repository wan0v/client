/// <reference types="vite/client" />

declare global {
  const __APP_VERSION__: string;

  interface Window {
    __GRYT_CONFIG__?: {
      GRYT_OIDC_ISSUER?: string;
      GRYT_OIDC_REALM?: string;
      GRYT_OIDC_CLIENT_ID?: string;
    };
  }

  interface RTCRtpEncodingParameters {
    scalabilityMode?: string;
  }

  /** Experimental: Insertable Streams – writable video track generator */
  class MediaStreamTrackGenerator extends MediaStreamTrack {
    constructor(init: { kind: "video" | "audio" });
    readonly writable: WritableStream<VideoFrame>;
  }

  interface VideoFrameBufferInit {
    format: "I420" | "I420A" | "I422" | "I444" | "NV12" | "RGBA" | "RGBX" | "BGRA" | "BGRX";
    codedWidth: number;
    codedHeight: number;
    timestamp: number;
    duration?: number;
    layout?: Array<{ offset: number; stride: number }>;
    visibleRect?: { x: number; y: number; width: number; height: number };
    displayWidth?: number;
    displayHeight?: number;
    colorSpace?: VideoColorSpaceInit;
  }

  class VideoFrame {
    constructor(data: BufferSource, init: VideoFrameBufferInit);
    constructor(image: CanvasImageSource, init?: { timestamp: number; duration?: number });
    readonly codedWidth: number;
    readonly codedHeight: number;
    readonly timestamp: number;
    readonly format: string | null;
    close(): void;
  }
}

export {};
