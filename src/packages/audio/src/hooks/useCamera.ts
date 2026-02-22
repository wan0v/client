import { useCallback, useEffect, useRef, useState } from "react";
import { singletonHook } from "react-singleton-hook";

import { useSettings } from "@/settings";

export type CameraQuality = "720p" | "480p" | "360p";

const QUALITY_CONSTRAINTS: Record<CameraQuality, { width: number; height: number; frameRate: number }> = {
  "720p": { width: 1280, height: 720, frameRate: 30 },
  "480p": { width: 854, height: 480, frameRate: 30 },
  "360p": { width: 640, height: 360, frameRate: 30 },
};

export interface CameraInterface {
  cameraStream: MediaStream | null;
  cameraEnabled: boolean;
  setCameraEnabled: (enabled: boolean) => void;
  devices: MediaDeviceInfo[];
  getDevices: () => Promise<void>;
}

function useCameraHook(): CameraInterface {
  const { cameraID, setCameraID, cameraQuality } = useSettings();
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraEnabled, setCameraEnabledState] = useState(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const getDevices = useCallback(async () => {
    try {
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = allDevices.filter((d) => d.kind === "videoinput");
      setDevices(videoDevices);

      if (videoDevices.length > 0 && !cameraID) {
        setCameraID(videoDevices[0].deviceId);
      }
    } catch {
      // Permission denied or no devices
    }
  }, [cameraID, setCameraID]);

  // Listen for hot-plug
  useEffect(() => {
    const handler = () => { getDevices(); };
    navigator.mediaDevices.addEventListener("devicechange", handler);
    return () => navigator.mediaDevices.removeEventListener("devicechange", handler);
  }, [getDevices]);

  const startCamera = useCallback(async () => {
    const quality = QUALITY_CONSTRAINTS[cameraQuality as CameraQuality] ?? QUALITY_CONSTRAINTS["720p"];
    const constraints: MediaStreamConstraints = {
      video: {
        ...(cameraID ? { deviceId: { exact: cameraID } } : {}),
        width: { ideal: quality.width },
        height: { ideal: quality.height },
        frameRate: { ideal: quality.frameRate },
      },
      audio: false,
    };

    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      streamRef.current = stream;
      setCameraStream(stream);

      // Update device list after permission grant
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = allDevices.filter((d) => d.kind === "videoinput");
      setDevices(videoDevices);

      const actualDevice = stream.getVideoTracks()[0]?.getSettings().deviceId;
      if (actualDevice && actualDevice !== cameraID) {
        setCameraID(actualDevice);
      }
    } catch (error) {
      console.error("[Camera] getUserMedia failed:", error);
      setCameraEnabledState(false);
    }
  }, [cameraID, cameraQuality, setCameraID]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraStream(null);
  }, []);

  const setCameraEnabled = useCallback((enabled: boolean) => {
    setCameraEnabledState(enabled);
    if (enabled) {
      startCamera();
    } else {
      stopCamera();
    }
  }, [startCamera, stopCamera]);

  // Restart when device or quality changes while camera is on
  useEffect(() => {
    if (cameraEnabled && cameraID) {
      startCamera();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraID, cameraQuality]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  return {
    cameraStream,
    cameraEnabled,
    setCameraEnabled,
    devices,
    getDevices,
  };
}

const cameraInit: CameraInterface = {
  cameraStream: null,
  cameraEnabled: false,
  setCameraEnabled: () => {},
  devices: [],
  getDevices: async () => {},
};

export const useCamera = singletonHook(cameraInit, useCameraHook);
