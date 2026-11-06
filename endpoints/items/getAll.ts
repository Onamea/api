import type { Context } from "hono"
import type { AppEnv } from "../../lib/env.ts"
import { withMessages } from "../../lib/withMessages.ts"
import routes from "../routes.ts"

export default async (ctx: Context<AppEnv, typeof routes.GET_ITEMS>) => {
  const items = (await ctx.get("db").listEntityProjections()).flatMap(projection =>
    projection.isIdentity ? [] : [projection.entity]
  )
  return ctx.json(await withMessages(items, ctx.get("operationStore")))
}
