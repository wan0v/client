interface DocumentPictureInPicture {
  requestWindow(options?: { width?: number; height?: number }): Promise<Window>;
}

declare global {
  interface Window {
    documentPictureInPicture?: DocumentPictureInPicture;
  }
}

export interface PopoutHandle {
  close: () => void;
  isOpen: () => boolean;
}

const PIN_SVG = [
  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"',
  ' stroke-width="2" stroke-linecap="round" stroke-linejoin="round">',
  '<line x1="12" y1="17" x2="12" y2="22"/>',
  '<path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15',
  " 10.76V7a1 1 0 0 1 1-1h1V3H7v3h1a1 1 0 0 1 1 1v3.76a2 2 0 0 1-1.11",
  ' 1.79l-1.78.9A2 2 0 0 0 5 15.24z"/>',
  "</svg>",
].join("");

const PIP_STYLES = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    background: #000;
    display: flex;
    flex-direction: column;
    height: 100vh;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
    color: #e0e0e6;
    overflow: hidden;
  }
  .toolbar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 12px;
    background: #111318;
    font-size: 13px;
    flex-shrink: 0;
    user-select: none;
  }
  .toolbar .title {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: 500;
  }
  .toolbar button {
    background: transparent;
    border: 1px solid #444;
    border-radius: 6px;
    color: #e0e0e6;
    cursor: pointer;
    padding: 4px 10px;
    font-size: 12px;
    display: flex;
    align-items: center;
    gap: 4px;
    transition: background 0.15s, border-color 0.15s, color 0.15s;
  }
  .toolbar button:hover { background: rgba(255,255,255,0.08); }
  .toolbar button.pinned { border-color: #3b82f6; color: #3b82f6; }
  video {
    flex: 1;
    min-height: 0;
    width: 100%;
    object-fit: contain;
    background: #000;
  }
`;

function setupPipWindow(
  pipWin: Window,
  stream: MediaStream,
  title: string,
  onClose?: () => void,
): void {
  const doc = pipWin.document;

  const style = doc.createElement("style");
  style.textContent = PIP_STYLES;
  doc.head.appendChild(style);

  doc.title = title;

  const toolbar = doc.createElement("div");
  toolbar.className = "toolbar";

  const titleSpan = doc.createElement("span");
  titleSpan.className = "title";
  titleSpan.textContent = title;
  toolbar.appendChild(titleSpan);

  const electronAPI = window.electronAPI;
  if (electronAPI) {
    const pinBtn = doc.createElement("button");
    let pinned = false;
    pinBtn.innerHTML = `${PIN_SVG} Pin`;
    pinBtn.title = "Keep window on top";
    pinBtn.onclick = () => {
      pinned = !pinned;
      pinBtn.classList.toggle("pinned", pinned);
      pinBtn.innerHTML = `${PIN_SVG} ${pinned ? "Pinned" : "Pin"}`;
      electronAPI.toggleAlwaysOnTop(pinned);
    };
    toolbar.appendChild(pinBtn);
  }

  doc.body.appendChild(toolbar);

  const video = doc.createElement("video");
  video.srcObject = stream;
  video.autoplay = true;
  video.playsInline = true;
  video.muted = true;
  doc.body.appendChild(video);

  for (const track of stream.getTracks()) {
    track.addEventListener("ended", () => {
      if (stream.getTracks().every((t) => t.readyState === "ended")) {
        pipWin.close();
        onClose?.();
      }
    });
  }
}

export async function popoutStream(
  stream: MediaStream,
  title: string,
  options?: { width?: number; height?: number },
): Promise<PopoutHandle | null> {
  const { width = 640, height = 480 } = options ?? {};

  if (window.documentPictureInPicture) {
    try {
      const pipWin = await window.documentPictureInPicture.requestWindow({
        width,
        height,
      });

      let open = true;
      const markClosed = () => { open = false; };

      setupPipWindow(pipWin, stream, title, markClosed);
      pipWin.addEventListener("pagehide", markClosed);

      return {
        close: () => {
          if (open) { pipWin.close(); open = false; }
        },
        isOpen: () => open,
      };
    } catch (err) {
      console.warn("[Popout] Document PiP failed, trying fallback:", err);
    }
  }

  // Fallback: window.open with about:blank (works in Electron and browsers)
  try {
    const popup = window.open("about:blank", "_blank", `width=${width},height=${height},resizable=yes`);
    if (!popup) throw new Error("Popup blocked");

    let open = true;
    const markClosed = () => { open = false; };

    setupPipWindow(popup, stream, title, markClosed);

    const checkInterval = setInterval(() => {
      if (popup.closed) { markClosed(); clearInterval(checkInterval); }
    }, 500);

    popup.addEventListener("beforeunload", markClosed);

    return {
      close: () => {
        if (open) { popup.close(); open = false; }
        clearInterval(checkInterval);
      },
      isOpen: () => open && !popup.closed,
    };
  } catch (err) {
    console.warn("[Popout] window.open fallback also failed:", err);
    return null;
  }
}
