import { isHash } from "@onamea/types"
import type { Context } from "hono"
import type { AppEnv } from "../../lib/env.ts"
import routes from "../routes.ts"

export default async (ctx: Context<AppEnv, typeof routes.GET_MESSAGES>) => {
  const messageId = ctx.req.param("id")

  if (isHash(messageId) === false) {
    return ctx.json({ error: `Invalid Message Id: ${messageId}` }, 400)
  }

  const entityId = await ctx.get("db").getEntityIdByMessageId(messageId)
  if (entityId === undefined) {
    return ctx.json({ error: `No Message with Id: ${messageId} found` }, 404)
  }

  const message = await ctx.get("operationStore").getMessage(entityId, messageId)
  if (message === undefined) {
    return ctx.json({ error: `No Message with Id: ${messageId} found` }, 404)
  }

  return ctx.json(message)
}
