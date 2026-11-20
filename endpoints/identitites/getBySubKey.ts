import type { Context } from "hono"
import { isNameKey } from "@onamea/types"
import routes from "../routes.ts"
import type { AppEnv } from "../../lib/env.ts"
import { withMessages } from "../../lib/withMessages.ts"

export default async (ctx: Context<AppEnv, typeof routes.GET_IDENTITIES_BY_SUBKEY>) => {
  const id = ctx.req.param("id")

  if (isNameKey(id) === false) {
    return ctx.json({ error: `Invalid SubKey Id: ${id}` }, 400)
  }

  const identities = await ctx.get("db").findIdentitiesBySubKey(id)
  return ctx.json(await withMessages(identities, ctx.get("operationStore")))
}
