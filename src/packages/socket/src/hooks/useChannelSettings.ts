import { useCallback, useEffect, useRef } from "react";
import toast from "react-hot-toast";

import type { Channel } from "@/settings/src/types/server";

interface UseChannelSettingsParams {
  inputMode: string;
  rnnoiseEnabled: boolean;
  eSportsModeEnabled: boolean;
  noiseGate: number;
  isConnected: boolean;
  setInputMode: (v: "voice_activity" | "push_to_talk") => void;
  setRnnoiseEnabled: (v: boolean) => void;
  setESportsModeEnabled: (v: boolean) => void;
  setNoiseGate: (v: number) => void;
}

export function useChannelSettings({
  inputMode, rnnoiseEnabled, eSportsModeEnabled, noiseGate, isConnected,
  setInputMode, setRnnoiseEnabled, setESportsModeEnabled, setNoiseGate,
}: UseChannelSettingsParams) {
  const prevSettingsRef = useRef<{
    inputMode: string;
    rnnoiseEnabled: boolean;
    eSportsModeEnabled: boolean;
    noiseGate: number;
  } | null>(null);

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

  return { applyChannelSettings };
}
