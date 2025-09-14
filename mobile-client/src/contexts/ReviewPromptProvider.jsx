// All comments in English as requested.
import React, { useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import ReviewPromptModal from "../components/ReviewPromptModal";
import { fetchEndedUnreviewedBookings } from "../services/reviewsService";
import * as AuthHook from "../hooks/useAuth";
const useAuth = AuthHook.useAuth || AuthHook.default;

export default function ReviewPromptProvider({ navigationRef }) {
  const { user } = (useAuth?.() ?? {});
  const [prompt, setPrompt] = useState(null);
  const appState = useRef(AppState.currentState);

  const pickCandidate = async (cands) => {
    for (const c of cands) {
      const key = `reviewPrompted_${c.bookingId}`;
      const flagged = await AsyncStorage.getItem(key);
      if (!flagged) return c;
    }
    return null;
  };

  const check = async () => {
    if (!user || user.role !== "parent") return;
    try {
      const candidates = await fetchEndedUnreviewedBookings();
      const next = await pickCandidate(candidates);
      if (next) setPrompt(next);
    } catch {}
  };

  // Run on login / user change
  useEffect(() => { check(); }, [user?._id]);

  // Run when app returns to foreground
  useEffect(() => {
    const sub = AppState.addEventListener("change", async (next) => {
      if (appState.current.match(/inactive|background/) && next === "active") {
        check();
      }
      appState.current = next;
    });
    return () => sub.remove();
  }, []);

  const dismiss = async () => {
    if (prompt?.bookingId) {
      await AsyncStorage.setItem(`reviewPrompted_${prompt.bookingId}`, "1");
    }
    setPrompt(null);
  };

  const goWrite = async () => {
    if (prompt?.bookingId) {
      await AsyncStorage.setItem(`reviewPrompted_${prompt.bookingId}`, "1");
    }
    const p = prompt;
    setPrompt(null);
    navigationRef?.current?.navigate("PostReview", {
      sitterId: p.sitterId,
      sitterName: p.sitterName,
      bookingId: p.bookingId,
    });
  };

  return (
    <ReviewPromptModal
      visible={!!prompt}
      sitterName={prompt?.sitterName}
      onLater={dismiss}
      onConfirm={goWrite}
    />
  );
}
