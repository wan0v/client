import { AlertDialog, Button, Flex } from "@radix-ui/themes";

import type { Channel, SidebarItem } from "@/settings/src/types/server";

interface PendingUser {
  id: string;
  nickname: string;
}

interface ServerConfirmDialogsProps {
  pendingDeleteItem: SidebarItem | null;
  channelById: Map<string, Channel>;
  cancelDelete: () => void;
  confirmDelete: () => void;
  pendingDisconnectUser: PendingUser | null;
  setPendingDisconnectUser: (v: PendingUser | null) => void;
  onDisconnectUser: (id: string) => void;
  pendingKickUser: PendingUser | null;
  setPendingKickUser: (v: PendingUser | null) => void;
  onKickUser: (id: string) => void;
  pendingBanUser: PendingUser | null;
  setPendingBanUser: (v: PendingUser | null) => void;
  onBanUser: (id: string) => void;
}

export const ServerConfirmDialogs = ({
  pendingDeleteItem, channelById, cancelDelete, confirmDelete,
  pendingDisconnectUser, setPendingDisconnectUser, onDisconnectUser,
  pendingKickUser, setPendingKickUser, onKickUser,
  pendingBanUser, setPendingBanUser, onBanUser,
}: ServerConfirmDialogsProps) => (
  <>
    <AlertDialog.Root open={!!pendingDeleteItem} onOpenChange={(open) => { if (!open) cancelDelete(); }}>
      <AlertDialog.Content maxWidth="420px">
        <AlertDialog.Title>Delete {pendingDeleteItem?.kind === "channel" ? "channel" : "item"}?</AlertDialog.Title>
        <AlertDialog.Description size="2">
          {pendingDeleteItem?.kind === "channel"
            ? `This will permanently delete the channel "${channelById.get(pendingDeleteItem.channelId ?? pendingDeleteItem.id)?.name || "this channel"}" and all associated data. This action cannot be undone.`
            : "This will remove this item from the sidebar. This action cannot be undone."}
        </AlertDialog.Description>
        <Flex gap="3" mt="4" justify="end">
          <AlertDialog.Cancel>
            <Button variant="soft" color="gray">Cancel</Button>
          </AlertDialog.Cancel>
          <AlertDialog.Action>
            <Button variant="solid" color="red" onClick={confirmDelete}>Delete</Button>
          </AlertDialog.Action>
        </Flex>
      </AlertDialog.Content>
    </AlertDialog.Root>

    <AlertDialog.Root open={!!pendingDisconnectUser} onOpenChange={(open) => { if (!open) setPendingDisconnectUser(null); }}>
      <AlertDialog.Content maxWidth="420px">
        <AlertDialog.Title>Disconnect {pendingDisconnectUser?.nickname}?</AlertDialog.Title>
        <AlertDialog.Description size="2">
          This will disconnect {pendingDisconnectUser?.nickname} from the voice channel.
        </AlertDialog.Description>
        <Flex gap="3" mt="4" justify="end">
          <AlertDialog.Cancel>
            <Button variant="soft" color="gray">Cancel</Button>
          </AlertDialog.Cancel>
          <AlertDialog.Action>
            <Button variant="solid" color="red" onClick={() => { if (pendingDisconnectUser) { onDisconnectUser(pendingDisconnectUser.id); setPendingDisconnectUser(null); } }}>Disconnect</Button>
          </AlertDialog.Action>
        </Flex>
      </AlertDialog.Content>
    </AlertDialog.Root>

    <AlertDialog.Root open={!!pendingKickUser} onOpenChange={(open) => { if (!open) setPendingKickUser(null); }}>
      <AlertDialog.Content maxWidth="420px">
        <AlertDialog.Title>Kick {pendingKickUser?.nickname}?</AlertDialog.Title>
        <AlertDialog.Description size="2">
          Are you sure you want to kick {pendingKickUser?.nickname} from the server?
        </AlertDialog.Description>
        <Flex gap="3" mt="4" justify="end">
          <AlertDialog.Cancel>
            <Button variant="soft" color="gray">Cancel</Button>
          </AlertDialog.Cancel>
          <AlertDialog.Action>
            <Button variant="solid" color="red" onClick={() => { if (pendingKickUser) { onKickUser(pendingKickUser.id); setPendingKickUser(null); } }}>Kick</Button>
          </AlertDialog.Action>
        </Flex>
      </AlertDialog.Content>
    </AlertDialog.Root>

    <AlertDialog.Root open={!!pendingBanUser} onOpenChange={(open) => { if (!open) setPendingBanUser(null); }}>
      <AlertDialog.Content maxWidth="420px">
        <AlertDialog.Title>Ban {pendingBanUser?.nickname}?</AlertDialog.Title>
        <AlertDialog.Description size="2">
          Are you sure you want to ban {pendingBanUser?.nickname}? They will not be able to rejoin.
        </AlertDialog.Description>
        <Flex gap="3" mt="4" justify="end">
          <AlertDialog.Cancel>
            <Button variant="soft" color="gray">Cancel</Button>
          </AlertDialog.Cancel>
          <AlertDialog.Action>
            <Button variant="solid" color="red" onClick={() => { if (pendingBanUser) { onBanUser(pendingBanUser.id); setPendingBanUser(null); } }}>Ban</Button>
          </AlertDialog.Action>
        </Flex>
      </AlertDialog.Content>
    </AlertDialog.Root>
  </>
);
