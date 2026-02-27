import { AlertDialog, Button, Card, Flex, Select, Text, TextField } from "@radix-ui/themes";
import { useState } from "react";
import toast from "react-hot-toast";
import type { Socket } from "socket.io-client";

import { useSocketEvent } from "../hooks/useSocketEvent";
import { useSockets } from "../hooks/useSockets";

interface ReplaceSuccessPayload {
  targetServerUserId: string;
  oldGrytUserId: string;
  newGrytUserId: string;
  ownerUpdated: boolean;
}

export function ServerUserReplaceTab({
  host,
  socket,
  accessToken,
}: {
  host: string;
  socket?: Socket;
  accessToken: string | null;
}) {
  const { memberLists, requestMemberList } = useSockets();
  const members = host ? memberLists[host] || [] : [];

  const [targetServerUserId, setTargetServerUserId] = useState("");
  const [newGrytUserId, setNewGrytUserId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const refresh = () => {
    if (!socket?.connected) return;
    requestMemberList(host);
  };

  useSocketEvent<ReplaceSuccessPayload>(socket, "server:user:replace:success", (payload) => {
    setSubmitting(false);
    toast.success(
      `Replaced identity for ${payload.targetServerUserId}.` +
        (payload.ownerUpdated ? " Server ownership was transferred." : ""),
    );
    setTargetServerUserId("");
    setNewGrytUserId("");
    refresh();
  });

  const handleReplace = () => {
    if (!socket?.connected) return toast.error("Not connected to the server yet.");
    if (!accessToken) return toast.error("Join the server first.");
    if (!targetServerUserId) return toast.error("Select a user to replace.");
    if (!newGrytUserId.trim()) return toast.error("Enter the new Gryt User ID.");

    setSubmitting(true);
    socket.emit("server:user:replace", {
      accessToken,
      targetServerUserId,
      newGrytUserId: newGrytUserId.trim(),
    });

    const timeout = setTimeout(() => setSubmitting(false), 10_000);
    const cleanup = () => clearTimeout(timeout);
    socket.once("server:user:replace:success", cleanup);
    socket.once("server:error", () => {
      setSubmitting(false);
      cleanup();
    });
  };

  const selectedMember = members.find((m) => m.serverUserId === targetServerUserId);

  return (
    <Flex direction="column" gap="4">
      <Text size="2" color="gray">
        Re-map a user&apos;s Keycloak identity (gryt_user_id) while keeping their server user ID, messages, roles, and
        all other data intact. This is useful when a user re-registers and gets a new Keycloak account.
      </Text>

      <Card>
        <Flex direction="column" gap="3">
          <label>
            <Text size="2" weight="bold" mb="1" as="p">
              Old user (current member)
            </Text>
            <Select.Root value={targetServerUserId} onValueChange={setTargetServerUserId}>
              <Select.Trigger placeholder="Select a member…" style={{ width: "100%" }} />
              <Select.Content>
                {members.map((m) => (
                  <Select.Item key={m.serverUserId} value={m.serverUserId}>
                    {m.nickname} — {m.serverUserId}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select.Root>
          </label>

          <label>
            <Text size="2" weight="bold" mb="1" as="p">
              New Gryt User ID
            </Text>
            <TextField.Root
              placeholder="Paste new Keycloak sub / gryt_user_id"
              value={newGrytUserId}
              onChange={(e) => setNewGrytUserId(e.target.value)}
            />
            <Text size="1" color="gray" mt="1" as="p">
              The Keycloak subject ID from the new account that should take over this server identity.
            </Text>
          </label>

          <Flex justify="end" mt="2">
            <AlertDialog.Root>
              <AlertDialog.Trigger>
                <Button color="red" disabled={submitting || !targetServerUserId || !newGrytUserId.trim()}>
                  {submitting ? "Replacing…" : "Replace identity"}
                </Button>
              </AlertDialog.Trigger>
              <AlertDialog.Content maxWidth="480px">
                <AlertDialog.Title>Replace user identity?</AlertDialog.Title>
                <AlertDialog.Description size="2">
                  This will permanently re-bind{" "}
                  <strong>{selectedMember?.nickname ?? targetServerUserId}</strong>&apos;s server identity to a new
                  Keycloak account. The old account will lose access and any active sessions will be revoked.
                </AlertDialog.Description>
                <Flex gap="3" mt="4" justify="end">
                  <AlertDialog.Cancel>
                    <Button variant="soft" color="gray">
                      Cancel
                    </Button>
                  </AlertDialog.Cancel>
                  <AlertDialog.Action>
                    <Button color="red" onClick={handleReplace} disabled={submitting}>
                      Confirm replace
                    </Button>
                  </AlertDialog.Action>
                </Flex>
              </AlertDialog.Content>
            </AlertDialog.Root>
          </Flex>
        </Flex>
      </Card>
    </Flex>
  );
}
