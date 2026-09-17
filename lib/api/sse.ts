/**
 * Server-Sent Events parsing — UI_Plan.md §5.5, §11.5.
 *
 * `EventSource` cannot be used: the endpoint is a POST with a JSON body, and
 * `EventSource` only does GET. So the stream is read from `fetch` and the
 * frames are parsed here.
 *
 * **The carry-over buffer is the whole point of this file.** A network chunk
 * boundary falls wherever TCP puts it, which is routinely in the middle of a
 * `data:` line and therefore in the middle of a JSON object. Parsing each chunk
 * on its own is the classic bug in this endpoint: it works perfectly against a
 * local backend on a fast connection and corrupts one message in twenty over a
 * real network.
 *
 * So: bytes accumulate in `buffer`, and only complete frames — everything up to
 * a blank line — are emitted. Whatever is left over stays for the next chunk.
 */

export interface SseFrame {
  /** The `event:` name. Defaults to "message" per the SSE spec. */
  event: string;
  /** The joined `data:` lines, still raw text. */
  data: string;
}

/**
 * Incremental SSE frame parser.
 *
 * Deliberately a plain class rather than a generator: it has to survive across
 * `await reader.read()` calls and be testable by feeding it string fragments
 * directly, including fragments split mid-token.
 */
export class SseParser {
  private buffer = "";

  /** Feed one decoded chunk; get back every frame that is now complete. */
  push(chunk: string): SseFrame[] {
    // Normalise line endings first. A proxy may rewrite \n to \r\n, and a
    // frame delimiter of "\r\n\r\n" would otherwise never match "\n\n".
    this.buffer += chunk.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

    const frames: SseFrame[] = [];
    let boundary = this.buffer.indexOf("\n\n");

    while (boundary !== -1) {
      const raw = this.buffer.slice(0, boundary);
      this.buffer = this.buffer.slice(boundary + 2);

      const frame = parseFrame(raw);
      if (frame) frames.push(frame);

      boundary = this.buffer.indexOf("\n\n");
    }

    return frames;
  }

  /**
   * Flush at end of stream.
   *
   * A well-behaved server ends with a blank line, but a connection that closes
   * cleanly right after the final `data:` leaves one complete frame in the
   * buffer with no delimiter. Dropping it would lose the `result` — the single
   * most important frame in the stream.
   */
  flush(): SseFrame[] {
    const rest = this.buffer.trim();
    this.buffer = "";
    if (!rest) return [];

    const frame = parseFrame(rest);
    return frame ? [frame] : [];
  }
}

function parseFrame(raw: string): SseFrame | null {
  let event = "message";
  const data: string[] = [];

  for (const line of raw.split("\n")) {
    // ":" opens a comment line — heartbeats and the anti-buffering padding
    // some proxies need. Not an error, just nothing to do.
    if (line.startsWith(":")) continue;

    const colon = line.indexOf(":");
    const field = colon === -1 ? line : line.slice(0, colon);
    // One optional space after the colon is part of the framing, not the value.
    let value = colon === -1 ? "" : line.slice(colon + 1);
    if (value.startsWith(" ")) value = value.slice(1);

    if (field === "event") event = value;
    else if (field === "data") data.push(value);
    // `id` and `retry` are spec fields we have no use for; ignored, not thrown.
  }

  if (data.length === 0) return null;
  // Multiple `data:` lines in one frame join with newlines, per the spec.
  return { event, data: data.join("\n") };
}

/**
 * Parse a frame's payload as JSON.
 *
 * Returns null rather than throwing: §11.5 says unknown events are ignored
 * rather than fatal, and the same tolerance should apply to a payload we cannot
 * read. One malformed frame must not take down a generation that is otherwise
 * going fine.
 */
export function frameJson(frame: SseFrame): unknown {
  try {
    return JSON.parse(frame.data);
  } catch {
    return null;
  }
}
