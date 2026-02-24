import { Button, Flex, Spinner, Text } from "@radix-ui/themes";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { MdRefresh, MdWifiOff } from "react-icons/md";

import { useIsCompact, useIsMobile } from "@/mobile";
import { useSettings } from "@/settings";
import { Channel } from "@/settings/src/types/server";
import { useSFU } from "@/webRTC";

import { useAdminActions } from "../hooks/useAdminActions";
import { useChat } from "../hooks/useChat";
import { useLatencyReporting } from "../hooks/useLatencyReporting";
import { usePeerLatency } from "../hooks/usePeerLatency";
import { useServerManagement } from "../hooks/useServerManagement";
import { useServerState } from "../hooks/useServerState";
import { SIDEBAR_HOVER_PX, SIDEBAR_WIDTH_PX, useSidebarHover, useVoiceResize } from "../hooks/useServerViewLayout";
import { useSidebarEditor } from "../hooks/useSidebarEditor";
import { useSockets } from "../hooks/useSockets";
import { ChatView } from "./ChatView";
import { MemberSidebarPanel } from "./MemberSidebarPanel";
import { MobileServerView } from "./MobileServerView";
import { ReportsPanel } from "./ReportsPanel";
import { ServerConfirmDialogs } from "./ServerConfirmDialogs";
import { ServerLoadingStates } from "./ServerLoadingStates";
import { ServerSidebar } from "./ServerSidebar";
import { SidebarEditDialog } from "./SidebarEditDialog";
import { VoiceView } from "./VoiceView";

export const ServerView = () => {
  const isMobile = useIsMobile();
  const isCompact = useIsCompact();
  const {
    showVoiceView, setShowVoiceView, nickname, setShowSettings, setSettingsTab,
    inputMode, setInputMode, rnnoiseEnabled, setRnnoiseEnabled,
    eSportsModeEnabled, setESportsModeEnabled, noiseGate, setNoiseGate,
    pinChannelsSidebar, setPinChannelsSidebar,
    pinMembersSidebar, setPinMembersSidebar,
  } = useSettings();
  const { currentlyViewingServer, setShowRemoveServer, setLastSelectedChannelForServer } = useServerManagement();
  const { connect, currentServerConnected, isConnected, isConnecting, videoStreams, streamSources } = useSFU();
  const { serverDetailsList, clients, memberLists, serverProfiles } = useSockets();

  const {
    clientsSpeaking, voiceWidth, setVoiceWidth, userVoiceWidth, setUserVoiceWidth,
    selectedChannelId, setSelectedChannelId,
    handleVoiceDisconnect, setPendingChannelId, currentChannelId,
    currentConnection, accessToken, activeConversationId, serverFailure, hasTimedOut,
    currentConnectionStatus, reconnectServer,
  } = useServerState();

  const {
    editDialogOpen, setEditDialogOpen,
    setSelectedSidebarItemId, selectedSidebarItem, effectiveSidebarItems,
    sheetChannelName, setSheetChannelName, sheetChannelIsVoice,
    setSheetChannelIsVoice, sheetRequirePtt, setSheetRequirePtt,
    sheetDisableRnnoise, setSheetDisableRnnoise, sheetMaxBitrate,
    setSheetMaxBitrate, sheetEsportsMode, setSheetEsportsMode,
    sheetTextInVoice, setSheetTextInVoice,
    sheetSpacerHeight, setSheetSpacerHeight,
    sheetSeparatorLabel, setSheetSeparatorLabel, closeEditDialog,
    reorderSidebar, insertFromPalette, pendingDeleteItem,
    requestDeleteSidebarItem, cancelDelete, confirmDelete, saveSelectedSidebarItem,
  } = useSidebarEditor({ currentlyViewingServer, currentConnection, accessToken, serverDetailsList });

  useLatencyReporting(currentConnection);
  const peerLatency = usePeerLatency(currentConnection);

  const saveSidebarRef = useRef(saveSelectedSidebarItem);
  saveSidebarRef.current = saveSelectedSidebarItem;
  const saveSidebarTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debouncedSaveSidebar = useCallback(() => {
    if (saveSidebarTimerRef.current) clearTimeout(saveSidebarTimerRef.current);
    saveSidebarTimerRef.current = setTimeout(() => {
      saveSidebarTimerRef.current = null;
      saveSidebarRef.current();
    }, 600);
  }, []);
  const flushSaveSidebar = useCallback(() => {
    if (saveSidebarTimerRef.current) clearTimeout(saveSidebarTimerRef.current);
    saveSidebarTimerRef.current = null;
    saveSidebarRef.current();
  }, []);

  const {
    voiceFocused, setVoiceFocused,
    isDraggingResize,
    voiceContainerRef, voiceMaxWidth,
    handleResizeMouseDown,
  } = useVoiceResize({ voiceWidth, userVoiceWidth, setVoiceWidth, setUserVoiceWidth, setShowVoiceView });

  const {
    leftSidebarOpen, rightSidebarOpen,
    leftSidebarContentRef, rightSidebarContentRef,
    openLeftSidebar, closeLeftSidebar,
    openRightSidebar, closeRightSidebar,
  } = useSidebarHover({ pinChannelsSidebar, pinMembersSidebar, isDraggingResize });

  const compactAutoHiddenRef = useRef(false);
  useEffect(() => {
    if (isCompact && showVoiceView) {
      compactAutoHiddenRef.current = true;
      setShowVoiceView(false);
    } else if (!isCompact && compactAutoHiddenRef.current) {
      compactAutoHiddenRef.current = false;
      setShowVoiceView(true);
    }
  }, [isCompact, setShowVoiceView, showVoiceView]);

  const mediaAutoShownRef = useRef(false);
  const serverClients = currentlyViewingServer ? clients[currentlyViewingServer.host] : undefined;
  const anyMediaActive = useMemo(() => {
    if (!serverClients || !currentChannelId || !isConnected) return false;
    return Object.values(serverClients).some(
      (c) => c.voiceChannelId === currentChannelId && (c.screenShareEnabled || c.cameraEnabled),
    );
  }, [serverClients, currentChannelId, isConnected]);

  useEffect(() => {
    if (!isConnected) {
      mediaAutoShownRef.current = false;
      return;
    }
    if (anyMediaActive && !showVoiceView) {
      mediaAutoShownRef.current = true;
      setShowVoiceView(true);
    } else if (!anyMediaActive && showVoiceView && mediaAutoShownRef.current) {
      mediaAutoShownRef.current = false;
      setShowVoiceView(false);
    }
  }, [anyMediaActive, isConnected, showVoiceView, setShowVoiceView]);

  const prevSettingsRef = useRef<{ inputMode: string; rnnoiseEnabled: boolean; eSportsModeEnabled: boolean; noiseGate: number } | null>(null);

  const applyChannelSettings = useCallback((channel: Channel) => {
    const needsPtt = channel.requirePushToTalk && inputMode !== "push_to_talk";
    const needsNoRnnoise = channel.disableRnnoise && rnnoiseEnabled;
    const needsEsports = channel.eSportsMode && !eSportsModeEnabled;
    if (!needsPtt && !needsNoRnnoise && !needsEsports) return;

    prevSettingsRef.current = { inputMode, rnnoiseEnabled, eSportsModeEnabled, noiseGate };
    const messages: string[] = [];
    if (needsEsports) {
      setESportsModeEnabled(true);
      messages.push("eSports mode activated");
    } else {
      if (needsPtt) {
        setInputMode("push_to_talk");
        messages.push("Push to Talk enabled");
      }
      if (needsNoRnnoise) {
        setRnnoiseEnabled(false);
        messages.push("RNNoise disabled");
      }
    }
    toast(`Channel rules applied: ${messages.join(", ")}`, { icon: "⚡" });
  }, [inputMode, rnnoiseEnabled, eSportsModeEnabled, noiseGate, setInputMode, setRnnoiseEnabled, setESportsModeEnabled]);

  const restoreChannelSettings = useCallback(() => {
    if (!prevSettingsRef.current) return;
    const prev = prevSettingsRef.current;
    setESportsModeEnabled(prev.eSportsModeEnabled);
    setInputMode(prev.inputMode as "voice_activity" | "push_to_talk");
    setRnnoiseEnabled(prev.rnnoiseEnabled);
    setNoiseGate(prev.noiseGate);
    prevSettingsRef.current = null;
    toast("Settings restored to your defaults", { icon: "↩" });
  }, [setInputMode, setRnnoiseEnabled, setESportsModeEnabled, setNoiseGate]);

  useEffect(() => {
    if (!isConnected) restoreChannelSettings();
  }, [isConnected, restoreChannelSettings]);

  const {
    pendingDisconnectUser, setPendingDisconnectUser,
    pendingKickUser, setPendingKickUser,
    pendingBanUser, setPendingBanUser,
    handleDisconnectUser, handleKickUser, handleBanUser,
    handleServerMuteUser, handleServerDeafenUser, handleChangeRole,
    requestDisconnectUser, requestKickUser, requestBanUser,
  } = useAdminActions({ currentConnection, currentlyViewingServer, accessToken, memberLists });

  const currentServerUserId = currentlyViewingServer && currentConnection?.id
    ? clients[currentlyViewingServer.host]?.[currentConnection.id]?.serverUserId
    : undefined;

  const {
    chatMessages, canSend, sendChat, editMessage, isLoadingMessages,
    isRateLimited, rateLimitCountdown, isVoiceChannelTextChat,
    canViewVoiceChannelText, activeChannelName, restoreText, clearRestoreText,
    fetchOlderMessages, isLoadingOlder, hasOlderMessages,
  } = useChat({
    currentConnection, activeConversationId, currentlyViewingServer,
    currentChannelId, isConnected, serverDetailsList, nickname,
    currentUserId: currentServerUserId,
  });

  const handleEditItem = useCallback((item: { id: string }) => {
    setSelectedSidebarItemId(item.id);
    setEditDialogOpen(true);
  }, [setSelectedSidebarItemId, setEditDialogOpen]);

  const handleMoveItem = useCallback((item: { id: string }, direction: "up" | "down") => {
    const ids = effectiveSidebarItems.map((i) => i.id);
    const idx = ids.indexOf(item.id);
    if (idx < 0) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= ids.length) return;
    [ids[idx], ids[swapIdx]] = [ids[swapIdx], ids[idx]];
    reorderSidebar(ids);
  }, [effectiveSidebarItems, reorderSidebar]);

  const handleAddItem = useCallback((kind: string) => {
    insertFromPalette(kind, effectiveSidebarItems.length);
  }, [insertFromPalette, effectiveSidebarItems]);

  const [reportsOpen, setReportsOpen] = useState(false);
  const [pendingReportCount, setPendingReportCount] = useState(0);

  const currentRole = currentlyViewingServer
    ? serverDetailsList[currentlyViewingServer.host]?.server_info?.role
    : undefined;
  const isAdmin = currentRole === "owner" || currentRole === "admin";

  useEffect(() => {
    if (!currentConnection) return;
    const onReportsList = (payload: { reports: Array<unknown> }) => {
      setPendingReportCount(payload.reports?.length ?? 0);
    };
    currentConnection.on("reports:list", onReportsList);
    if (isAdmin && accessToken) {
      currentConnection.emit("reports:list", { accessToken });
    }
    return () => { currentConnection.off("reports:list", onReportsList); };
  }, [currentConnection, isAdmin, accessToken]);

  const memberListMap = useMemo(() => {
    const members = currentlyViewingServer ? memberLists[currentlyViewingServer.host] : undefined;
    if (!members) return {};
    const map: Record<string, { nickname: string; serverUserId: string; avatarFileId?: string | null }> = {};
    for (const member of members) {
      map[member.serverUserId] = { nickname: member.nickname, serverUserId: member.serverUserId, avatarFileId: member.avatarFileId };
    }
    return map;
  }, [currentlyViewingServer, memberLists]);

  if (!currentlyViewingServer) return null;
  const serverDetails = serverDetailsList[currentlyViewingServer.host];
  const serverNickname = serverProfiles[currentlyViewingServer.host]?.nickname || nickname;
  const channelById = new Map((serverDetails?.channels || []).map((c) => [c.id, c]));
  if (!serverDetails) {
    return (
      <ServerLoadingStates
        serverFailure={serverFailure}
        hasTimedOut={hasTimedOut}
        connectionStatus={currentConnectionStatus}
        onReconnect={() => currentlyViewingServer && reconnectServer(currentlyViewingServer.host)}
      />
    );
  }

  const isServerUnreachable = currentConnectionStatus === "disconnected" || currentConnectionStatus === "reconnecting";
  const isConnectedToVoiceOnThisServer = isConnected && currentServerConnected === currentlyViewingServer.host;
  const currentUserRole = serverDetails?.server_info?.role;
  const canManage = currentUserRole === "owner" || currentUserRole === "admin";
  const currentAdminActions = canManage ? {
    onDisconnectUser: requestDisconnectUser,
    onKickUser: requestKickUser,
    onBanUser: requestBanUser,
    onServerMuteUser: handleServerMuteUser,
    onServerDeafenUser: handleServerDeafenUser,
    onChangeRole: currentUserRole === "owner" ? handleChangeRole : undefined,
  } : undefined;

  const handleChannelClick = (channel: Channel) => {
    switch (channel.type) {
      case "voice": {
        const isAlreadyConnectedToThis =
          isConnected && currentServerConnected === currentlyViewingServer.host && currentChannelId === channel.id;

        if (isAlreadyConnectedToThis) {
          mediaAutoShownRef.current = false;
          if (selectedChannelId !== channel.id && channel.textInVoice) {
            setSelectedChannelId(channel.id);
          }
          setShowVoiceView(!showVoiceView);
          return;
        }

        if (isConnecting && currentChannelId === channel.id) {
          mediaAutoShownRef.current = false;
          if (channel.textInVoice) {
            setSelectedChannelId(channel.id);
          }
          setShowVoiceView(!showVoiceView);
          return;
        }

        setPendingChannelId(null);
        applyChannelSettings(channel);
        mediaAutoShownRef.current = false;
        setShowVoiceView(false);
        connect(channel.id, channel.eSportsMode, channel.maxBitrate).catch((error) => {
          console.error("SFU connection failed:", error);
          if (error instanceof Error && error.message.includes("Microphone not available")) {
            setPendingChannelId(channel.id);
            setSettingsTab("audio");
            setShowSettings(true);
            toast.error("No microphone selected. Please choose a device in Settings → Audio.");
          } else if (error instanceof Error) {
            toast.error(error.message);
          } else {
            toast.error("Failed to connect to voice channel");
          }
        });
        break;
      }
      case "text":
        setSelectedChannelId(channel.id);
        if (currentlyViewingServer) {
          setLastSelectedChannelForServer(currentlyViewingServer.host, channel.id);
        }
        break;
    }
  };

  const onOpenSettings = () => {
    window.dispatchEvent(new CustomEvent("server_settings_open", {
      detail: { host: currentlyViewingServer.host },
    }));
  };

  return (
    <>
      {isDraggingResize && (
        <div style={{ position: "fixed", inset: 0, cursor: "grabbing", zIndex: 9999 }} />
      )}
      <Flex width="100%" height="100%" gap="4" direction="column">
        {isServerUnreachable && (
          <Flex
            align="center"
            gap="3"
            px="3"
            py="2"
            style={{
              flexShrink: 0,
              borderRadius: "var(--radius-5)",
              background: currentConnectionStatus === "reconnecting" ? "var(--orange-a3)" : "var(--red-a3)",
              border: `1px solid ${currentConnectionStatus === "reconnecting" ? "var(--orange-a5)" : "var(--red-a5)"}`,
            }}
          >
            {currentConnectionStatus === "reconnecting"
              ? <Spinner size="1" />
              : <MdWifiOff size={14} color="var(--red-9)" style={{ flexShrink: 0 }} />}
            <Text size="2" weight="medium" style={{ flex: 1 }}>
              {currentConnectionStatus === "reconnecting" ? "Reconnecting to server..." : "Server is unreachable"}
            </Text>
            {currentConnectionStatus === "disconnected" && (
              <Button size="1" variant="soft" style={{ flexShrink: 0 }} onClick={() => reconnectServer(currentlyViewingServer.host)}>
                <MdRefresh size={12} />
                Reconnect
              </Button>
            )}
          </Flex>
        )}
        {isMobile ? (
          <MobileServerView
            serverName={serverDetailsList[currentlyViewingServer.host]?.server_info?.name || currentlyViewingServer?.name}
            serverRole={serverDetailsList[currentlyViewingServer.host]?.server_info?.role}
            isServerUnreachable={isServerUnreachable}
            isConnectedToVoiceOnThisServer={isConnectedToVoiceOnThisServer}
            onOpenSettings={onOpenSettings}
            onOpenReports={() => setReportsOpen(true)}
            pendingReportCount={pendingReportCount}
            onLeave={() => setShowRemoveServer(currentlyViewingServer.host)}
            channels={serverDetailsList[currentlyViewingServer.host]?.channels || []}
            sidebarItems={effectiveSidebarItems}
            serverHost={currentlyViewingServer.host}
            clients={clients[currentlyViewingServer.host] || {}}
            members={memberLists[currentlyViewingServer.host] || []}
            currentChannelId={currentChannelId}
            currentServerConnected={currentServerConnected}
            showVoiceView={showVoiceView}
            isConnecting={isConnecting}
            currentConnectionId={currentConnection?.id}
            selectedChannelId={selectedChannelId}
            onChannelClick={handleChannelClick}
            clientsSpeaking={clientsSpeaking}
            canManage={canManage}
            onEditItem={handleEditItem}
            onDeleteItem={requestDeleteSidebarItem}
            onMoveItem={handleMoveItem}
            onReorder={reorderSidebar}
            onAddItem={handleAddItem}
            onDisconnectUser={canManage ? requestDisconnectUser : undefined}
            currentUserRole={currentUserRole}
            adminActions={currentAdminActions}
            chatMessages={chatMessages}
            canSend={canSend}
            sendChat={sendChat}
            editMessage={editMessage}
            currentUserId={currentServerUserId}
            channelName={activeChannelName}
            currentUserNickname={serverNickname}
            socketConnection={currentConnection}
            memberList={memberListMap}
            isRateLimited={isRateLimited}
            rateLimitCountdown={rateLimitCountdown}
            canViewVoiceChannelText={canViewVoiceChannelText}
            isVoiceChannelTextChat={isVoiceChannelTextChat}
            isLoadingMessages={isLoadingMessages}
            restoreText={restoreText}
            clearRestoreText={clearRestoreText}
            canDeleteAny={serverDetails?.server_info?.role === "owner"}
            maxFileSize={serverDetails?.server_info?.upload_max_bytes}
            onLoadOlder={fetchOlderMessages}
            isLoadingOlder={isLoadingOlder}
            hasOlderMessages={hasOlderMessages}
            voiceWidth={voiceWidth}
            clientsForHost={clients[currentlyViewingServer.host] || {}}
            onVoiceDisconnect={handleVoiceDisconnect}
            peerLatency={peerLatency}
            videoStreams={videoStreams}
            streamSources={streamSources}
          />
        ) : (
          <Flex
            width="100%"
            style={{
              flex: 1,
              overflow: "hidden",
              ...(isServerUnreachable && !isConnectedToVoiceOnThisServer && {
                opacity: 0.5,
                pointerEvents: "none" as const,
              }),
              transition: "opacity 0.3s ease",
            }}
            gap="4"
          >
            <ServerSidebar
              sidebarOpen={leftSidebarOpen}
              sidebarWidthPx={SIDEBAR_WIDTH_PX}
              hoverPx={SIDEBAR_HOVER_PX}
              contentRef={leftSidebarContentRef}
              isUnreachableWhileConnected={isConnectedToVoiceOnThisServer && isServerUnreachable}
              onMouseEnter={openLeftSidebar}
              onMouseLeave={closeLeftSidebar}
              serverName={serverDetailsList[currentlyViewingServer.host]?.server_info?.name || currentlyViewingServer?.name}
              serverRole={serverDetailsList[currentlyViewingServer.host]?.server_info?.role}
              pinned={pinChannelsSidebar}
              onTogglePinned={() => setPinChannelsSidebar(!pinChannelsSidebar)}
              onOpenSettings={onOpenSettings}
              onOpenReports={() => setReportsOpen(true)}
              pendingReportCount={pendingReportCount}
              onLeave={() => setShowRemoveServer(currentlyViewingServer.host)}
              channels={serverDetailsList[currentlyViewingServer.host]?.channels || []}
              sidebarItems={effectiveSidebarItems}
              serverHost={currentlyViewingServer.host}
              clients={clients[currentlyViewingServer.host] || {}}
              members={memberLists[currentlyViewingServer.host] || []}
              currentChannelId={currentChannelId}
              currentServerConnected={currentServerConnected}
              showVoiceView={showVoiceView}
              isConnecting={isConnecting}
              currentConnectionId={currentConnection?.id}
              selectedChannelId={selectedChannelId}
              onChannelClick={handleChannelClick}
              clientsSpeaking={clientsSpeaking}
              canManage={canManage}
              onEditItem={handleEditItem}
              onDeleteItem={requestDeleteSidebarItem}
              onMoveItem={handleMoveItem}
              onReorder={reorderSidebar}
              onAddItem={handleAddItem}
              onDisconnectUser={canManage ? requestDisconnectUser : undefined}
              currentUserRole={currentUserRole}
              adminActions={currentAdminActions}
            />

            <Flex flexGrow="1" ref={voiceContainerRef}>
              <VoiceView
                showVoiceView={showVoiceView && !isCompact}
                voiceWidth={voiceFocused ? `${voiceMaxWidth}px` : voiceWidth}
                maxWidth={voiceMaxWidth}
                serverHost={currentlyViewingServer.host}
                currentServerConnected={currentServerConnected}
                currentChannelId={currentChannelId}
                clientsForHost={clients[currentlyViewingServer.host] || {}}
                members={memberLists[currentlyViewingServer.host] || []}
                clientsSpeaking={clientsSpeaking}
                isConnecting={isConnecting}
                currentConnectionId={currentConnection?.id}
                onDisconnect={handleVoiceDisconnect}
                peerLatency={peerLatency}
                onDisconnectUser={canManage ? requestDisconnectUser : undefined}
                isDragging={isDraggingResize}
                currentUserRole={currentUserRole}
                adminActions={currentAdminActions}
                videoStreams={videoStreams}
                streamSources={streamSources}
                onFocusChange={setVoiceFocused}
              />

              {!isCompact && !voiceFocused && (isDraggingResize || (showVoiceView && voiceWidth !== "0px")) && (
                <div
                  onMouseDown={handleResizeMouseDown}
                  style={{
                    width: "8px",
                    marginRight: "8px",
                    cursor: isDraggingResize ? "grabbing" : "grab",
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    userSelect: "none",
                  }}
                >
                  <div
                    style={{
                      width: "3px",
                      height: "40px",
                      borderRadius: "2px",
                      background: isDraggingResize ? "var(--accent-9)" : "var(--gray-6)",
                      transition: "background 0.15s",
                    }}
                  />
                </div>
              )}

              <div style={{
                display: "flex",
                flex: voiceFocused ? "0 0 320px" : 1,
                minWidth: 0,
                ...(isConnectedToVoiceOnThisServer && isServerUnreachable && {
                  opacity: 0.5,
                  pointerEvents: "none" as const,
                }),
                transition: "opacity 0.3s ease, flex 0.3s ease",
              }}>
                <ChatView
                  chatMessages={chatMessages}
                  conversationKey={activeConversationId}
                  canSend={canSend}
                  sendChat={sendChat}
                  editMessage={editMessage}
                  currentUserId={currentServerUserId}
                  channelName={activeChannelName}
                  currentUserNickname={serverNickname}
                  socketConnection={currentConnection}
                  serverHost={currentlyViewingServer.host}
                  memberList={memberListMap}
                  isRateLimited={isRateLimited}
                  rateLimitCountdown={rateLimitCountdown}
                  canViewVoiceChannelText={canViewVoiceChannelText}
                  isVoiceChannelTextChat={isVoiceChannelTextChat}
                  restoreText={restoreText}
                  clearRestoreText={clearRestoreText}
                  canDeleteAny={serverDetails?.server_info?.role === "owner"}
                  maxFileSize={serverDetails?.server_info?.upload_max_bytes}
                  onLoadOlder={fetchOlderMessages}
                  isLoadingOlder={isLoadingOlder}
                  hasOlderMessages={hasOlderMessages}
                  {...(isLoadingMessages !== undefined && { isLoadingMessages })}
                />
              </div>
            </Flex>

            <MemberSidebarPanel
              sidebarOpen={rightSidebarOpen}
              sidebarWidthPx={SIDEBAR_WIDTH_PX}
              hoverPx={SIDEBAR_HOVER_PX}
              contentRef={rightSidebarContentRef}
              isUnreachableWhileConnected={isConnectedToVoiceOnThisServer && isServerUnreachable}
              onMouseEnter={openRightSidebar}
              onMouseLeave={closeRightSidebar}
              members={memberLists[currentlyViewingServer.host] || []}
              currentConnectionId={currentConnection?.id}
              currentServerUserId={currentServerUserId}
              currentUserRole={currentUserRole}
              clientsSpeaking={clientsSpeaking}
              currentServerConnected={currentServerConnected}
              serverHost={currentlyViewingServer.host}
              adminActions={currentAdminActions}
              pinned={pinMembersSidebar}
              onTogglePinned={() => setPinMembersSidebar(!pinMembersSidebar)}
            />
          </Flex>
        )}
      </Flex>

      <SidebarEditDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        selectedSidebarItem={selectedSidebarItem}
        sheetChannelName={sheetChannelName}
        setSheetChannelName={setSheetChannelName}
        sheetChannelIsVoice={sheetChannelIsVoice}
        setSheetChannelIsVoice={setSheetChannelIsVoice}
        sheetRequirePtt={sheetRequirePtt}
        setSheetRequirePtt={setSheetRequirePtt}
        sheetDisableRnnoise={sheetDisableRnnoise}
        setSheetDisableRnnoise={setSheetDisableRnnoise}
        sheetMaxBitrate={sheetMaxBitrate}
        setSheetMaxBitrate={setSheetMaxBitrate}
        sheetEsportsMode={sheetEsportsMode}
        setSheetEsportsMode={setSheetEsportsMode}
        sheetTextInVoice={sheetTextInVoice}
        setSheetTextInVoice={setSheetTextInVoice}
        sheetSpacerHeight={sheetSpacerHeight}
        setSheetSpacerHeight={setSheetSpacerHeight}
        sheetSeparatorLabel={sheetSeparatorLabel}
        setSheetSeparatorLabel={setSheetSeparatorLabel}
        debouncedSaveSidebar={debouncedSaveSidebar}
        flushSaveSidebar={flushSaveSidebar}
        closeEditDialog={closeEditDialog}
      />

      <ServerConfirmDialogs
        pendingDeleteItem={pendingDeleteItem}
        channelById={channelById}
        cancelDelete={cancelDelete}
        confirmDelete={confirmDelete}
        pendingDisconnectUser={pendingDisconnectUser}
        setPendingDisconnectUser={setPendingDisconnectUser}
        onDisconnectUser={handleDisconnectUser}
        pendingKickUser={pendingKickUser}
        setPendingKickUser={setPendingKickUser}
        onKickUser={handleKickUser}
        pendingBanUser={pendingBanUser}
        setPendingBanUser={setPendingBanUser}
        onBanUser={handleBanUser}
      />

      <ReportsPanel
        isOpen={reportsOpen}
        onClose={() => setReportsOpen(false)}
        socket={currentConnection}
        serverHost={currentlyViewingServer.host}
        memberList={memberLists[currentlyViewingServer.host]}
      />
    </>
  );
};
