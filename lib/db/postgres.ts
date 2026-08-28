import type { FingerprintDisplay, Name, NameKey } from "@onamea/types"
import type { Identity, Messages } from "@onamea/crdt"
import { fingerprintDisplayStartsWith, nameKeyToFingerprintDisplay, parseNameKey } from "@onamea/types"
import { Client, type ClientOptions } from "@db/postgres"

const options: ClientOptions = {
  user: "onamea",
  password: "<PASSWORD>",
  database: "onamea",
  hostname: "localhost",
  port: 5432
}

const client = new Client(options)
await client.connect()

export type IdentityWithMessages = Identity & { messages: Messages }

type IdentityRow = { identity: IdentityWithMessages }

export const retrieveAll = async (): Promise<IdentityWithMessages[]> => {
  const result = await client.queryObject({
    text: "SELECT identity FROM identities ORDER BY id"
  })
  return (result.rows as IdentityRow[]).map(({ identity }) => identity)
}

export const retrieveById = async (id: NameKey): Promise<IdentityWithMessages | undefined> => {
  const result = await client.queryObject({
    text: "SELECT identity FROM identities WHERE id = $1",
    args: [id]
  })
  const row = (result.rows as IdentityRow[])[0]
  return row?.identity
}

export const retrieveByName = async (
  name: Name,
  fingerprintDisplaySuffix?: FingerprintDisplay
): Promise<IdentityWithMessages[]> => {
  const result = await client.queryObject({
    text: "SELECT identity FROM identities WHERE name = $1",
    args: [name]
  })
  const identities = (result.rows as IdentityRow[]).map(({ identity }) => identity)
  if (fingerprintDisplaySuffix === undefined) {
    return identities
  }
  const matchingIdentities: IdentityWithMessages[] = []
  for (const identity of identities) {
    const fingerprintDisplay = await nameKeyToFingerprintDisplay(identity.id)
    if (fingerprintDisplayStartsWith(fingerprintDisplay, fingerprintDisplaySuffix)) {
      matchingIdentities.push(identity)
    }
  }
  return matchingIdentities
}

export const insert = async (identity: IdentityWithMessages) => {
  const [, name] = parseNameKey(identity.id)
  await client.queryObject({
    text:
      "INSERT INTO identities (id, name, identity) VALUES ($1, $2, $3::jsonb) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, identity = EXCLUDED.identity",
    args: [identity.id, name, JSON.stringify(identity)]
  })
}
