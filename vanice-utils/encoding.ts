import { type PrimaryKey } from "./PrimaryKey.ts"
import characters from "./characters.json" with { type: "json" }

const CHARS = characters.reduce((acc, { primary }) => {
  acc[acc.length] = primary
  return acc
}, [] as string[])

const VALUES = characters.reduce((acc, { primary }, index) => {
  acc[primary] = index
  return acc
}, {} as Record<string, number>)

export const encode = (publicKey: Uint8Array): PrimaryKey => {
  const result: string[] = []
  let buffer = 0
  let bitsInBuffer = 0

  for (const byte of publicKey) {
    buffer = (buffer << 8) | byte
    bitsInBuffer += 8

    while (bitsInBuffer >= 5) {
      bitsInBuffer -= 5
      const index = (buffer >> bitsInBuffer) & 31
      result.push(CHARS[index])
    }
  }

  if (bitsInBuffer > 0) {
    const index = (buffer << (5 - bitsInBuffer)) & 31
    result.push(CHARS[index])
  }

  return result.join("")
}

export const decode = (primaryKey: PrimaryKey): Uint8Array => {
  const result = new Uint8Array(32)
  let resultIndex = 0
  let buffer = 0
  let bitsInBuffer = 0

  for (const char of primaryKey) {
    const value = VALUES[char]
    if (value === undefined) {
      throw new Error(`Invalid character: ${char}`)
    }

    buffer = (buffer << 5) | value
    bitsInBuffer += 5

    while (bitsInBuffer >= 8) {
      bitsInBuffer -= 8
      result[resultIndex++] = (buffer >> bitsInBuffer) & 255
    }
  }

  return result
}

