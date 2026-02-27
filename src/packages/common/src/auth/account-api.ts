import { getGrytConfig } from "../../../../config";
import { getValidIdentityToken } from "./keycloak";

export interface KeycloakCredential {
  id: string;
  type: string;
  userLabel: string;
  createdDate: number;
  credentialData?: string;
}

function getAccountApiBase(): string {
  const cfg = getGrytConfig();
  return `${cfg.GRYT_OIDC_ISSUER}/account`;
}

async function accountFetch(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const token = await getValidIdentityToken();
  if (!token) throw new Error("Not authenticated");

  const res = await fetch(`${getAccountApiBase()}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      ...init?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Account API ${init?.method ?? "GET"} ${path} failed (${res.status}): ${body}`,
    );
  }

  return res;
}

export async function fetchCredentials(): Promise<KeycloakCredential[]> {
  const res = await accountFetch("/credentials");
  return res.json();
}

export async function deleteCredential(id: string): Promise<void> {
  await accountFetch(`/credentials/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export async function updateCredentialLabel(
  id: string,
  label: string,
): Promise<void> {
  await accountFetch(`/credentials/${encodeURIComponent(id)}/label`, {
    method: "PUT",
    headers: { "Content-Type": "text/plain" },
    body: label,
  });
}
