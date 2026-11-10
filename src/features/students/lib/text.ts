/** Zero-width and BOM characters that sneak in when Thai text is copied from the web or Excel. */
const INVISIBLE = /[​-‍⁠﻿]/g
// Control characters except tab/newline (which callers split on before cleaning).
// oxlint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g

/**
 * Normalise user-entered text: NFC (so equivalent Thai mark orders compare equal),
 * no invisible characters, single spaces, trimmed.
 */
export function cleanText(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value)
    .normalize('NFC')
    .replace(INVISIBLE, '')
    .replace(CONTROL, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Lower-cased, cleaned form used for case-insensitive comparisons and search. */
export function foldText(value: unknown): string {
  return cleanText(value).toLocaleLowerCase()
}

const collator = new Intl.Collator('th', { numeric: true, sensitivity: 'base' })

/** Thai-aware, number-aware string comparison ("ป.5/2" < "ป.5/10"). */
export function compareText(a: string, b: string): number {
  return collator.compare(a, b)
}

/** Count user-perceived characters (a Thai consonant with its vowel and tone mark is one). */
export function graphemeLength(value: string): number {
  if (typeof Intl.Segmenter === 'function') {
    return Array.from(new Intl.Segmenter('th', { granularity: 'grapheme' }).segment(value)).length
  }
  return Array.from(value).length
}
