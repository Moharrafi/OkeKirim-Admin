import pool from "@/lib/db"

let ensureFcmTokenTablePromise: Promise<void> | null = null

export function ensureFcmTokenTable() {
  if (!ensureFcmTokenTablePromise) {
    ensureFcmTokenTablePromise = (async () => {
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS fcm_tokens (
          id INT AUTO_INCREMENT PRIMARY KEY,
          driver_name VARCHAR(100) NOT NULL UNIQUE,
          token TEXT NOT NULL,
          role VARCHAR(20) NOT NULL DEFAULT 'driver',
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `)

      const [roleColumns] = await pool.execute("SHOW COLUMNS FROM fcm_tokens LIKE 'role'") as any
      if (!roleColumns || roleColumns.length === 0) {
        await pool.execute("ALTER TABLE fcm_tokens ADD COLUMN role VARCHAR(20) NOT NULL DEFAULT 'driver' AFTER token")
      }
    })().catch((error) => {
      ensureFcmTokenTablePromise = null
      throw error
    })
  }

  return ensureFcmTokenTablePromise
}
