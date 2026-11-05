import type { NameKey } from "@onamea/types"
import { type Identity, type Item, buildIdentityFromOperations, buildItemFromOperations } from "@onamea/crdt"
import type { Context } from "hono"
import routes from "../routes.ts"
import type { AppEnv } from "../../lib/env.ts"
import { withMessages } from "../../lib/withMessages.ts"
import {
  areIncomingMessages,
  cleanIncomingMessages,
  groupMessagesById,
  cleanIncomingMessage,
  validatedMessagesToMessages,
  validateMessages
} from "../../lib/Operation.ts"
import toArray from "../../lib/utils/toArray.ts"

export default async (ctx: Context<AppEnv, typeof routes.POST>) => {
  const body = await ctx.req.json()
  const arr = toArray(body)

  if (areIncomingMessages(arr)) {
    const incomingMessages = cleanIncomingMessages(arr)
    const validatedMessages = await validateMessages(incomingMessages)
    const invalidMessages = validatedMessages.filter(({ isValid }) => isValid === false)

    if (invalidMessages.length > 0) {
      return ctx.json(
        { error: "Invalid Messages: " + JSON.stringify(validatedMessagesToMessages(invalidMessages)) },
        400
      )
    }

    try {
      const db = ctx.get("db")
      const groupedMessages = groupMessagesById(validatedMessages)
      const response: (Identity | Item)[] = []

      for (const [id, messages] of groupedMessages) {
        const { records, isIdentity } = await ctx.get("operationStore").append(id, messages.map(cleanIncomingMessage))
        const operations = [...new Map(records.map(({ operation }) => [operation.hash, operation])).values()]

        try {
          if (isIdentity) {
            const entity = await buildIdentityFromOperations(operations, id as NameKey, true)
            await db.projectEntity(id, { isIdentity: true, entity })
            response.push(entity)
          } else {
            const entity = await buildItemFromOperations(operations, id)
            await db.projectEntity(id, { isIdentity: false, entity })
            response.push(entity)
          }
        } catch (error) {
          console.error("Failed to project entity to KV", error)
          return ctx.json({ error: error instanceof Error ? error.message : String(error) }, 500)
        }
      }

      return ctx.json(await withMessages(response, ctx.get("operationStore")))
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      return ctx.json({ error: errorMessage }, 400)
    }
  } else {
    return ctx.json({ error: "Invalid request body" }, 400)
  }
}
