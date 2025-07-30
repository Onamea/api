import isString from "../lib/utils/isString.ts"
import { fingerprintCharsRegex, nameRegex, nameStartRegex, primaryCharsRegex } from "./characterRegexes.ts"
import { isFlag } from "./PublicKey.ts"
import { hashToPrimaryChars, nameToPrimaryChars, primaryCharsToFingerprint } from "./toPrimaryChars.ts"
import { getUTF8StringLength } from "./utils/getUTF8StringLength.ts"

export type PrimaryChars = string 
export type PrimaryKey = string
export type Name = string
export type Fingerprint = string
export type FingerprintedName = `${ Name }${ Fingerprint }`

const MIN_NAME_LENGTH = 4
const MIN_FINGERPRINTED_NAME_LENGTH = 4
const MIN_FINGERPRINT_LENGTH = 3

const isPrimaryChars = (value: unknown): value is PrimaryChars => {
  return isString(value) && primaryCharsRegex.test(value)
}

export const isPrimaryKey = (value: unknown): value is PrimaryKey => {
  return isPrimaryChars(value) && value.length === 53 && isFlag(parseInt(value[value.length - 1], 10))
}

export const toPrimaryChars = (name: Name | FingerprintedName): PrimaryChars => {
  return nameToPrimaryChars(name)
}

export const isName = (value: unknown): value is Name => {
  return isString(value) && value.length > 0 && nameRegex.test(value)
}

export const isFingerprint = (value: unknown): value is Fingerprint => {
  return isString(value) && value.length > 0 && fingerprintCharsRegex.test(value)
}

export const getFingerprintLength = (fingerprint: Fingerprint): number => {
  if (!isFingerprint(fingerprint)) {
    throw new Error("Invalid Fingerprint")
  }
  return getUTF8StringLength(fingerprint)
}

export const splitFingerprintedName = (fingerprintedName: FingerprintedName): [Name, Fingerprint] => {
  const match = fingerprintedName.match(nameStartRegex)
  if (match === null) {
    throw new Error("Invalid fingerprinted name")
  }
  const name = match[0]
  const fingerprint = fingerprintedName.slice(name.length)
  if (!isName(name) || !isFingerprint(fingerprint)) {
    throw new Error("Invalid fingerprinted name")
  }
  return [name, fingerprint]
}

export const isFingerprintedName = (value: unknown): value is FingerprintedName => {
  if (isString(value)) {
    try {
      splitFingerprintedName(value)
      return true
    } catch { /**/ }
  }
  return false
}

export const isAcceptedName = (n: Name | FingerprintedName, l = MIN_NAME_LENGTH): boolean => {
  let name: Name
  if (isFingerprintedName(n)) {
    [name] = splitFingerprintedName(n)
  } else {
    name = n
  }
  return name.length >= l
}

export const isNameOrFingerprintedName = (value: unknown): value is Name | FingerprintedName => {
  return isName(value) || isFingerprintedName(value)
}

export const analyzeFingerprintedName = (fingerprintedName: FingerprintedName) => {
  const [name, fingerprint] = splitFingerprintedName(fingerprintedName)
  const nameLength = name.length
  const fingerprintLength = getFingerprintLength(fingerprint)
  const totalLength = nameLength + fingerprintLength
  return { fingerprintedName, name, nameLength, fingerprint, fingerprintLength, totalLength }
} 

export const nameBelongsToPrimaryKey = async (name: Name | FingerprintedName, primaryKey: PrimaryKey): Promise<boolean> => {
  if (isFingerprintedName(name)) {
    const [n, fingerprint] = splitFingerprintedName(name)
    const fingerprintKey = await primaryKeyToFingerprint(primaryKey)
    return primaryKey.startsWith(nameToPrimaryChars(n)) && fingerprintKey.startsWith(fingerprint)
  } else {
    return primaryKey.startsWith(nameToPrimaryChars(name))
  }
}

export const primaryKeyToFingerprint = async (primaryKey: PrimaryKey, l?: number): Promise<Fingerprint> => {
  if (!isPrimaryKey(primaryKey)) {
    throw new Error("Invalid PrimaryKey")
  }
  const primaryChars = await hashToPrimaryChars(primaryKey)
  const s = l ? primaryChars.slice(0, l) : primaryChars
  return primaryCharsToFingerprint(s)
}

export const primaryKeyToFingerprintedName = async (primaryKey: PrimaryKey, name: Name, fingerprintLength?: number): Promise<FingerprintedName> => {
  if (await nameBelongsToPrimaryKey(name, primaryKey) === false) {
    throw new Error("Name does not belong to PrimaryKey")
  }
  const l = MIN_FINGERPRINTED_NAME_LENGTH - name.length
  const length = fingerprintLength ?? ((l >= MIN_FINGERPRINT_LENGTH) ? l : MIN_FINGERPRINT_LENGTH)
  const fingerprint = await primaryKeyToFingerprint(primaryKey, length)
  return `${ name }${ fingerprint }`
}