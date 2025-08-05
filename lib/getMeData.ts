import meData from "../config/me.json" with { type: "json" }
import { extendData, ExtendedData, validateData } from "./Data.ts"

const meDataIsValid = validateData(meData)
const extendedMeData = meDataIsValid ? await extendData(meData) : undefined

export const getMeData = (): ExtendedData | undefined => {
  return extendedMeData
}