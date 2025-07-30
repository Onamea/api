/**
 * Gets the length of a string counting Unicode grapheme clusters as single characters.
 * This correctly handles emoji (including ZWJ sequences), combining marks, etc.
 */
export const getUTF8StringLength = (str: string): number => {
  const segmenter = new Intl.Segmenter("en", { granularity: "grapheme" })
  return [...segmenter.segment(str)].length
}