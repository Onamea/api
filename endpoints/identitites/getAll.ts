import type { Context } from "hono"
import type { AppEnv } from "../../lib/env.ts"
import { withMessages } from "../../lib/withMessages.ts"
import routes from "../routes.ts"

export default async (ctx: Context<AppEnv, typeof routes.GET_IDENTITIES>) => {
  const identities = await ctx.get("db").listIdentities()
  return ctx.json(await withMessages(identities, ctx.get("operationStore")))
}
