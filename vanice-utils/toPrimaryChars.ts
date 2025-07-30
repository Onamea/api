import characters from "./characters.json" with { type: "json" }
import { type PrimaryChars, type Name, type FingerprintedName, type Fingerprint, type PrimaryKey } from "./PrimaryKey.ts"
import { encode } from "./encoding.ts"

export const nameToPrimaryChars = (name: Name | FingerprintedName) : PrimaryChars => {

  // Use Intl segmenter to properly split emojis including modifiers
  const segmenter = new Intl.Segmenter("en", { granularity: "grapheme" })
  const segments = [...segmenter.segment(name)]
  
  return segments
    .map(( { segment }) => {
      const entry = characters.find(entry => entry.secondary.includes(segment) || entry.fingerprint === segment)
      return entry ? entry.primary : segment
    })
    .join("")
}

export const primaryCharsToFingerprint = (primaryChars: PrimaryChars): Fingerprint => {
  return Array.from(primaryChars).map(char => {
    const fingerprint = characters.find(entry => entry.primary === char)?.fingerprint
    if (fingerprint === undefined) {
      throw new Error(`Not a primary char: ${ char }`)
    }
    return fingerprint
  }).join("")
}

export const hashToPrimaryChars = async (primaryKey: PrimaryKey) : Promise<PrimaryChars> => {
  const arr = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(primaryKey)))
  return encode(arr)
}