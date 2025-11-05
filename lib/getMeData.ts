import type { ExtendedData } from "./Data.ts"
import { extendData, validateData } from "./Data.ts"
import meData from "../config/me.json" with { type: "json" }

const meDataIsValid = await validateData(meData)
const extendedMeData = meDataIsValid ? await extendData(meData) : undefined

export const getMeData = (): ExtendedData | undefined => {
  return extendedMeData
}
