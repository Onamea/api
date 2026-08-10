import type { Message, Messages, Identity, NameKey, Operation, Id, Item } from "@onamea/types"
import { isMessage, verifyMessage, parseRawOperation, createCreateOperation, buildIdentityFromOperations, isNameKey, isSignedByOwner, isIdentityOperation } from "@onamea/types"

export type ValidatedMessage = Message & {
  operation: Operation
  isIdentity: boolean
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

const compareMessages = (a: Message, b: Message): boolean => {
  return a.raw === b.raw && a.publicKey === b.publicKey && a.signature === b.signature
}

export const filterDuplicateMessages = <T extends Message>(messages: T[]): T[] => {
  return messages.filter((currentMessage, index, self) =>
    index === self.findIndex(message => compareMessages(currentMessage, message))
  )
}

type R = Record<Id, ValidatedMessages>
type ValidatedMessagesRecord = { identity: R, item: R }
export const groupMessagesById = (messages: ValidatedMessages): ValidatedMessagesRecord => {

  const uniqueMessages = filterDuplicateMessages(messages)
  return uniqueMessages.reduce((acc, message) => {
    const { id } = message.operation
    const key = message.isIdentity ? "identity" : "item"
    if (acc[key][id] === undefined) {
      acc[key][id] = []
    }
    acc[key][id].push(message)
    return acc
  }, { identity: {}, item: {} } as ValidatedMessagesRecord)
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
  const isIdentity = isNameKey(operation.id) && await isSignedByOwner(incomingMessage)
  if (isIdentity === false && isIdentityOperation(operation)) {
    error = new Error("Operation is only allowed for Identity")
  }
  const isValid = error === undefined
  return { ...incomingMessage, operation, isIdentity, isValid, error }
}

export const validateMessages = async (incomingMessages: Messages): Promise<ValidatedMessages> => {
  const validatedMessages: ValidatedMessages = []
  for (const incomingMessage of incomingMessages) {
    validatedMessages.push(await validateMessage(incomingMessage))
  }
  return validatedMessages
}

export const validatedMessagesToMessages = (validatedMessages: ValidatedMessages): Messages => {
  return validatedMessages.map(({ raw, cryptoName, publicKey, signature, datetime }) => ({ raw, cryptoName, publicKey, signature, datetime }))
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
