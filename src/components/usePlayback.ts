"use client";

import { useSyncExternalStore } from "react";
import type { Playback } from "../lib/playback";

/** Re-renders the caller whenever the playback clock changes. */
export function usePlayback(playback: Playback): Playback {
  useSyncExternalStore(playback.subscribe, playback.getVersion, playback.getVersion);
  return playback;
}
