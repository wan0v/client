import { io } from "socket.io-client";

import { getServerWsBase } from "@/common";

export type JoinServerOnceRequest = {
  host: string;
  nickname?: string;
  identityToken?: string;
  inviteCode?: string;
};

export type JoinServerOnceSuccess = {
  accessToken: string;
  refreshToken?: string;
  nickname: string;
  avatarFileId?: string | null;
  isOwner?: boolean;
  setupRequired?: boolean;
};

export type JoinServerOnceError = {
  error: string;
  message?: string;
  retryAfterMs?: number;
  currentScore?: number;
  maxScore?: number;
  canReapply?: boolean;
};

export type JoinServerOnceResult =
  | { ok: true; joinInfo: JoinServerOnceSuccess }
  | { ok: false; error: JoinServerOnceError };

function errorFromConnectError(err: unknown): JoinServerOnceError {
  if (err instanceof Error) {
    return { error: "connect_error", message: err.message };
  }
  return { error: "connect_error", message: "Could not connect to the server." };
}

export async function joinServerOnce(
  req: JoinServerOnceRequest,
  opts?: { timeoutMs?: number }
): Promise<JoinServerOnceResult> {
  const timeoutMs = opts?.timeoutMs ?? 10_000;

  return await new Promise<JoinServerOnceResult>((resolve) => {
    const socket = io(getServerWsBase(req.host), {
      transports: ["websocket"],
      reconnection: false,
      timeout: timeoutMs,
    });

    let settled = false;
    const finish = (res: JoinServerOnceResult) => {
      if (settled) return;
      settled = true;
      try {
        socket.disconnect();
      } catch {
        // ignore
      }
      resolve(res);
    };

    const timer = setTimeout(() => {
      finish({
        ok: false,
        error: { error: "timeout", message: "Timed out connecting to the server." },
      });
    }, timeoutMs + 250);

    socket.on("connect", () => {
      socket.emit("server:join", {
        nickname: req.nickname,
        identityToken: req.identityToken,
        inviteCode: req.inviteCode,
      });
    });

    socket.on("server:joined", (joinInfo: JoinServerOnceSuccess) => {
      clearTimeout(timer);
      finish({ ok: true, joinInfo });
    });

    socket.on("server:error", (error: JoinServerOnceError) => {
      clearTimeout(timer);
      finish({ ok: false, error });
    });

    socket.on("connect_error", (err) => {
      clearTimeout(timer);
      finish({ ok: false, error: errorFromConnectError(err) });
    });
  });
}

