import type { NameKey } from "@onamea/types"
import { messageToHash } from "@onamea/types"
import type { Message, Messages, Identity, Operation, Id, Item } from "@onamea/crdt"
import { isNameKey } from "@onamea/types"
import {
  isMessage,
  verifyMessage,
  parseRawOperation,
  createCreateOperation,
  buildIdentityFromOperations,
  isSignedByOwner,
  isIdentityOperation
} from "@onamea/crdt"

export type ValidatedMessage = Message & {
  operation: Operation
  isOwnerSigned: boolean
  isValid: boolean
  error?: Error
}
export type ValidatedMessages = ValidatedMessage[]

export const areIncomingMessages = (arr: unknown[]): arr is Messages => {
  return arr.length > 0 && arr.every(isMessage)
}

export const cleanIncomingMessage = (obj: Message): Message => {
  const { raw, cryptoName, publicKey, signature, datetime } = obj
  return { raw, cryptoName, publicKey, signature, datetime }
}

export const cleanIncomingMessages = (arr: Messages): Messages => {
  return arr.map(cleanIncomingMessage)
}

const compareMessages = (a: ValidatedMessage, b: ValidatedMessage): boolean => {
  return (
    a.operation.hash === b.operation.hash &&
    a.cryptoName === b.cryptoName &&
    a.publicKey === b.publicKey &&
    a.signature === b.signature
  )
}

export const filterDuplicateMessages = (messages: ValidatedMessages): ValidatedMessages => {
  return messages.filter(
    (currentMessage, index, self) => index === self.findIndex(message => compareMessages(currentMessage, message))
  )
}

export const isAcceptedMessage = async (
  messages: Messages | undefined,
  message: ValidatedMessage
): Promise<boolean> => {
  for (const existingMessage of messages ?? []) {
    if (
      existingMessage.publicKey === message.publicKey &&
      existingMessage.cryptoName === message.cryptoName &&
      existingMessage.signature === message.signature &&
      (await messageToHash(existingMessage.raw)) === message.operation.hash
    ) {
      return false
    }
  }
  return true
}

export const groupMessagesById = (messages: ValidatedMessages): Map<Id, ValidatedMessages> => {
  const uniqueMessages = filterDuplicateMessages(messages)
  const groupedMessages = new Map<Id, ValidatedMessages>()

  for (const message of uniqueMessages) {
    const { id } = message.operation
    const messagesForId = groupedMessages.get(id) ?? []
    messagesForId.push(message)
    groupedMessages.set(id, messagesForId)
  }

  return groupedMessages
}

// parse
// validate
// verify
export const validateMessage = async (incomingMessage: Message): Promise<ValidatedMessage> => {
  const { raw } = incomingMessage
  const operation = await parseRawOperation(raw)
  const isVerified = await verifyMessage(incomingMessage)
  let error: Error | undefined = undefined
  if (isVerified === false) {
    error = new Error("Operation verification failed")
  }
  const isOwnerSigned = isNameKey(operation.id) && (await isSignedByOwner(incomingMessage))
  if (isOwnerSigned === false && isIdentityOperation(operation)) {
    error = new Error("Operation is only allowed for Identity")
  }
  const isValid = error === undefined
  return { ...incomingMessage, operation, isOwnerSigned, isValid, error }
}

export const validateMessages = async (incomingMessages: Messages): Promise<ValidatedMessages> => {
  const validatedMessages: ValidatedMessages = []
  for (const incomingMessage of incomingMessages) {
    validatedMessages.push(await validateMessage(incomingMessage))
  }
  return validatedMessages
}

export const validatedMessagesToMessages = (validatedMessages: ValidatedMessages): Messages => {
  return validatedMessages.map(({ raw, cryptoName, publicKey, signature, datetime }) => ({
    raw,
    cryptoName,
    publicKey,
    signature,
    datetime
  }))
}

export const isAcceptedOperation = (item: Item | undefined, operation: Operation): boolean => {
  if (item === undefined) {
    return operation.type === "CREATE"
  }
  return item.operations.some(({ hash }) => hash === operation.hash) === false
}

export const buildFromNameKey = async (nameKey: NameKey): Promise<Identity> => {
  const createOperation = await createCreateOperation(nameKey)
  return await buildIdentityFromOperations([createOperation], nameKey)
}
