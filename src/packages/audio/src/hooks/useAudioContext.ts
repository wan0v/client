import { useCallback, useEffect, useState } from "react";
import { singletonHook } from "react-singleton-hook";

export interface SharedAudioContextValue {
  audioContext: AudioContext | undefined;
  activate: () => void;
}

/**
 * Shared AudioContext singleton, shared between useMicrophone and
 * useSpeakers so both hooks process audio through the same context
 * (avoiding extra threads and resamplers).
 *
 * The AudioContext is NOT created at startup — call activate() when
 * audio is actually needed (e.g. joining voice, opening audio
 * settings). This avoids triggering OS-level "communication activity"
 * detection (Windows ducks all other audio when it sees a comms
 * stream).
 *
 * Browsers require a user gesture before the AudioContext can leave
 * the "suspended" state (autoplay policy). We attach a one-shot
 * interaction listener that resumes it on the first click/keydown.
 */
function useAudioContextHook(): SharedAudioContextValue {
  const [ctx, setCtx] = useState<AudioContext | undefined>(undefined);
  const [activated, setActivated] = useState(false);

  const activate = useCallback(() => {
    setActivated(true);
  }, []);

  useEffect(() => {
    if (!activated) return;

    const ac = new AudioContext({ latencyHint: "interactive", sampleRate: 48000 });
    setCtx(ac);

    const resume = () => {
      if (ac.state === "suspended") {
        ac.resume().catch(() => {});
      }
    };

    resume();

    document.addEventListener("click", resume, { once: true });
    document.addEventListener("keydown", resume, { once: true });

    return () => {
      document.removeEventListener("click", resume);
      document.removeEventListener("keydown", resume);
      ac.close().catch(() => {});
    };
  }, [activated]);

  return { audioContext: ctx, activate };
}

const initValue: SharedAudioContextValue = {
  audioContext: undefined,
  activate: () => {},
};

export const useSharedAudioContext = singletonHook<SharedAudioContextValue>(
  initValue,
  useAudioContextHook,
);
