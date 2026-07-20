// Matches ANSI escape sequences. Ported from ansi-regex
// (https://github.com/chalk/ansi-regex), inlined so the browser client does
// not need the strip-ansi dependency.

// Valid string terminator sequences are BEL, ESC\, and 0x9c
const ST = "(?:\\u0007|\\u001B\\u005C|\\u009C)";

// OSC sequences only: ESC ] ... ST (non-greedy until the first ST)
const OSC = `(?:\\u001B\\][\\s\\S]*?${ST})`;

// CSI and related: ESC/C1, optional intermediates, optional params (supports ; and :) then final byte
const CSI =
  "[\\u001B\\u009B][[\\]()#;?]*(?:\\d{1,4}(?:[;:]\\d{0,4})*)?[\\dA-PR-TZcf-nq-uy=><~]";

const ANSI_REGEX = new RegExp(`${OSC}|${CSI}`, "g");

/**
 * @param {string} string string possibly containing ANSI escape sequences
 * @returns {string} the string without ANSI escape sequences
 */
export default function stripAnsi(string) {
  return string.replace(ANSI_REGEX, "");
}
