import { assertEquals, assertThrows } from "https://deno.land/std@0.203.0/assert/mod.ts"
import { isPrimaryKey, splitFingerprintedName, toPrimaryChars, isName, isFingerprint, isAcceptedName, isNameOrFingerprintedName, isFingerprintedName, analyzeFingerprintedName, nameBelongsToPrimaryKey, primaryKeyToFingerprint } from "../PrimaryKey.ts"
import mockData from "./data.mock.ts"

Deno.test("isPrimaryKey", () => {
  // Valid primary key (53 characters)
  assertEquals(isPrimaryKey("M1KABKCN21R65CU8HB736HNYJG0G1UQC4XX2VCAJNPBKVRG3PF4G3"), true)
  
  // Invalid cases
  assertEquals(isPrimaryKey(null), false)
  assertEquals(isPrimaryKey(""), false)
  assertEquals(isPrimaryKey("M1K"), false)
  assertEquals(isPrimaryKey("M1KABKCN21R65CU8HB736HNYJG0G1UQC4XX2VCAJNPBKVRG3PF4G"), false) // No flag
  assertEquals(isPrimaryKey("M1KABKCN21R65CU8HB736HNYJG0G1UQC4XX2VCAJNPBKVRG3PF4G5"), false) // Invalid flag
  assertEquals(isPrimaryKey("M1KABKCN21R65CU8HB736HNYJG0G1UQC4XX2VCAJNPBKVRG3PF4GA2"), false) // One character too long
})

Deno.test("PrimaryKey", () => {
  assertEquals(splitFingerprintedName("Mike😊"), ["Mike", "😊"])
  assertThrows(() => splitFingerprintedName("Mike"))
  assertThrows(() => splitFingerprintedName("$"))
  assertThrows(() => splitFingerprintedName("$😊"))
  assertThrows(() => splitFingerprintedName(""))
})

Deno.test("isName", () => {
  // Valid names
  assertEquals(isName("mike"), true)
  assertEquals(isName("MikeS"), true)
  
  // Invalid cases
  assertEquals(isName(""), false) // Empty string not allowed
  assertEquals(isName("Mike!"), false) // Special characters not allowed
})

Deno.test("isFingerprint", () => {
  // Valid fingerprints (emojis)
  assertEquals(isFingerprint("😊"), true)
  assertEquals(isFingerprint("☁️🌲"), true)
  assertEquals(isFingerprint("☁️🌲🌙☃️🍴⚽"), true)

  // Invalid cases
  assertEquals(isFingerprint(""), false) // Empty string not allowed
  assertEquals(isFingerprint("Abc"), false) // Letters not allowed
  assertEquals(isFingerprint("123"), false) // Numbers not allowed
})

Deno.test("toPrimaryChars", () => {
  assertEquals(toPrimaryChars("Mike"), "M1KE")
  assertEquals(toPrimaryChars("Mike☁️"), "M1KEX") // Cloud with variation selector
  assertEquals(toPrimaryChars("Mike🌲"), "M1KET") // Evergreen tree
  assertEquals(toPrimaryChars("Mike🌙"), "M1KED") // Crescent moon
  assertEquals(toPrimaryChars("Mike☃️"), "M1KE8") // Snowman with variation selector
  assertEquals(toPrimaryChars("Mike🍴"), "M1KE2") // Fork and knife
  assertEquals(toPrimaryChars("Mike⚽"), "M1KEB") // Soccer ball
  assertEquals(toPrimaryChars("Mike☁️🌲🌙☃️🍴⚽"), "M1KEXTD82B") // All
})

Deno.test("isFingerprintedName", () => {
  // Valid fingerprinted names
  assertEquals(isFingerprintedName("Mike😊"), true)
  assertEquals(isFingerprintedName("Anna🌲"), true)
  assertEquals(isFingerprintedName("John☁️🌲"), true)
  assertEquals(isFingerprintedName("1Mike😊"), true) // Name starting with number

  // Invalid cases
  assertEquals(isFingerprintedName("Mike"), false) // No fingerprint
  assertEquals(isFingerprintedName(""), false) // Empty string
  assertEquals(isFingerprintedName("$😊"), false) // Invalid name
  assertEquals(isFingerprintedName(null), false) // Null value
})

Deno.test("isAcceptedName", () => {
  // Names with length >= 4
  assertEquals(isAcceptedName("Mike"), true)
  assertEquals(isAcceptedName("Anna🌲"), true)
  assertEquals(isAcceptedName("John☁️🌲"), true)

  // Names with length < 4
  assertEquals(isAcceptedName("Tom"), false)
  assertEquals(isAcceptedName("Al"), false)
  assertEquals(isAcceptedName(""), false)
})

Deno.test("isNameOrFingerprintedName", () => {
  assertEquals(isNameOrFingerprintedName("Mike"), true)
  assertEquals(isNameOrFingerprintedName("Mike😊"), true)
  assertEquals(isNameOrFingerprintedName(""), false)
  assertEquals(isNameOrFingerprintedName("Mike!"), false)
  assertEquals(isNameOrFingerprintedName("😊"), false)
})

Deno.test("analyzeFingerprintedName", () => {
  const result = analyzeFingerprintedName("Mike😊")
  assertEquals(result.name, "Mike")
  assertEquals(result.fingerprint, "😊")
  assertEquals(result.fingerprintedName, "Mike😊")
  assertEquals(result.nameLength, 4)
  assertEquals(result.fingerprintLength, 1)
  assertEquals(result.totalLength, 5)
})

Deno.test("primaryKeyToFingerprint", async () => {
  const primaryKey = mockData[0].primaryKey
  const fingerprint = await primaryKeyToFingerprint(primaryKey)
  assertEquals(fingerprint, "❤️🖋☀️☕⚡🔥🎉⚽✈️🌸🌙🏠🏁☃️🖋👑☁️🌸👑🔑☃️🚗☁️🏁⚡😊🚀🌸💡🙏⚽⭐🏁⭐🎁🍴🎉🍴🎉🏠🦋☀️🏁🖋🌲🦋🖋🌲🚀🚀❤️🎁")
})

Deno.test("nameBelongsToPrimaryKey", async () => {
  // The name "Mike" should match the start of its primary chars
  assertEquals(await nameBelongsToPrimaryKey("Mike", "M1KEXYZABCDEFGHIJKLMNOPQRSTUVWX1234567890ABCDEFGH3"), true)
  // The name "Anna" should not match a primary key starting with "M1KE"
  assertEquals(await nameBelongsToPrimaryKey("Anna", "M1KEXYZABCDEFGHIJKLMNOPQRSTUVWX1234567890ABCDEFGH3"), false)
  // Fingerprinted name
  assertEquals(await nameBelongsToPrimaryKey(mockData[0].name, mockData[0].primaryKey), true)
})
