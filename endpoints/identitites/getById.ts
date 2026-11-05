import type { Context } from "hono"
import { isNameKey } from "@onamea/types"
import type { AppEnv } from "../../lib/env.ts"
import { withMessage } from "../../lib/withMessages.ts"
import routes from "../routes.ts"

export default async (ctx: Context<AppEnv, typeof routes.GET_IDENTITIES_BY_ID>) => {
  const id = ctx.req.param("id")

  if (isNameKey(id) === false) {
    return ctx.json({ error: `Invalid Identity Id: ${id}` }, 400)
  }

  const identity = await ctx.get("db").getIdentityById(id)
  if (identity === undefined) {
    return ctx.json({ error: `No Identity with Id: ${id} found` }, 404)
  }

  return ctx.json(await withMessage(identity, ctx.get("operationStore")))
}
