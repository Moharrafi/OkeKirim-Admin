<?php
/**
 * Database migration script - run once to create/update tables.
 * Called automatically from config.php, then cached via flag file.
 * Do NOT require config.php here (already loaded by caller).
 */

function run_migrations() {
    $flagFile = sys_get_temp_dir() . '/okekirim_migrated_' . md5(DB_HOST . DB_NAME) . '.flag';
    
    // Skip if already migrated in this server session (cache 1 hour)
    // Delete flag file manually or wait 1 hour to re-run migrations
    if (file_exists($flagFile) && (time() - filemtime($flagFile)) < 3600) {
        return;
    }
    
    $pdo = db();
    
    // Schedules table
    $pdo->exec("CREATE TABLE IF NOT EXISTS schedules (
      id INT AUTO_INCREMENT PRIMARY KEY,
      driver VARCHAR(255) DEFAULT NULL,
      vehicle VARCHAR(128) DEFAULT NULL,
      date DATE DEFAULT NULL,
      origin VARCHAR(255) DEFAULT NULL,
      destination VARCHAR(255) DEFAULT NULL,
      rit VARCHAR(32) DEFAULT NULL,
      orderType VARCHAR(32) DEFAULT 'online',
      fare INT DEFAULT 0,
      status VARCHAR(32) DEFAULT 'nunggak',
      companyShare INT DEFAULT 0,
      paidCompanyAmount INT DEFAULT 0,
      notes TEXT DEFAULT NULL,
      payment_notes TEXT DEFAULT NULL,
      lastPaidAt DATETIME DEFAULT NULL,
      paidOffAt DATETIME DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");
    
    try { $pdo->exec("ALTER TABLE schedules ADD COLUMN payment_notes TEXT DEFAULT NULL"); } catch (Throwable $e) {}
    try { $pdo->exec("ALTER TABLE schedules ADD COLUMN lastPaidAt DATETIME DEFAULT NULL"); } catch (Throwable $e) {}
    try { $pdo->exec("ALTER TABLE schedules ADD COLUMN paidOffAt DATETIME DEFAULT NULL"); } catch (Throwable $e) {}
    try { $pdo->exec("ALTER TABLE schedules MODIFY COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP"); } catch (Throwable $e) {}
    
    // Drivers table
    $pdo->exec("CREATE TABLE IF NOT EXISTS drivers (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      phone VARCHAR(64) DEFAULT NULL,
      email VARCHAR(255) DEFAULT NULL,
      address TEXT DEFAULT NULL,
      vehicle VARCHAR(128) DEFAULT NULL,
      vehicleType VARCHAR(64) DEFAULT NULL,
      vehicleYear VARCHAR(16) DEFAULT NULL,
      status VARCHAR(32) DEFAULT 'aktif',
      joinDate DATE DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");
    
    try { $pdo->exec("ALTER TABLE drivers MODIFY COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP"); } catch (Throwable $e) {}
    
    // Documents table
    $pdo->exec("CREATE TABLE IF NOT EXISTS documents (
      id INT AUTO_INCREMENT PRIMARY KEY,
      vehicle VARCHAR(128) DEFAULT NULL,
      type VARCHAR(128) DEFAULT NULL,
      expiry DATE DEFAULT NULL,
      renewalCost INT DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");
    
    $pdo->exec("CREATE TABLE IF NOT EXISTS document_renewals (
      id INT AUTO_INCREMENT PRIMARY KEY,
      document_id INT DEFAULT NULL,
      vehicle VARCHAR(128) DEFAULT NULL,
      driver VARCHAR(255) DEFAULT NULL,
      type VARCHAR(128) DEFAULT NULL,
      previous_expiry DATE DEFAULT NULL,
      new_expiry DATE DEFAULT NULL,
      cost INT DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_document (document_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");
    
    try { $pdo->exec("ALTER TABLE documents MODIFY COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP"); } catch (Throwable $e) {}
    try { $pdo->exec("ALTER TABLE document_renewals MODIFY COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP"); } catch (Throwable $e) {}
    
    // Services table
    $pdo->exec("CREATE TABLE IF NOT EXISTS services (
      id INT AUTO_INCREMENT PRIMARY KEY,
      vehicle VARCHAR(128) DEFAULT NULL,
      driver VARCHAR(255) DEFAULT NULL,
      type VARCHAR(128) DEFAULT NULL,
      date DATE DEFAULT NULL,
      cost INT DEFAULT NULL,
      status VARCHAR(32) DEFAULT 'terjadwal',
      receipt LONGTEXT DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");
    
    try { $pdo->exec("ALTER TABLE services ADD COLUMN receipt LONGTEXT DEFAULT NULL"); } catch (Throwable $e) {}
    try { $pdo->exec("ALTER TABLE services MODIFY COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP"); } catch (Throwable $e) {}
    
    // Debts table
    $pdo->exec("CREATE TABLE IF NOT EXISTS debts (
      id INT AUTO_INCREMENT PRIMARY KEY,
      driver VARCHAR(255) DEFAULT NULL,
      vehicle VARCHAR(128) DEFAULT NULL,
      type VARCHAR(64) DEFAULT 'kasbon',
      amount INT DEFAULT 0,
      date DATE DEFAULT NULL,
      dueDate DATE DEFAULT NULL,
      status VARCHAR(32) DEFAULT 'belum_lunas',
      paidAmount INT DEFAULT 0,
      lastPaidAt DATETIME DEFAULT NULL,
      paidOffAt DATETIME DEFAULT NULL,
      notes TEXT DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");
    
    $pdo->exec("CREATE TABLE IF NOT EXISTS debt_payments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      debt_id INT NOT NULL,
      driver VARCHAR(255) DEFAULT NULL,
      amount INT NOT NULL DEFAULT 0,
      paid_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      notes TEXT DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_debt_payments_debt FOREIGN KEY (debt_id) REFERENCES debts(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");
    
    try { $pdo->exec("ALTER TABLE debts MODIFY COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP"); } catch (Throwable $e) {}
    try { $pdo->exec("ALTER TABLE debt_payments MODIFY COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP"); } catch (Throwable $e) {}
    try { $pdo->exec("ALTER TABLE debt_payments MODIFY COLUMN id INT NOT NULL AUTO_INCREMENT"); } catch (Throwable $e) {}
    
    // Users table is managed by auth.php (ensure_users_table)
    // No need to create it here;

    // FCM tokens table
    $pdo->exec("CREATE TABLE IF NOT EXISTS fcm_tokens (
      id INT AUTO_INCREMENT PRIMARY KEY,
      driver_name VARCHAR(255) NOT NULL,
      token TEXT NOT NULL,
      role VARCHAR(32) DEFAULT 'driver',
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY unique_driver (driver_name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");

    try { $pdo->exec("ALTER TABLE fcm_tokens ADD COLUMN role VARCHAR(32) DEFAULT 'driver'"); } catch (Throwable $e) {}

    // Notifications log table
    $pdo->exec("CREATE TABLE IF NOT EXISTS notifications (
      id INT AUTO_INCREMENT PRIMARY KEY,
      target_role VARCHAR(32) DEFAULT 'admin',
      target_user VARCHAR(255) DEFAULT NULL,
      title VARCHAR(255) NOT NULL,
      body TEXT NOT NULL,
      type VARCHAR(64) DEFAULT 'info',
      data JSON DEFAULT NULL,
      is_read TINYINT(1) DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_target_role (target_role),
      INDEX idx_target_user (target_user),
      INDEX idx_is_read (is_read)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");
    
    // Mark as migrated
    @file_put_contents($flagFile, date('Y-m-d H:i:s'));
}

// Auto-run on include (wrapped in try/catch to never break the calling script)
try {
    run_migrations();
} catch (Throwable $e) {
    // Migration failed - not critical, tables may already exist
}
