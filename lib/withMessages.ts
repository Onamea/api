import type { Message } from "@onamea/crdt"

type MessageStore = {
  getMessages: (id: string) => Promise<Message[]>
}

export const withMessage = async <Entity extends { id: string }>(entity: Entity, messageStore: MessageStore) => ({
  ...entity,
  messages: await messageStore.getMessages(entity.id)
})

export const withMessages = async <Entity extends { id: string }>(entities: Entity[], messageStore: MessageStore) =>
  await Promise.all(entities.map(async entity => await withMessage(entity, messageStore)))
