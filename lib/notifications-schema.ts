import pool from "@/lib/db"

let ensureNotificationsTablePromise: Promise<void> | null = null

export function ensureNotificationsTable() {
  if (!ensureNotificationsTablePromise) {
    ensureNotificationsTablePromise = pool.execute(`
      CREATE TABLE IF NOT EXISTS notifications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        target_role VARCHAR(32) NOT NULL,
        title VARCHAR(255) NOT NULL,
        body TEXT NOT NULL,
        type VARCHAR(64) NOT NULL DEFAULT 'info',
        data JSON NULL,
        is_read TINYINT(1) NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_notifications_role_read_created (target_role, is_read, created_at),
        INDEX idx_notifications_created (created_at)
      )
    `)
      .then(() => undefined)
      .catch((error) => {
        ensureNotificationsTablePromise = null
        throw error
      })
  }

  return ensureNotificationsTablePromise
}
