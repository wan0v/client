import { useCallback, useState } from "react";
import { Socket } from "socket.io-client";

import type { MemberInfo } from "../components/MemberSidebar";
import { emitAuthenticated } from "../utils/tokenManager";

interface PendingUser {
  id: string;
  nickname: string;
}

interface UseAdminActionsParams {
  currentConnection: Socket | null;
  currentlyViewingServer: { host: string; name: string } | null;
  accessToken: string | null;
  memberLists: Record<string, MemberInfo[] | undefined>;
}

export function useAdminActions({
  currentConnection, currentlyViewingServer, accessToken, memberLists,
}: UseAdminActionsParams) {
  const [pendingDisconnectUser, setPendingDisconnectUser] = useState<PendingUser | null>(null);
  const [pendingKickUser, setPendingKickUser] = useState<PendingUser | null>(null);
  const [pendingBanUser, setPendingBanUser] = useState<PendingUser | null>(null);

  const handleDisconnectUser = useCallback((targetServerUserId: string) => {
    if (!currentConnection || !currentlyViewingServer) return;
    emitAuthenticated(currentConnection, "voice:disconnect:user", { targetServerUserId }, currentlyViewingServer.host);
  }, [currentConnection, currentlyViewingServer]);

  const handleKickUser = useCallback((targetServerUserId: string) => {
    if (!currentConnection || !currentlyViewingServer) return;
    emitAuthenticated(currentConnection, "server:kick", { targetServerUserId }, currentlyViewingServer.host);
  }, [currentConnection, currentlyViewingServer]);

  const handleBanUser = useCallback((targetServerUserId: string) => {
    if (!currentConnection || !currentlyViewingServer) return;
    emitAuthenticated(currentConnection, "server:ban", { targetServerUserId }, currentlyViewingServer.host);
  }, [currentConnection, currentlyViewingServer]);

  const handleServerMuteUser = useCallback((targetServerUserId: string, muted: boolean) => {
    if (!currentConnection || !accessToken) return;
    currentConnection.emit("server:mute", { accessToken, targetServerUserId, muted });
  }, [currentConnection, accessToken]);

  const handleServerDeafenUser = useCallback((targetServerUserId: string, deafened: boolean) => {
    if (!currentConnection || !accessToken) return;
    currentConnection.emit("server:deafen", { accessToken, targetServerUserId, deafened });
  }, [currentConnection, accessToken]);

  const handleChangeRole = useCallback((targetServerUserId: string, role: string) => {
    if (!currentConnection || !accessToken) return;
    currentConnection.emit("server:roles:set", { accessToken, serverUserId: targetServerUserId, role });
  }, [currentConnection, accessToken]);

  const lookupNickname = useCallback((serverUserId: string) => {
    const members = currentlyViewingServer ? memberLists[currentlyViewingServer.host] : undefined;
    return members?.find((m) => m.serverUserId === serverUserId)?.nickname || "this user";
  }, [currentlyViewingServer, memberLists]);

  const requestDisconnectUser = useCallback((targetServerUserId: string) => {
    setPendingDisconnectUser({ id: targetServerUserId, nickname: lookupNickname(targetServerUserId) });
  }, [lookupNickname]);

  const requestKickUser = useCallback((targetServerUserId: string) => {
    setPendingKickUser({ id: targetServerUserId, nickname: lookupNickname(targetServerUserId) });
  }, [lookupNickname]);

  const requestBanUser = useCallback((targetServerUserId: string) => {
    setPendingBanUser({ id: targetServerUserId, nickname: lookupNickname(targetServerUserId) });
  }, [lookupNickname]);

  return {
    pendingDisconnectUser, setPendingDisconnectUser,
    pendingKickUser, setPendingKickUser,
    pendingBanUser, setPendingBanUser,
    handleDisconnectUser, handleKickUser, handleBanUser,
    handleServerMuteUser, handleServerDeafenUser, handleChangeRole,
    requestDisconnectUser, requestKickUser, requestBanUser,
  };
}
