import { Flex, IconButton } from "@radix-ui/themes";
import { useCallback, useEffect, useRef, useState } from "react";
import { MdCallEnd, MdMic, MdMicOff, MdVideocam, MdVideocamOff, MdVolumeOff, MdVolumeUp } from "react-icons/md";

import { getIsBrowserSupported, useCamera } from "@/audio";
import { useSettings } from "@/settings";
import { useSockets } from "@/socket";
import { useSFU } from "@/webRTC";

interface ControlsProps {
  onDisconnect?: () => void;
}

export function Controls({ onDisconnect }: ControlsProps) {
  const [isBrowserSupported] = useState(getIsBrowserSupported());
  const { disconnect, addVideoTrack, removeVideoTrack, isConnected, currentServerConnected } = useSFU();
  const { cameraStream, cameraEnabled, setCameraEnabled } = useCamera();
  const { sockets } = useSockets();

  const { setIsMuted, isMuted, isDeafened, setIsDeafened } =
    useSettings();

  const prevStreamRef = useRef<MediaStream | null>(null);

  // Sync camera stream to WebRTC peer connection
  useEffect(() => {
    if (!isConnected) return;
    if (cameraEnabled && cameraStream) {
      const videoTrack = cameraStream.getVideoTracks()[0];
      if (videoTrack) {
        addVideoTrack(videoTrack, cameraStream);
        prevStreamRef.current = cameraStream;
      }
    } else if (prevStreamRef.current) {
      removeVideoTrack();
      prevStreamRef.current = null;
    }
  }, [cameraEnabled, cameraStream, isConnected, addVideoTrack, removeVideoTrack]);

  // Emit camera state to server (include stream ID so peers can map video)
  useEffect(() => {
    if (!isConnected || !currentServerConnected) return;
    const socket = sockets[currentServerConnected];
    if (socket) {
      socket.emit("voice:camera:state", {
        enabled: cameraEnabled,
        streamId: cameraStream?.id || "",
      });
    }
  }, [cameraEnabled, cameraStream, isConnected, currentServerConnected, sockets]);

  // Stop camera on disconnect
  useEffect(() => {
    if (!isConnected && cameraEnabled) {
      setCameraEnabled(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected]);

  const handleToggleCamera = useCallback(() => {
    setCameraEnabled(!cameraEnabled);
  }, [cameraEnabled, setCameraEnabled]);

  function handleMute() {
    setIsMuted(!isMuted);
  }

  function handleDeafen() {
    setIsDeafened(!isDeafened);
  }

  function handleDisconnect() {
    if (cameraEnabled) setCameraEnabled(false);
    disconnect(true, onDisconnect);
  }

  return (
    <>
      {isBrowserSupported && (
        <Flex align="center" justify="center" gap="4">
          <IconButton
            color={isMuted ? "red" : "gray"}
            variant="soft"
            onClick={handleMute}
          >
            {isMuted ? <MdMicOff size={16} /> : <MdMic size={16} />}
          </IconButton>

          <IconButton
            color={isDeafened ? "red" : "gray"}
            variant="soft"
            onClick={handleDeafen}
          >
            {isDeafened ? (
              <MdVolumeOff size={16} />
            ) : (
              <MdVolumeUp size={16} />
            )}
          </IconButton>

          <IconButton
            color={cameraEnabled ? "green" : "gray"}
            variant="soft"
            onClick={handleToggleCamera}
          >
            {cameraEnabled ? <MdVideocam size={16} /> : <MdVideocamOff size={16} />}
          </IconButton>

          <IconButton variant="soft" color="red" onClick={handleDisconnect}>
            <MdCallEnd size={16} />
          </IconButton>
        </Flex>
      )}
    </>
  );
}
