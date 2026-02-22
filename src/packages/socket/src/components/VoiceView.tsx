import { closestCenter, DndContext, type DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove, rectSortingStrategy, SortableContext, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Avatar, ContextMenu, Flex, Slider, Text, Tooltip } from "@radix-ui/themes";
import { AnimatePresence, motion } from "motion/react";
import type { CSSProperties, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MdMicOff, MdOpenInNew, MdScreenShare, MdVideocam, MdVolumeOff, MdVolumeUp } from "react-icons/md";

import { useCamera as useLocalCamera, useScreenShare as useLocalScreenShare, useVoiceLatency } from "@/audio";
import { getUploadsFileUrl } from "@/common";
import { useSettings } from "@/settings";
import { Controls } from "@/webRTC";
import type { StreamSources } from "@/webRTC/src/types/SFU";

import type { PeerLatencyStats } from "../hooks/usePeerLatency";
import type { Client } from "../types/clients";
import type { PopoutHandle } from "../utils/popoutVideo";
import { popoutStream } from "../utils/popoutVideo";
import type { AdminActions, MemberInfo } from "./MemberSidebar";
import { SkeletonBase } from "./skeletons";
import { UserContextMenu } from "./UserContextMenu";

type Role = "owner" | "admin" | "mod" | "member";

function VideoCard({
  stream,
  nickname,
  mirrored,
  isSpeaking,
  compact,
  statusIcons,
}: {
  stream: MediaStream;
  nickname: string;
  mirrored?: boolean;
  isSpeaking?: boolean;
  compact?: boolean;
  statusIcons?: ReactNode;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream;
  }, [stream]);

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        aspectRatio: compact ? undefined : "16 / 9",
        height: compact ? 60 : undefined,
        borderRadius: "var(--radius-3)",
        overflow: "hidden",
        background: "#000",
        outline: isSpeaking ? "2.5px solid var(--accent-9)" : "2.5px solid transparent",
        transition: "outline-color 0.1s ease",
      }}
    >
      <video
        ref={ref}
        autoPlay
        playsInline
        muted
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: mirrored ? "scaleX(-1)" : undefined,
        }}
      />
      <Flex
        align="center"
        gap="1"
        px="2"
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          background: "linear-gradient(transparent, rgba(0,0,0,0.7))",
          padding: "12px 8px 4px",
        }}
      >
        <Text size="1" weight="medium" style={{ color: "#fff" }} truncate>
          {nickname}
        </Text>
        {statusIcons}
      </Flex>
    </div>
  );
}

function ScreenSharePresentation({
  stream,
  sharerNickname,
  audioStreamId,
  streamSources,
  onPopout,
}: {
  stream: MediaStream;
  sharerNickname: string;
  audioStreamId?: string;
  streamSources?: StreamSources;
  onPopout?: () => void;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [volume, setVolume] = useState(100);

  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream;
  }, [stream]);

  const handleVolumeChange = useCallback((values: number[]) => {
    const v = values[0];
    setVolume(v);
    if (audioStreamId && streamSources?.[audioStreamId]) {
      const gain = streamSources[audioStreamId].gain;
      gain.gain.setValueAtTime(v / 100, 0);
    }
  }, [audioStreamId, streamSources]);

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger>
        <Flex
          direction="column"
          gap="2"
          style={{
            flex: 1,
            minHeight: 0,
            position: "relative",
          }}
        >
          <Flex
            align="center"
            gap="2"
            px="2"
            style={{
              background: "var(--gray-4)",
              borderRadius: "var(--radius-3)",
              padding: "4px 8px",
            }}
          >
            <MdScreenShare size={14} />
            <Text size="1" weight="medium" truncate>
              {sharerNickname} is sharing their screen
            </Text>
            {onPopout && (
              <Tooltip content="Pop out">
                <Flex
                  asChild
                  align="center"
                  justify="center"
                  style={{ cursor: "pointer", opacity: 0.7 }}
                  onClick={onPopout}
                >
                  <button style={{ background: "none", border: "none", color: "inherit", padding: 0, cursor: "pointer" }}>
                    <MdOpenInNew size={14} />
                  </button>
                </Flex>
              </Tooltip>
            )}
            {audioStreamId && streamSources?.[audioStreamId] && (
              <Flex align="center" gap="2" ml="auto" style={{ minWidth: 100 }}>
                <MdVolumeUp size={14} />
                <Slider
                  size="1"
                  value={[volume]}
                  onValueChange={handleVolumeChange}
                  min={0}
                  max={200}
                  step={1}
                  style={{ flex: 1 }}
                />
              </Flex>
            )}
          </Flex>
          <div
            style={{
              flex: 1,
              position: "relative",
              borderRadius: "var(--radius-3)",
              overflow: "hidden",
              background: "#000",
              minHeight: 0,
            }}
          >
            <video
              ref={ref}
              autoPlay
              playsInline
              muted
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                objectFit: "contain",
              }}
            />
          </div>
        </Flex>
      </ContextMenu.Trigger>
      <ContextMenu.Content>
        {onPopout && (
          <ContextMenu.Item onClick={onPopout}>
            Pop out stream
          </ContextMenu.Item>
        )}
      </ContextMenu.Content>
    </ContextMenu.Root>
  );
}

function LocalScreenSharePreview({ onPopout }: { onPopout?: () => void }) {
  const ref = useRef<HTMLVideoElement>(null);
  const { screenVideoStream } = useLocalScreenShare();
  useEffect(() => {
    if (ref.current) ref.current.srcObject = screenVideoStream;
  }, [screenVideoStream]);
  if (!screenVideoStream) return null;
  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger>
        <Flex
          direction="column"
          gap="2"
          style={{ flex: 1, minHeight: 0, position: "relative" }}
        >
          <Flex
            align="center"
            gap="2"
            px="2"
            style={{
              background: "var(--green-4)",
              borderRadius: "var(--radius-3)",
              padding: "4px 8px",
            }}
          >
            <MdScreenShare size={14} />
            <Text size="1" weight="medium">You are sharing your screen</Text>
            {onPopout && (
              <Tooltip content="Pop out">
                <Flex
                  asChild
                  align="center"
                  justify="center"
                  style={{ cursor: "pointer", opacity: 0.7 }}
                  onClick={onPopout}
                >
                  <button style={{ background: "none", border: "none", color: "inherit", padding: 0, cursor: "pointer" }}>
                    <MdOpenInNew size={14} />
                  </button>
                </Flex>
              </Tooltip>
            )}
          </Flex>
          <div
            style={{
              flex: 1,
              position: "relative",
              borderRadius: "var(--radius-3)",
              overflow: "hidden",
              background: "#000",
              minHeight: 0,
            }}
          >
            <video
              ref={ref}
              autoPlay
              playsInline
              muted
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                objectFit: "contain",
              }}
            />
          </div>
        </Flex>
      </ContextMenu.Trigger>
      <ContextMenu.Content>
        {onPopout && (
          <ContextMenu.Item onClick={onPopout}>
            Pop out stream
          </ContextMenu.Item>
        )}
      </ContextMenu.Content>
    </ContextMenu.Root>
  );
}

function latencyColor(ms: number | null): string {
  if (ms === null) return "var(--gray-9)";
  if (ms < 30) return "var(--green-9)";
  if (ms < 80) return "var(--yellow-9)";
  return "var(--red-9)";
}

function SortableParticipant({ id, children }: { id: string; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.85 : 1,
    zIndex: isDragging ? 10 : undefined,
    cursor: isDragging ? "grabbing" : "grab",
    borderRadius: "var(--radius-5)",
    boxShadow: isDragging ? "0 8px 24px rgba(0,0,0,0.35)" : undefined,
    scale: isDragging ? "1.05" : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {children}
    </div>
  );
}

export const VoiceView = ({
  showVoiceView,
  voiceWidth,
  serverHost,
  currentServerConnected,
  currentChannelId,
  clientsForHost,
  members,
  clientsSpeaking,
  isConnecting,
  currentConnectionId,
  onDisconnect,
  peerLatency,
  onDisconnectUser,
  isDragging,
  currentUserRole,
  adminActions,
  videoStreams,
  streamSources,
}: {
  showVoiceView: boolean;
  voiceWidth: string;
  serverHost: string;
  currentServerConnected: string | null;
  currentChannelId?: string;
  clientsForHost: Record<string, Client>;
  members?: MemberInfo[];
  clientsSpeaking: Record<string, boolean>;
  isConnecting: boolean;
  currentConnectionId?: string;
  onDisconnect?: () => void;
  peerLatency?: Record<string, PeerLatencyStats>;
  onDisconnectUser?: (targetServerUserId: string) => void;
  isDragging?: boolean;
  currentUserRole?: Role;
  adminActions?: AdminActions;
  videoStreams?: Record<string, MediaStream>;
  streamSources?: StreamSources;
}) => {
  const { showPeerLatency, cameraMirrored } = useSettings();
  const { latency: selfLatency } = useVoiceLatency(showPeerLatency);
  const { screenShareActive: localScreenActive, screenVideoStream: localScreenStream } = useLocalScreenShare();
  const { cameraStream: localCameraStream } = useLocalCamera();
  const gridRef = useRef<HTMLDivElement>(null);
  const [gridHeight, setGridHeight] = useState(0);
  const popoutHandles = useRef<Map<string, PopoutHandle>>(new Map());

  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const handlePopout = useCallback(async (id: string, stream: MediaStream, title: string) => {
    const existing = popoutHandles.current.get(id);
    if (existing?.isOpen()) return;

    const handle = await popoutStream(stream, title);
    if (!handle) return;

    popoutHandles.current.set(id, handle);

    const check = setInterval(() => {
      if (!handle.isOpen()) {
        clearInterval(check);
        popoutHandles.current.delete(id);
      }
    }, 500);
  }, []);

  useEffect(() => {
    const handles = popoutHandles.current;
    return () => {
      for (const h of handles.values()) h.close();
      handles.clear();
    };
  }, []);

  const memberByServerUserId = new Map(
    (members || []).map((m) => [m.serverUserId, m])
  );
  const avatarByServerUserId = new Map<string, string | null | undefined>(
    (members || []).map((m) => [m.serverUserId, m.avatarFileId])
  );

  const visibleClients = useMemo(() => {
    if (currentServerConnected !== serverHost) return [];
    return Object.keys(clientsForHost).filter((id) => {
      const client = clientsForHost[id];
      const isUserConnecting = id === currentConnectionId && isConnecting;
      const isInThisChannel = currentChannelId
        ? client.voiceChannelId === currentChannelId
        : client.hasJoinedChannel;
      return isInThisChannel || isUserConnecting;
    });
  }, [clientsForHost, currentServerConnected, serverHost, currentConnectionId, isConnecting, currentChannelId]);

  const visibleCount = visibleClients.length;

  const [customOrder, setCustomOrder] = useState<string[]>([]);

  const orderedClients = useMemo(() => {
    const visibleSet = new Set(visibleClients);
    const ordered = customOrder.filter((id) => visibleSet.has(id));
    const orderedSet = new Set(ordered);
    for (const id of visibleClients) {
      if (!orderedSet.has(id)) ordered.push(id);
    }
    return ordered;
  }, [visibleClients, customOrder]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = orderedClients.indexOf(String(active.id));
      const newIndex = orderedClients.indexOf(String(over.id));
      if (oldIndex !== -1 && newIndex !== -1) {
        setCustomOrder(arrayMove(orderedClients, oldIndex, newIndex));
      }
    }
  }, [orderedClients]);

  // Find the active screen sharer (first remote sharer, or self)
  const screenSharer = useMemo(() => {
    for (const id of visibleClients) {
      const client = clientsForHost[id];
      const isSelf = id === currentConnectionId;
      if (isSelf && localScreenActive) return { id, client, isSelf: true };
      if (!isSelf && client.screenShareEnabled && client.screenShareVideoStreamID) {
        return { id, client, isSelf: false };
      }
    }
    return null;
  }, [visibleClients, clientsForHost, currentConnectionId, localScreenActive]);

  const isPresentationMode = !!screenSharer;

  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setGridHeight(entry.contentRect.height);
      setGridWidth(entry.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const [gridWidth, setGridWidth] = useState(0);

  const columns = useMemo(() => {
    if (isPresentationMode) return visibleCount;
    if (visibleCount <= 0) return 1;
    const ITEM_HEIGHT = 100;
    const CONTROLS_RESERVED = 80;
    const usable = gridHeight - CONTROLS_RESERVED;
    if (usable <= 0) return 1;
    const maxRows = Math.max(1, Math.floor(usable / ITEM_HEIGHT));
    return Math.max(1, Math.ceil(visibleCount / maxRows));
  }, [visibleCount, gridHeight, isPresentationMode]);

  const useAutoLayout = gridWidth > 0 && gridWidth < 300;

  return (
    <motion.div
      transition={isDragging ? { duration: 0 } : { type: "spring", stiffness: 300, damping: 30 }}
      animate={{
        width: showVoiceView ? voiceWidth : 0,
        paddingRight: !showVoiceView || voiceWidth === "0px" ? 0 : 8,
      }}
      style={{ overflow: "hidden" }}
    >
      <Flex
        style={{
          background: "var(--gray-3)",
          borderRadius: "var(--radius-5)",
        }}
        height="100%"
        width="100%"
        direction="column"
        p="3"
      >
        {/* Presentation mode: screen share takes main area */}
        {isPresentationMode && (
          <Flex direction="column" style={{ flex: 1, minHeight: 0 }}>
            {screenSharer.isSelf ? (
              <LocalScreenSharePreview
                onPopout={localScreenStream ? () => handlePopout("screen-local", localScreenStream, "Your Screen Share") : undefined}
              />
            ) : (
              videoStreams?.[screenSharer.client.screenShareVideoStreamID!] && (
                <ScreenSharePresentation
                  stream={videoStreams[screenSharer.client.screenShareVideoStreamID!]}
                  sharerNickname={screenSharer.client.nickname}
                  audioStreamId={screenSharer.client.screenShareAudioStreamID || undefined}
                  streamSources={streamSources}
                  onPopout={() => handlePopout(
                    `screen-${screenSharer.id}`,
                    videoStreams![screenSharer.client.screenShareVideoStreamID!],
                    `${screenSharer.client.nickname}'s Screen`,
                  )}
                />
              )
            )}
          </Flex>
        )}

        {/* Participant grid: full area normally, horizontal strip in presentation mode */}
        <div
          ref={gridRef}
          style={{
            flexGrow: isPresentationMode ? 0 : 1,
            flexShrink: 0,
            position: "relative",
            overflow: "hidden",
          }}
        >
          <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={orderedClients} strategy={rectSortingStrategy}>
              <div
                style={{
                  display: isPresentationMode ? "flex" : "grid",
                  gridTemplateColumns: isPresentationMode
                    ? undefined
                    : useAutoLayout
                      ? "1fr"
                      : `repeat(${columns}, 1fr)`,
                  gap: "var(--space-2)",
                  justifyItems: "center",
                  alignContent: isPresentationMode ? "flex-start" : "center",
                  alignItems: isPresentationMode ? "center" : undefined,
                  overflowX: isPresentationMode ? "auto" : undefined,
                  overflowY: isPresentationMode ? undefined : "auto",
                  paddingTop: isPresentationMode ? "var(--space-2)" : undefined,
                  paddingBottom: isPresentationMode ? undefined : "60px",
                  height: isPresentationMode ? undefined : "100%",
                }}
              >
                <AnimatePresence>
                  {currentServerConnected === serverHost &&
                    orderedClients.map((id) => {
                      const client = clientsForHost[id];
                      const isUserConnecting = id === currentConnectionId && isConnecting;
                      const serverUserId: string | undefined = client?.serverUserId;
                      const avatarFileId = serverUserId ? avatarByServerUserId.get(serverUserId) : undefined;
                      const isSelf = id === currentConnectionId;

                      return (
                        <motion.div
                          key={id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.2 }}
                        >
                          <SortableParticipant id={id}>
                            <UserContextMenu
                        serverUserId={serverUserId}
                        nickname={client.nickname}
                        isSelf={isSelf}
                        canDisconnect={!!onDisconnectUser}
                        isInVoice={true}
                        onDisconnectFromVoice={onDisconnectUser && serverUserId ? () => onDisconnectUser(serverUserId) : undefined}
                        role={currentUserRole}
                        targetRole={serverUserId ? memberByServerUserId.get(serverUserId)?.role : undefined}
                        isServerMuted={serverUserId ? memberByServerUserId.get(serverUserId)?.isServerMuted : undefined}
                        isServerDeafened={serverUserId ? memberByServerUserId.get(serverUserId)?.isServerDeafened : undefined}
                        onKick={adminActions?.onKickUser && serverUserId ? () => adminActions.onKickUser!(serverUserId) : undefined}
                        onBan={adminActions?.onBanUser && serverUserId ? () => adminActions.onBanUser!(serverUserId) : undefined}
                        onServerMute={adminActions?.onServerMuteUser && serverUserId ? (muted) => adminActions.onServerMuteUser!(serverUserId, muted) : undefined}
                        onServerDeafen={adminActions?.onServerDeafenUser && serverUserId ? (deafened) => adminActions.onServerDeafenUser!(serverUserId, deafened) : undefined}
                        onChangeRole={adminActions?.onChangeRole && serverUserId ? (role) => adminActions.onChangeRole!(serverUserId, role) : undefined}
                        onPopoutVideo={(() => {
                          if (isSelf && localCameraStream) {
                            return () => handlePopout(`cam-${id}`, localCameraStream, "Your Webcam");
                          }
                          if (!isSelf && client.cameraEnabled && client.cameraStreamID && videoStreams?.[client.cameraStreamID]) {
                            return () => handlePopout(`cam-${id}`, videoStreams![client.cameraStreamID!], `${client.nickname}'s Webcam`);
                          }
                          return undefined;
                        })()}
                      >
                        {(() => {
                          const hasCameraStream =
                            (isSelf && localCameraStream) ||
                            (!isSelf && client.cameraEnabled && client.cameraStreamID && videoStreams?.[client.cameraStreamID]);

                          const statusBadges = (
                            <>
                              {(client.isMuted || client.isDeafened) && (
                                client.isDeafened
                                  ? <MdVolumeOff size={12} color="var(--red-9)" />
                                  : <MdMicOff size={12} color="var(--red-9)" />
                              )}
                              {client.isAFK && (
                                <Text size="1" weight="bold" color="orange" style={{ color: "#fff" }}>AFK</Text>
                              )}
                              {client.screenShareEnabled && <MdScreenShare size={10} color="var(--blue-9)" />}
                            </>
                          );

                          if (hasCameraStream && !isPresentationMode) {
                            const camStream = isSelf
                              ? localCameraStream!
                              : videoStreams![client.cameraStreamID!];
                            return (
                              <Flex direction="column" gap="1" align="center" style={{ width: "100%" }}>
                                <VideoCard
                                  stream={camStream}
                                  nickname={client.nickname}
                                  mirrored={isSelf ? cameraMirrored : false}
                                  isSpeaking={clientsSpeaking[id]}
                                  statusIcons={statusBadges}
                                />
                                {showPeerLatency && (() => {
                                  const stats = isSelf ? selfLatency : peerLatency?.[id];
                                  const oneWay = isSelf ? stats?.estimatedOneWayMs : (stats as PeerLatencyStats | undefined)?.estimatedOneWayMs;
                                  const rtt = isSelf ? stats?.networkRttMs : (stats as PeerLatencyStats | undefined)?.networkRttMs;
                                  const jitter = isSelf ? stats?.jitterMs : (stats as PeerLatencyStats | undefined)?.jitterMs;
                                  const codecStr = isSelf ? stats?.codec : (stats as PeerLatencyStats | undefined)?.codec;
                                  if (oneWay == null) return null;
                                  const tooltipParts = [`RTT: ${rtt?.toFixed(0) ?? "—"}ms`, `Jitter: ${jitter?.toFixed(1) ?? "—"}ms`, codecStr ?? "—"];
                                  if (isSelf && selfLatency.remoteAddress) tooltipParts.push(`ICE: ${selfLatency.remoteAddress}`);
                                  return (
                                    <Tooltip content={tooltipParts.join(" · ")}>
                                      <Text size="1" style={{ color: latencyColor(oneWay), fontVariantNumeric: "tabular-nums", cursor: "default" }}>
                                        {Math.round(oneWay)}ms
                                      </Text>
                                    </Tooltip>
                                  );
                                })()}
                              </Flex>
                            );
                          }

                          return (
                            <Flex
                              align="center"
                              justify="center"
                              direction={isPresentationMode ? "row" : "column"}
                              gap="1"
                              px={isPresentationMode ? "2" : "4"}
                              py={isPresentationMode ? "1" : "3"}
                            >
                              <Flex align="center" justify="center" position="relative">
                                <Avatar
                                  size={isPresentationMode ? "2" : "3"}
                                  fallback={client.nickname[0]}
                                  src={avatarFileId ? getUploadsFileUrl(serverHost, avatarFileId) : undefined}
                                  style={{
                                    outline: "2.5px solid",
                                    outlineColor: clientsSpeaking[id] ? "var(--accent-9)" : "transparent",
                                    transition: "outline-color 0.1s ease",
                                  }}
                                />
                                {client.cameraEnabled && (
                                  <Flex
                                    position="absolute"
                                    top="-4px"
                                    right="-4px"
                                    style={{
                                      background: "var(--green-9)",
                                      borderRadius: "50%",
                                      padding: "2px",
                                    }}
                                  >
                                    <MdVideocam size={10} color="white" />
                                  </Flex>
                                )}
                                {client.screenShareEnabled && (
                                  <Flex
                                    position="absolute"
                                    top="-4px"
                                    left="-4px"
                                    style={{
                                      background: "var(--blue-9)",
                                      borderRadius: "50%",
                                      padding: "2px",
                                    }}
                                  >
                                    <MdScreenShare size={10} color="white" />
                                  </Flex>
                                )}
                                {isUserConnecting && (
                                  <Flex
                                    position="absolute"
                                    align="center"
                                    justify="center"
                                    style={{
                                      top: 0, left: 0, right: 0, bottom: 0,
                                      background: "var(--color-panel-translucent)",
                                      borderRadius: "50%",
                                    }}
                                  >
                                    <SkeletonBase width="24px" height="24px" borderRadius="50%" />
                                  </Flex>
                                )}
                                {(client.isMuted || client.isDeafened || client.isAFK) && (
                                  <Flex
                                    position="absolute"
                                    bottom="-4px"
                                    right="-4px"
                                    gap="1"
                                    style={{
                                      background: "var(--gray-3)",
                                      borderRadius: "var(--radius-4)",
                                      padding: "2px 4px",
                                      border: "1px solid var(--gray-6)",
                                    }}
                                  >
                                    {client.isDeafened ? (
                                      <MdVolumeOff size={12} color="var(--red-9)" />
                                    ) : client.isMuted ? (
                                      <MdMicOff size={12} color="var(--red-9)" />
                                    ) : null}
                                    {client.isAFK && (
                                      <Text size="1" weight="bold" color="orange">AFK</Text>
                                    )}
                                  </Flex>
                                )}
                              </Flex>
                              <Flex direction="column" align="center" gap="1">
                                <Text size={isPresentationMode ? "1" : undefined}>{client.nickname}</Text>
                                {!isPresentationMode && showPeerLatency && (() => {
                                  const stats = isSelf ? selfLatency : peerLatency?.[id];
                                  const oneWay = isSelf ? stats?.estimatedOneWayMs : (stats as PeerLatencyStats | undefined)?.estimatedOneWayMs;
                                  const rtt = isSelf ? stats?.networkRttMs : (stats as PeerLatencyStats | undefined)?.networkRttMs;
                                  const jitter = isSelf ? stats?.jitterMs : (stats as PeerLatencyStats | undefined)?.jitterMs;
                                  const codecStr = isSelf ? stats?.codec : (stats as PeerLatencyStats | undefined)?.codec;
                                  if (oneWay == null) return null;
                                  const tooltipParts = [`RTT: ${rtt?.toFixed(0) ?? "—"}ms`, `Jitter: ${jitter?.toFixed(1) ?? "—"}ms`, codecStr ?? "—"];
                                  if (isSelf && selfLatency.remoteAddress) tooltipParts.push(`ICE: ${selfLatency.remoteAddress}`);
                                  return (
                                    <Tooltip content={tooltipParts.join(" · ")}>
                                      <Text
                                        size="1"
                                        style={{
                                          color: latencyColor(oneWay),
                                          fontVariantNumeric: "tabular-nums",
                                          cursor: "default",
                                        }}
                                      >
                                        {Math.round(oneWay)}ms
                                      </Text>
                                    </Tooltip>
                                  );
                                })()}
                              </Flex>
                            </Flex>
                          );
                        })()}
                            </UserContextMenu>
                          </SortableParticipant>
                        </motion.div>
                      );
                    })}
                </AnimatePresence>
              </div>
            </SortableContext>
          </DndContext>

          {/* Controls overlay (only in default grid mode) */}
          {!isPresentationMode && (
            <AnimatePresence>
              {currentServerConnected && (
                <motion.div
                  style={{
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    right: 0,
                    display: "flex",
                    justifyContent: "center",
                    padding: "12px",
                    pointerEvents: "none",
                  }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <div style={{ pointerEvents: "auto" }}>
                    <Controls onDisconnect={onDisconnect} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </div>

        {/* Controls below participant strip in presentation mode */}
        {isPresentationMode && currentServerConnected && (
          <Flex justify="center" py="2" flexShrink="0">
            <Controls onDisconnect={onDisconnect} />
          </Flex>
        )}
      </Flex>
    </motion.div>
  );
};
