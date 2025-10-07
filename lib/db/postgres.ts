import type { Fingerprint, Name } from "@vanice/types"
import { toPrimaryChars } from "@vanice/types"
import type { ExtendedData } from "../Data.ts"
import { type ClientOptions, Client } from "@db/postgres"

const options: ClientOptions = {
  user: "vanice",
  password: "<PASSWORD>",
  database: "vanice",
  hostname: "localhost",
  port: 5432
}

const client = new Client(options)
await client.connect()

export const retrieveAll = async (): Promise<ExtendedData[]> => {
  const result = await client.queryObject({
    text: "SELECT * FROM data"
  })
  const values: ExtendedData[] = result.rows as ExtendedData[]
  values.sort((a, b) => a.primaryKey.localeCompare(b.primaryKey))
  return values
}

export const retrieveByName = async (name: Name, fingerprint: Fingerprint | undefined): Promise<ExtendedData[]> => {
  const primaryName = toPrimaryChars(name)
  let query = "SELECT * FROM data WHERE primaryname = $1"
  const params = [primaryName]
  if (fingerprint !== undefined) {
    query += " AND fingerprint LIKE $2"
    params.push(`${fingerprint}%`)
  }
  const result = await client.queryObject({
    text: query,
    args: params
  })
  return result.rows as ExtendedData[]
}

export const insert = async (data: ExtendedData) => {
  const fields = Object.keys(data)
  const values = Object.values(data)
  const valuesString = fields.map((_, i) => `$${i + 1}`).join(", ")
  const updateFields = fields.map((field) => `${field} = EXCLUDED.${field}`).join(", ")
  const query = `INSERT INTO data (${
    fields.join(", ")
  }) VALUES (${valuesString}) ON CONFLICT (primarykey) DO UPDATE SET ${updateFields}`
  await client.queryObject({
    text: query,
    args: values
  })
}
