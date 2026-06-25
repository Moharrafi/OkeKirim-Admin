import mysql from "mysql2/promise"

// Reuse pool across hot reloads in Next.js development mode to prevent ER_CON_COUNT_ERROR (Too many connections)
const globalForDb = globalThis as unknown as {
  dbPool: mysql.Pool | undefined
}

const pool =
  globalForDb.dbPool ||
  mysql.createPool({
    host: process.env.DB_HOST || "",
    port: parseInt(process.env.DB_PORT || "26140"),
    user: process.env.DB_USER || "",
    password: process.env.DB_PASS || "",
    database: process.env.DB_NAME || "okekirim",
    ssl: { rejectUnauthorized: false },
    connectionLimit: 4,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
  })

if (process.env.NODE_ENV !== "production") {
  globalForDb.dbPool = pool
}

export default pool

