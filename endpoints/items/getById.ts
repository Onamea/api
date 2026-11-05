import type { Context } from "hono"
import { isId } from "@onamea/crdt"
import type { AppEnv } from "../../lib/env.ts"
import { withMessage } from "../../lib/withMessages.ts"
import routes from "../routes.ts"

export default async (ctx: Context<AppEnv, typeof routes.GET_ITEMS_BY_ID>) => {
  const id = ctx.req.param("id")

  if (isId(id) === false) {
    return ctx.json({ error: `Invalid Item Id: ${id}` }, 400)
  }

  const item = await ctx.get("db").getItemById(id)
  if (item === undefined) {
    return ctx.json({ error: `No Item with Id: ${id} found` }, 404)
  }
  return ctx.json(await withMessage(item, ctx.get("operationStore")))
}
