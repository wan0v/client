import { useCallback, useEffect, useRef, useState } from "react";

import { getElectronAPI, isElectron } from "../../../../lib/electron";

export interface NativeScreenCapture {
  available: boolean;
  active: boolean;
  videoStream: MediaStream | null;
  start: (monitorIndex: number, fps: number, maxWidth?: number, maxHeight?: number) => Promise<boolean>;
  stop: () => void;
}

function isMediaStreamTrackGeneratorSupported(): boolean {
  return typeof MediaStreamTrackGenerator !== "undefined";
}

export function useNativeScreenCapture(): NativeScreenCapture {
  const [available, setAvailable] = useState(false);
  const [active, setActive] = useState(false);
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null);

  const generatorRef = useRef<MediaStreamTrackGenerator | null>(null);
  const writerRef = useRef<WritableStreamDefaultWriter<VideoFrame> | null>(null);
  const cleanupIpcRef = useRef<Array<() => void>>([]);
  const activeRef = useRef(false);

  useEffect(() => {
    if (!isElectron()) return;
    if (!isMediaStreamTrackGeneratorSupported()) {
      console.warn("[NativeScreenCapture] MediaStreamTrackGenerator not supported");
      return;
    }

    const api = getElectronAPI();
    if (!api) return;

    let cancelled = false;

    async function probe(attempt: number) {
      try {
        const v = await api!.isNativeScreenCaptureAvailable();
        if (!cancelled) {
          console.log(`[NativeScreenCapture] availability: ${v}`);
          setAvailable(v);
        }
      } catch (err) {
        if (cancelled) return;
        if (attempt < 3) {
          setTimeout(() => probe(attempt + 1), 500 * attempt);
        } else {
          console.error("[NativeScreenCapture] probe failed", err);
        }
      }
    }

    probe(1);
    return () => { cancelled = true; };
  }, []);

  const stop = useCallback(() => {
    activeRef.current = false;

    const api = getElectronAPI();
    api?.stopNativeScreenCapture();

    if (writerRef.current) {
      writerRef.current.close().catch(() => {});
      writerRef.current = null;
    }
    if (generatorRef.current) {
      generatorRef.current.stop();
      generatorRef.current = null;
    }

    for (const unsub of cleanupIpcRef.current) unsub();
    cleanupIpcRef.current = [];

    setVideoStream(null);
    setActive(false);
  }, []);

  const start = useCallback(
    async (monitorIndex: number, fps: number, maxWidth?: number, maxHeight?: number): Promise<boolean> => {
      const api = getElectronAPI();
      if (!api || !isMediaStreamTrackGeneratorSupported()) return false;

      const generator = new MediaStreamTrackGenerator({ kind: "video" });
      const writer = generator.writable.getWriter();
      generatorRef.current = generator;
      writerRef.current = writer;

      let framesReceived = 0;
      let lastLogTime = Date.now();

      const unsubFrame = api.onNativeScreenFrame((frame) => {
        if (!activeRef.current) return;

        try {
          const videoFrame = new VideoFrame(new Uint8Array(frame.data), {
            format: "I420",
            codedWidth: frame.width,
            codedHeight: frame.height,
            timestamp: frame.timestampUs,
          });
          writer.write(videoFrame).catch(() => {});
          videoFrame.close();
        } catch (err) {
          if (framesReceived === 0) {
            console.error("[NativeScreenCapture] VideoFrame creation failed:", err);
          }
        }

        framesReceived++;
        const now = Date.now();
        if (now - lastLogTime >= 5000) {
          const elapsed = (now - lastLogTime) / 1000;
          console.log(`[NativeScreenCapture] renderer: ${(framesReceived / elapsed).toFixed(1)} fps`);
          framesReceived = 0;
          lastLogTime = now;
        }
      });

      const unsubStopped = api.onNativeScreenCaptureStopped(() => {
        console.log("[NativeScreenCapture] native process stopped");
        stop();
      });

      cleanupIpcRef.current = [unsubFrame, unsubStopped];

      const started = await api.startNativeScreenCapture(monitorIndex, fps, maxWidth, maxHeight);
      if (!started) {
        console.error("[NativeScreenCapture] failed to start native capture");
        stop();
        return false;
      }

      activeRef.current = true;
      generator.contentHint = "motion";
      const stream = new MediaStream([generator]);
      setVideoStream(stream);
      setActive(true);

      console.log(`[NativeScreenCapture] started: monitor=${monitorIndex} fps=${fps} res=${maxWidth ?? "native"}x${maxHeight ?? "native"}`);
      return true;
    },
    [stop],
  );

  useEffect(() => {
    return () => { stop(); };
  }, [stop]);

  return { available, active, videoStream, start, stop };
}
