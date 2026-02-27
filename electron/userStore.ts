import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "fs";
import { join } from "path";

let usersDir: string | null = null;

export function initUserStore(userDataPath: string): void {
  usersDir = join(userDataPath, "users");
  if (!existsSync(usersDir)) {
    mkdirSync(usersDir, { recursive: true });
  }
}

function userFilePath(userId: string): string {
  if (!usersDir) throw new Error("User store not initialised");
  const safe = userId.replace(/[^a-zA-Z0-9_-]/g, "_");
  return join(usersDir, `${safe}.json`);
}

export function loadUser(userId: string): Record<string, unknown> {
  const filePath = userFilePath(userId);
  try {
    return JSON.parse(readFileSync(filePath, "utf8")) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function atomicWrite(filePath: string, data: Record<string, unknown>): void {
  const tmp = filePath + ".tmp";
  writeFileSync(tmp, JSON.stringify(data, null, 2), "utf8");
  renameSync(tmp, filePath);
}

export function saveUser(userId: string, data: Record<string, unknown>): void {
  atomicWrite(userFilePath(userId), data);
}

export function patchUser(userId: string, key: string, value: unknown): void {
  const data = loadUser(userId);
  data[key] = value;
  atomicWrite(userFilePath(userId), data);
}
