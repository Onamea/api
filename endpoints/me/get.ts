import type { Context } from "hono"
import type { AppEnv } from "../../lib/env.ts"
import routes from "../routes.ts"
import getMe from "../../lib/getMe.ts"

export default async (ctx: Context<AppEnv, typeof routes.GET_ME>) => {
  const me = getMe()
  if (me !== undefined) {
    const identity = (await ctx.get("db").getIdentityById(me.id)) ?? me
    const messages = await ctx.get("operationStore").getMessages(me.id)
    return ctx.json({ ...identity, messages: messages.length > 0 ? messages : me.messages })
  }
  return ctx.json({ error: "No Me data configured" }, 404)
}
