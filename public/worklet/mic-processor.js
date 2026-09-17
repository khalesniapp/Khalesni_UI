/**
 * Microphone capture worklet — UI_Plan.md §7.7, §11.6.
 *
 * Runs on the audio rendering thread. Its whole job is to turn whatever the
 * hardware gives us into exactly what the backend contract asks for:
 *
 *     PCM16 little-endian, mono, 16 000 Hz, ~40 ms chunks (1280 bytes)
 *
 * **Never send the mic's native 48 kHz.** The backend hands the bytes to Gemini
 * Live as 16 kHz; feeding it 48 kHz makes the model hear chipmunks and the
 * transcript comes back as nonsense — which looks like a model problem and is
 * actually this file.
 *
 * A plain static file rather than a bundled module: `addModule()` takes a URL
 * and the worklet global scope has no imports, no DOM and no bundler runtime.
 *
 * Resampling is linear interpolation with a box pre-filter. At 48k → 16k that
 * is an exact 3:1 average, which is a cheap low-pass; picking every third
 * sample instead would alias everything above 8 kHz back down into speech.
 */

const TARGET_RATE = 16000;
const CHUNK_MS = 40;
/** 640 samples = 1280 bytes, comfortably inside the contract's 20–100 ms. */
const CHUNK_SAMPLES = (TARGET_RATE * CHUNK_MS) / 1000;

class MicProcessor extends AudioWorkletProcessor {
  constructor() {
    super();

    // `sampleRate` is a global in the worklet scope: the context's real rate,
    // which is whatever the hardware negotiated.
    this.ratio = sampleRate / TARGET_RATE;
    this.pending = new Float32Array(CHUNK_SAMPLES);
    this.pendingLength = 0;

    // Fractional read position in the input stream, carried across renders so
    // a chunk boundary never drops or duplicates a sample.
    this.cursor = 0;
    this.tail = new Float32Array(0);

    this.running = true;
    this.port.onmessage = (event) => {
      if (event.data === "stop") this.running = false;
    };
  }

  /**
   * Down-mix, resample and emit. `inputs[0][0]` is already mono because
   * getUserMedia was asked for one channel.
   */
  process(inputs) {
    if (!this.running) return false;

    const channel = inputs[0]?.[0];
    // No input yet (the graph starts before the device does) — stay alive.
    if (!channel || channel.length === 0) return true;

    // Prepend whatever was left over from the previous render quantum so the
    // interpolation window can span the boundary.
    const source = new Float32Array(this.tail.length + channel.length);
    source.set(this.tail, 0);
    source.set(channel, this.tail.length);

    let position = this.cursor;

    while (true) {
      const index = Math.floor(position);
      // Need one sample beyond `index` to interpolate against.
      if (index + 1 >= source.length) break;

      let value;
      if (this.ratio >= 2) {
        // Box-average the whole input window this output sample covers, which
        // is the anti-aliasing filter. At 48k → 16k this averages 3 samples.
        const end = Math.min(Math.floor(position + this.ratio), source.length);
        let sum = 0;
        let count = 0;
        for (let i = index; i < end; i += 1) {
          sum += source[i];
          count += 1;
        }
        value = count > 0 ? sum / count : source[index];
      } else {
        // Upsampling or a near-1:1 rate: plain linear interpolation.
        const fraction = position - index;
        value = source[index] * (1 - fraction) + source[index + 1] * fraction;
      }

      this.pending[this.pendingLength] = value;
      this.pendingLength += 1;

      if (this.pendingLength === CHUNK_SAMPLES) {
        this.emit();
      }

      position += this.ratio;
    }

    // Keep the unconsumed tail and the fractional offset into it.
    const consumed = Math.floor(position);
    this.tail = source.slice(consumed);
    this.cursor = position - consumed;

    return true;
  }

  /** Float32 [-1, 1] → PCM16 LE, transferred rather than copied. */
  emit() {
    const pcm = new Int16Array(CHUNK_SAMPLES);

    for (let i = 0; i < CHUNK_SAMPLES; i += 1) {
      // Clamp before scaling: a sample above 1.0 would wrap to a large
      // negative and arrive as a click.
      const sample = Math.max(-1, Math.min(1, this.pending[i]));
      pcm[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
    }

    this.port.postMessage(pcm.buffer, [pcm.buffer]);
    this.pendingLength = 0;
  }
}

registerProcessor("mic-processor", MicProcessor);
