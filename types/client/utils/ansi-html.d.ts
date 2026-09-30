/**
 * Build the tag tables from a palette.
 * @param {Record<string, string | string[]>} colors palette, hex without `#`
 */
export function setColors(colors: Record<string, string | string[]>): void;
/**
 * Turn the ANSI colours in some text into HTML.
 * @param {string} text text that may carry SGR sequences
 * @returns {string} the text, with its colours as markup
 */
export default function ansiHTML(text: string): string;
