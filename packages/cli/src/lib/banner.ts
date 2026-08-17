/**
 * The launch banner: a small mascot printed to stderr just before a harness
 * takes over the terminal.
 *
 * This is the only branding the relay gets in an interactive session. The
 * agent CLIs draw their own welcome UI (Claude Code's box, Codex's header) and
 * we cannot replace it - we only spawn the binary - so ours goes first and then
 * gets out of the way.
 *
 * Two rules keep it from being a nuisance:
 *
 * - stderr, never stdout. Headless runs (`-p`, `exec`) pipe stdout into other
 *   programs; a mascot in that stream would corrupt whatever parses it.
 * - Colour only when stderr is a TTY and NO_COLOR is unset. Redirected output
 *   is read by humans in log files and by machines in CI, and neither wants
 *   escape sequences.
 */

/** Brand lime, matching the site's mark. */
const LIME = "\x1b[38;2;198;241;53m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

/**
 * The mascot, one string per line. Antenna, eyes, feet - deliberately small so
 * it costs five lines of scrollback and no more.
 */
const ROBOT = ["   ╷   ", "╭──┴──╮", "│ ▪ ▪ │", "╰┬───┬╯", " ╹   ╹ "] as const;

/** Whether ANSI colour is safe to emit on this stream. */
export function supportsColor(stream: { isTTY?: boolean } = process.stderr): boolean {
  if (process.env.NO_COLOR !== undefined && process.env.NO_COLOR !== "") {
    return false;
  }
  return stream.isTTY === true;
}

export type LaunchBannerOptions = {
  /** Lines printed to the right of the mascot, top-aligned. */
  lines: readonly string[];
  /** Override colour detection (tests pass this explicitly). */
  color?: boolean;
};

/**
 * Render the mascot with `lines` beside it. Returns a trailing-newline string
 * ready to hand to `process.stderr.write`.
 *
 * Lines beyond the mascot's height still print - they just continue under the
 * text column rather than being dropped, so a caller can never silently lose a
 * message by adding one line too many.
 */
export function renderLaunchBanner({ lines, color }: LaunchBannerOptions): string {
  const paint = color ?? supportsColor();
  const gap = "  ";
  const width = ROBOT[1].length; // widest row: the head
  const height = Math.max(ROBOT.length, lines.length);
  const out: string[] = [];

  for (let i = 0; i < height; i += 1) {
    const art = ROBOT[i] ?? "";
    const text = lines[i] ?? "";
    const artCell = art.padEnd(width, " ");
    const left = paint && art ? `${LIME}${artCell}${RESET}` : artCell;
    // First text line is the title; the rest are supporting detail.
    const right = text && paint && i > 0 ? `${DIM}${text}${RESET}` : text;
    out.push(`${left}${gap}${right}`.trimEnd());
  }
  return `${out.join("\n")}\n`;
}
