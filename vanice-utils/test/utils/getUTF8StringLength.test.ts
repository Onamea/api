import { assertEquals } from "https://deno.land/std@0.203.0/assert/mod.ts"
import { getUTF8StringLength } from "../../utils/getUTF8StringLength.ts"

Deno.test("getUTF8StringLength", () => {
  assertEquals(getUTF8StringLength("MIKE"), 4)
  assertEquals(getUTF8StringLength("😊"), 1)
  assertEquals(getUTF8StringLength("❤🖋☀☕⚡🔥"), 6)
})