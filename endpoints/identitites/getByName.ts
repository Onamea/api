import type { Context } from "hono"
import { isFingerprintedName, isName, parseFingerprintedName } from "@onamea/types"
import type { AppEnv } from "../../lib/env.ts"
import routes from "../routes.ts"

export default async (ctx: Context<AppEnv, typeof routes.GET_IDENTITIES_BY_NAME>) => {
  const suppliedName = ctx.req.param("name")
  const [name, fingerprintDisplay] = isFingerprintedName(suppliedName)
    ? parseFingerprintedName(suppliedName)
    : [suppliedName]

  if (isName(name) === false) {
    return ctx.json({ error: "Invalid param: name" }, 400)
  }

  return ctx.json(await ctx.get("db").findIdentitiesByName(name, fingerprintDisplay))
}
