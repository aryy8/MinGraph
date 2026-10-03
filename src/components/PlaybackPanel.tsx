"use client";

import { fmtInt } from "../lib/format";
import type { Playback } from "../lib/playback";
import { PauseIcon, PlayIcon, RestartIcon } from "./icons";
import { Range } from "./Range";
import { usePlayback } from "./usePlayback";

const toSpeed = (v: number) => Math.round(Math.pow(10, v / 50));
const fromSpeed = (s: number) => Math.round(50 * Math.log10(s));

export function PlaybackPanel({ playback }: { playback: Playback }) {
  const pb = usePlayback(playback);
  const disabled = !pb.loaded;
  const inRoute = pb.loaded && pb.t > pb.exploreEnd;
  const step = Math.min(pb.exploreEnd, Math.floor(pb.t));
  return (
    <div className="playback">
      <div className="playback-row">
        <button
          type="button"
          className="icon-btn"
          id="playback-toggle"
          aria-label={pb.playing ? "Pause" : "Play"}
          disabled={disabled}
          onClick={() => pb.toggle()}
        >
          {pb.playing ? <PauseIcon /> : <PlayIcon />}
        </button>
        <button type="button" className="icon-btn" id="playback-restart" aria-label="Restart" disabled={disabled} onClick={() => pb.restart()}>
          <RestartIcon />
        </button>
        <div className="playback-scrub">
          <Range
            id="playback-scrubber"
            label="Timeline"
            min={0}
            max={Math.max(1, pb.total)}
            value={pb.t}
            disabled={disabled}
            valueText={`Step ${fmtInt(step)} of ${fmtInt(pb.exploreEnd)}`}
            onScrubStart={() => pb.pause()}
            onChange={(v) => pb.seek(v)}
          />
        </div>
      </div>
      <div className="spec-row">
        <span className="spec-label">Step</span>
        <span className="num">
          {disabled ? "—" : `${fmtInt(step)} / ${fmtInt(pb.exploreEnd)}`}
          <span className="num-note">{inRoute ? " route" : ""}</span>
        </span>
      </div>
      <div className="speed-row">
        <label className="spec-label" htmlFor="playback-speed">
          Speed
        </label>
        <Range
          id="playback-speed"
          label="Playback speed"
          min={0}
          max={100}
          value={fromSpeed(pb.speed)}
          valueText={`${pb.speed} times`}
          onChange={(v) => pb.setSpeed(toSpeed(v))}
        />
        <span className="num speed-value">{pb.speed}x</span>
      </div>
    </div>
  );
}
