/**
 * Download a file without triggering page navigation.
 *
 * Uses fetch + blob URL so the browser never starts navigating away from the
 * current page.  This prevents cross-origin download links from firing
 * `beforeunload` and tearing down WebSocket / WebRTC connections.
 *
 * Falls back to opening the URL in a new tab if the fetch fails (e.g. opaque
 * redirect, CORS issue).
 */
export async function triggerDownload(
  url: string,
  fileName?: string | null,
): Promise<void> {
  const downloadUrl = url.includes("?") ? `${url}&download=1` : `${url}?download=1`;

  try {
    const res = await fetch(downloadUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = fileName || "";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    URL.revokeObjectURL(blobUrl);
  } catch {
    window.open(downloadUrl, "_blank", "noopener,noreferrer");
  }
}
