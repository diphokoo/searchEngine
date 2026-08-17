import pg from 'pg'
import { config } from '../config.js'

const { Pool } = pg

export const pool = new Pool(config.db)

pool.on('error', (err) => {
  console.error('Unexpected DB pool error', err)
})

export async function query<T = pg.QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<pg.QueryResult<T>> {
  return pool.query<T>(text, params)
}
