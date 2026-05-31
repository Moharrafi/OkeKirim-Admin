import mysql from "mysql2/promise"
import type { ExecuteValues, QueryValues } from "mysql2"

// Use a single connection instead of pool to avoid exceeding Aiven free tier limit
let connection: mysql.Connection | null = null

async function getConnection() {
  if (connection) {
    try {
      await connection.ping()
      return connection
    } catch {
      connection = null
    }
  }
  connection = await mysql.createConnection({
    host: process.env.DB_HOST || "",
    port: parseInt(process.env.DB_PORT || "26140"),
    user: process.env.DB_USER || "",
    password: process.env.DB_PASS || "",
    database: process.env.DB_NAME || "okekirim",
    ssl: { rejectUnauthorized: false },
  })
  return connection
}

// Pool-compatible wrapper that uses single connection
const pool = {
  async execute(sql: string, params?: ExecuteValues) {
    const conn = await getConnection()
    return conn.execute(sql, params)
  },
  async query(sql: string, params?: QueryValues) {
    const conn = await getConnection()
    return conn.query(sql, params)
  },
}

export default pool
