import type { Context } from "hono"
import type { AppEnv } from "../../lib/env.ts"
import routes from "../routes.ts"
import getMe from "../../lib/getMe.ts"

export default async (ctx: Context<AppEnv, typeof routes.GET_ME>) => {
  const me = getMe()
  if (me !== undefined) {
    return ctx.json((await ctx.get("db").getIdentityById(me.id)) ?? me)
  }
  return ctx.json({ error: "No Me data configured" }, 404)
}
