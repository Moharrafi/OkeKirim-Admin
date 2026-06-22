import mysql from "mysql2/promise"

// Use a pool with a connection limit of 4 to respect Aiven free tier limits while enabling concurrent queries
const pool = mysql.createPool({
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

export default pool

