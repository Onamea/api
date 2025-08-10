import type { Fingerprint, Name } from "@vanice/types"
import { toPrimaryChars } from "@vanice/types"
import type { ExtendedData } from "../Data.ts"
import type { ClientOptions } from "https://deno.land/x/postgres@v0.17.0/mod.ts"
import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts"

const options: ClientOptions = {
  user: "your_user",
  password: "your_password",
  database: "your_db",
  hostname: "localhost",
  port: 5432
}

const client = new Client(options)
await client.connect()

export const retrieveAll = async (): Promise<ExtendedData[]> => {
  const result = await client.queryObject({
    text: "SELECT * FROM vanice_data"
  })
  const values: ExtendedData[] = result.rows as ExtendedData[]
  values.sort((a, b) => a.primaryKey.localeCompare(b.primaryKey))
  return values
}

export const retrieveByName = async (name: Name, fingerprint: Fingerprint | undefined): Promise<ExtendedData[]> => {
  const primaryName = toPrimaryChars(name)
  let query = "SELECT * FROM vanice_data WHERE primaryName = $1"
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
  const placeholders = fields.map((_, i) => `$${i + 1}`).join(", ")
  const query = `INSERT INTO vanice_data (${fields.join(", ")}) VALUES (${placeholders})`
  await client.queryObject({
    text: query,
    args: values
  })
}
