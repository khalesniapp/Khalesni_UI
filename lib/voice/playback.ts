/**
 * Speech playback — UI_Plan.md §7.7, §11.6.
 *
 * The backend sends PCM16 LE mono at **24 kHz**, in frames that are far too
 * small to play one at a time. §7.7 is explicit about the shape of the fix:
 *
 *   "Playback must be a queue with a cursor, not one buffer per frame, or
 *    audio will gap and click."
 *
 * So every frame is scheduled against a running `cursor` timestamp rather than
 * "now". Each buffer starts exactly where the previous one ends, sample
 * accurate, and the speech comes out continuous even when frames arrive in
 * bursts.
 *
 * `flush()` is barge-in. When the user starts talking over the assistant the
 * server sends `interrupted` and the queue has to die *immediately* — any
 * lag there is the thing that makes a voice UI feel broken.
 */

export const PLAYBACK_SAMPLE_RATE = 24000;

/** Scheduling a hair ahead of `currentTime` absorbs main-thread jitter. */
const SCHEDULE_AHEAD_S = 0.06;

export interface Playback {
  push: (frame: ArrayBuffer) => void;
  /** Barge-in: stop everything and reset the cursor. */
  flush: () => void;
  /** True while there is scheduled audio still to play. */
  isSpeaking: () => boolean;
  /** Output amplitude 0–1, for the orb's speaking state. */
  amplitude: () => number;
  close: () => Promise<void>;
}

export function createPlayback(): Playback {
  // A dedicated context at the stream's own rate: handing 24 kHz buffers to a
  // 48 kHz context means the browser resamples every frame, and any rounding
  // there shows up as a click at each boundary.
  let context: AudioContext;
  try {
    context = new AudioContext({ sampleRate: PLAYBACK_SAMPLE_RATE });
  } catch {
    context = new AudioContext();
  }

  const gain = context.createGain();
  gain.connect(context.destination);

  let sources = new Set<AudioBufferSourceNode>();
  let cursor = 0;
  let level = 0;

  function push(frame: ArrayBuffer) {
    if (frame.byteLength === 0) return;

    const samples = new Int16Array(frame);
    const buffer = context.createBuffer(1, samples.length, PLAYBACK_SAMPLE_RATE);
    const channel = buffer.getChannelData(0);

    let sum = 0;
    for (let i = 0; i < samples.length; i += 1) {
      const value = samples[i] / 0x8000;
      channel[i] = value;
      sum += value * value;
    }
    level = Math.sqrt(sum / samples.length);

    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(gain);

    // The cursor is the heart of this module. If the queue has drained (or we
    // have never played), restart it slightly ahead of now; otherwise butt this
    // frame directly against the end of the last one.
    const now = context.currentTime;
    if (cursor < now + SCHEDULE_AHEAD_S) cursor = now + SCHEDULE_AHEAD_S;

    source.start(cursor);
    cursor += buffer.duration;

    sources.add(source);
    source.onended = () => {
      sources.delete(source);
      if (sources.size === 0) level = 0;
    };
  }

  function flush() {
    for (const source of sources) {
      // `onended` would fire during iteration and mutate the set.
      source.onended = null;
      try {
        source.stop();
      } catch {
        // Already finished; stopping twice throws and means nothing.
      }
      source.disconnect();
    }
    sources = new Set();
    // Reset the cursor, or the next frame would be scheduled after the audio
    // we just cancelled and the assistant would answer several seconds late.
    cursor = 0;
    level = 0;
  }

  return {
    push,
    flush,
    isSpeaking: () => sources.size > 0,
    amplitude: () => level,
    close: async () => {
      flush();
      gain.disconnect();
      await context.close().catch(() => undefined);
    },
  };
}
