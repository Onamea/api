import type { NameKey } from "@onamea/types"
import { type Identity, type Item, buildIdentityFromOperations, buildItemFromOperations } from "@onamea/crdt"
import type { Context } from "hono"
import routes from "../routes.ts"
import type { AppEnv } from "../../lib/env.ts"
import {
  areIncomingMessages,
  cleanIncomingMessages,
  groupMessagesById,
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
        const incomingRecords = messages.map(validatedMessage => ({
          operation: validatedMessage.operation,
          message: {
            raw: validatedMessage.raw,
            cryptoName: validatedMessage.cryptoName,
            publicKey: validatedMessage.publicKey,
            signature: validatedMessage.signature,
            datetime: validatedMessage.datetime
          },
          isOwnerSigned: validatedMessage.isOwnerSigned
        }))
        const { records, added, isIdentity, becameIdentity } = await ctx
          .get("operationStore")
          .append(id, incomingRecords)
        const newRecords = added.map(record => ({
          operation: record.operation,
          message: record.message,
          isOwnerSigned: record.isOwnerSigned
        }))

        if (newRecords.length > 0) {
          try {
            const identityProjection = isIdentity ? (becameIdentity ? records : newRecords) : []
            await db.appendEntityMessages(id, newRecords, identityProjection)
          } catch (error) {
            console.error("Failed to project entity messages to KV", error)
          }
        }

        const nextEntity = {
          operations: records.map(({ operation }) => operation),
          messages: records.map(({ message }) => message)
        }
        const entry = isIdentity
          ? await buildIdentityFromOperations(nextEntity.operations, id as NameKey, true)
          : await buildItemFromOperations(nextEntity.operations, id)
        const entryWithMessages = { ...entry, messages: nextEntity.messages }
        response.push(entryWithMessages)
      }

      return ctx.json(response)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      return ctx.json({ error: errorMessage }, 400)
    }
  } else {
    return ctx.json({ error: "Invalid request body" }, 400)
  }
}
