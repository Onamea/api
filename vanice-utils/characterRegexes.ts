import characters from "./characters.json" with { type: "json" }

const createCharsString = (key: keyof typeof characters[0]): string => {
  return characters.reduce((acc, cur) => `${ acc }${ cur[key] }`, "")
}

const primaryChars = createCharsString("primary")
const secondaryChars = createCharsString("secondary")
const fingerprintChars = createCharsString("fingerprint")

export const primaryCharsRegex = new RegExp(`^[${ primaryChars }]+$`)
export const nameRegex = new RegExp(`^[${ primaryChars }${ secondaryChars }]+$`)
export const nameStartRegex = new RegExp(`^[${ primaryChars }${ secondaryChars }]+`)
export const fingerprintCharsRegex = new RegExp(`^[${ fingerprintChars }]+$`)

