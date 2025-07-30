import { assertEquals } from "https://deno.land/std@0.203.0/assert/mod.ts"
import { hashToPrimaryChars, nameToPrimaryChars, primaryCharsToFingerprint } from "../toPrimaryChars.ts"
import mockData from "./data.mock.ts"

Deno.test("nameToPrimaryChars", () => {
  assertEquals(nameToPrimaryChars("Mike"), "M1KE")
  assertEquals(nameToPrimaryChars("MIKE"), "M1KE")
})

Deno.test("primaryCharsToFingerprint", () => {
  assertEquals(primaryCharsToFingerprint("0"), "😊")
  assertEquals(primaryCharsToFingerprint("M"), "🎵")
  assertEquals(primaryCharsToFingerprint("6DW"), "👍🌙🦋")
  assertEquals(
    primaryCharsToFingerprint("31SQEFPBAVDH981KXVKJ8CX9E0RVN7B595G2P2PHWS91TW1TRR3G"), 
    "❤️🖋☀️☕⚡🔥🎉⚽✈️🌸🌙🏠🏁☃️🖋👑☁️🌸👑🔑☃️🚗☁️🏁⚡😊🚀🌸💡🙏⚽⭐🏁⭐🎁🍴🎉🍴🎉🏠🦋☀️🏁🖋🌲🦋🖋🌲🚀🚀❤️🎁"
  )
})

Deno.test("hashToPrimaryChars", async () => {
  const primaryChars = await hashToPrimaryChars(mockData[0].primaryKey)
  assertEquals(primaryChars, "31SQEFPBAVDH981KXVKJ8CX9E0RVN7B595G2P2PHWS91TW1TRR3G")
})