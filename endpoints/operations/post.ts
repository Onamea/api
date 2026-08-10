import { type RouterContext } from "@oak/oak/router"
import type { NameKey } from "@onamea/types"
import { type Identity, type Item, buildIdentityFromOperations, buildItemFromOperations, isCreateOperation } from "@onamea/crdt"
import ROUTES from "../ROUTES.ts"
import { areIncomingMessages, cleanIncomingMessages, groupMessagesById, isAcceptedOperation, validatedMessagesToMessages, validateMessages } from "../../lib/Operation.ts"
import toArray from "../../lib/utils/toArray.ts"
import { insert, insertItem, retrieveById, retrieveItemById } from "../../lib/db/kv.ts"

export default async (ctx: RouterContext<typeof ROUTES.POST>) => {

  const body = await ctx.request.body.json()
  const arr = toArray(body)

  if (areIncomingMessages(arr)) {

    const incomingMessages = cleanIncomingMessages(arr)
    const validatedMessages = await validateMessages(incomingMessages)
    const invalidMessages = validatedMessages.filter(({ isValid }) => isValid === false)

    if (invalidMessages.length > 0) {
      ctx.response.status = 400
      ctx.response.body = { error: "Invalid Messages: " + JSON.stringify(validatedMessagesToMessages(invalidMessages)) }
    }

    try {

      const groupedMessages = groupMessagesById(validatedMessages)
      const response: (Identity | Item)[] = []

      for (const key in groupedMessages) {

        for (const id in groupedMessages[key as keyof typeof groupedMessages]) {

          const isIdentity = key === "identity"
          const messages = groupedMessages[key as keyof typeof groupedMessages][id]
          const currentEntry = isIdentity ? await retrieveById(id as NameKey) : await retrieveItemById(id)
          if (currentEntry === undefined && messages.some(({ operation }) => isCreateOperation(operation)) === false) {
            throw new Error(`${ isIdentity ? "Identity" : "Item" }: ${ id } does not exist on this server. And no operation of type CREATE supplied.`)
          }
          const newMessages = currentEntry ? 
            messages.filter(({ operation })=> isAcceptedOperation(currentEntry, operation)) : 
            messages
          if (newMessages.length === 0 && currentEntry !== undefined) {
            response.push(currentEntry)
          } else {
            const nextValidatedMessages = await validateMessages(currentEntry ? [...currentEntry.messages, ...newMessages] : newMessages)
            const nextOperations = nextValidatedMessages.map(({ operation }) => operation)
            const nextMessages = validatedMessagesToMessages(nextValidatedMessages)
            if (isIdentity) {
              const nextIdentity = await buildIdentityFromOperations(nextOperations, id as NameKey, true)
              const entry = { ...nextIdentity, messages: nextMessages }
              await insert(entry)
              response.push(entry)
            } else {
              const nextItem = await buildItemFromOperations(nextOperations, id)
              const entry = { ...nextItem, messages: nextMessages }
              await insertItem(entry)
              response.push(entry)
            }
          }
        }
      }

      ctx.response.body = response

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      ctx.response.status = 400
      ctx.response.body = { error: errorMessage }
    }
  } else {
    ctx.response.status = 400
    ctx.response.body = { error: "Invalid request body" }
  }
}
