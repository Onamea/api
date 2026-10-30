import type { Context } from "hono"
import type { AppEnv } from "../../lib/env.ts"
import routes from "../routes.ts"

export default async (ctx: Context<AppEnv, typeof routes.GET_IDENTITIES>) => {
  return ctx.json(await ctx.get("db").listIdentities())
}
