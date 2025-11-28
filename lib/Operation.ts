import type { Message, Identity, NameKey, Operation } from "@vanice/types"
import { isMessage, verifyMessage, parseRawOperation, createCreateOperation, buildFromOperations } from "@vanice/types"

type ValidatedMessage = Message & {
  operation: Operation
}
type ValidatedMessages = ValidatedMessage[]

export const areIncomingMessages = (arr: unknown[]): arr is Message[] => {
  return arr.every(isMessage)
}

export const cleanIncomingMessage = (obj: Message): Message => {
  const { raw, cryptoName, publicKey, signature, datetime } = obj
  return { raw, cryptoName, publicKey, signature, datetime }
}

export const cleanIncomingMessages = (arr: Message[]): Message[] => {
  return arr.map(cleanIncomingMessage)
}

export const groupMessagesById = (messages: ValidatedMessages): Record<NameKey, ValidatedMessages> => {
  return messages.reduce((acc, message) => {
    const { id } = message.operation
    if (acc[id] === undefined) {
      acc[id] = []
    }
    acc[id].push(message)
    return acc
  }, {} as Record<NameKey, ValidatedMessages>)
}

// parse
// validate
// verify
export const validateMessage = async (incomingMessage: Message): Promise<ValidatedMessage> => {
  const { raw } = incomingMessage
  const operation = await parseRawOperation(raw)
  const isVerified = await verifyMessage(incomingMessage)
  if (isVerified === false) {
    throw new Error("Operation verification failed")
  }
  return { ...incomingMessage, operation }
}

export const validateMessages = async (incomingMessages: Message[]): Promise<ValidatedMessage[]> => {
  const validatedMessages: ValidatedMessage[] = []
  for (const incomingMessage of incomingMessages) {
    validatedMessages.push(await validateMessage(incomingMessage))
  }
  return validatedMessages
}

export const isAcceptedOperation = (identity: Identity | undefined, operation: Operation): boolean => {
  if (identity === undefined) {
    return operation.type === "CREATE"
  }
  return identity.operations.some(({ hash }) => hash === operation.hash) === false
}

export const buildFromNameKey = async (nameKey: NameKey): Promise<Identity> => {
  const createOperation = await createCreateOperation(nameKey)
  return await buildFromOperations([createOperation], nameKey)
}