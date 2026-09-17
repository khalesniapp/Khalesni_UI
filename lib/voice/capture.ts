/**
 * Microphone capture — UI_Plan.md §7.7, §11.6.
 *
 * Owns the getUserMedia stream, the AudioContext and the worklet node, and
 * hands finished 16 kHz PCM16 chunks to a callback. Nothing here knows about
 * the WebSocket; the session wires the two together.
 *
 * Releasing the mic properly matters more than usual: the browser's recording
 * indicator is how someone checks they are not being listened to, so `stop()`
 * stops every track rather than only disconnecting the graph, and the session
 * end path always reaches it.
 */

export const MIC_SAMPLE_RATE = 16000;

export interface Capture {
  /** RMS amplitude of the latest chunk, 0–1, for the orb (§7.7). */
  amplitude: () => number;
  setMuted: (muted: boolean) => void;
  stop: () => Promise<void>;
}

export type MicDenied = "denied" | "unavailable";

export class MicError extends Error {
  readonly kind: MicDenied;

  constructor(kind: MicDenied, message: string) {
    super(message);
    this.name = "MicError";
    this.kind = kind;
  }
}

export async function startCapture(onChunk: (chunk: ArrayBuffer) => void): Promise<Capture> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    throw new MicError("unavailable", "This browser cannot capture audio");
  }

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        // Without AGC a quiet speaker barely registers; the model is listening
        // to a laptop mic across a room, not a studio input.
        autoGainControl: true,
      },
    });
  } catch (cause) {
    const name = cause instanceof Error ? cause.name : "";
    // NotAllowedError is a refusal the user can undo; everything else (no
    // device, hardware in use) is not, and the copy differs.
    throw new MicError(
      name === "NotAllowedError" || name === "SecurityError" ? "denied" : "unavailable",
      cause instanceof Error ? cause.message : "Microphone unavailable",
    );
  }

  // Ask for 16 kHz directly. When the hardware obliges there is no resampling
  // to do at all; when it does not, the worklet resamples from whatever rate
  // we actually got. Either way the bytes leaving here are 16 kHz.
  let context: AudioContext;
  try {
    context = new AudioContext({ sampleRate: MIC_SAMPLE_RATE });
  } catch {
    context = new AudioContext();
  }

  try {
    await context.audioWorklet.addModule("/worklet/mic-processor.js");
  } catch (cause) {
    stream.getTracks().forEach((track) => track.stop());
    await context.close();
    throw new MicError(
      "unavailable",
      cause instanceof Error ? cause.message : "Could not load the audio worklet",
    );
  }

  // Autoplay policy: the context can start suspended even though this runs
  // from a click, e.g. when the tab was restored.
  if (context.state === "suspended") await context.resume();

  const source = context.createMediaStreamSource(stream);
  const node = new AudioWorkletNode(context, "mic-processor");

  let muted = false;
  let level = 0;

  node.port.onmessage = (event) => {
    const buffer = event.data as ArrayBuffer;

    // Amplitude is measured even while muted so the orb does not look frozen;
    // the bytes are simply not sent.
    const samples = new Int16Array(buffer);
    let sum = 0;
    for (let i = 0; i < samples.length; i += 1) {
      const value = samples[i] / 0x8000;
      sum += value * value;
    }
    const rms = Math.sqrt(sum / samples.length);
    // Smooth it: a raw per-chunk RMS makes the orb jitter at 25 Hz.
    level = level * 0.7 + rms * 0.3;

    if (!muted) onChunk(buffer);
  };

  source.connect(node);
  // The worklet emits no audio, but an unconnected node is not guaranteed to
  // be pulled by the graph. A zero-gain sink keeps it running without any
  // chance of feeding the mic back to the speakers.
  const sink = context.createGain();
  sink.gain.value = 0;
  node.connect(sink).connect(context.destination);

  return {
    amplitude: () => level,
    setMuted: (next) => {
      muted = next;
    },
    stop: async () => {
      node.port.postMessage("stop");
      node.port.onmessage = null;
      node.disconnect();
      source.disconnect();
      sink.disconnect();
      // Stopping the tracks is what actually turns the browser's recording
      // indicator off — closing the context alone does not.
      stream.getTracks().forEach((track) => track.stop());
      await context.close().catch(() => undefined);
    },
  };
}
