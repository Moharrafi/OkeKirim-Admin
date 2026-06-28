const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function migrate() {
  console.log('Starting MySQL index migration...');
  
  // Load .env.local
  const envPath = path.join(__dirname, '..', '.env.local');
  if (!fs.existsSync(envPath)) {
    console.error('.env.local file not found!');
    process.exit(1);
  }
  
  const envContent = fs.readFileSync(envPath, 'utf8');
  const config = {};
  envContent.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const val = parts.slice(1).join('=').trim();
      config[key] = val;
    }
  });

  const dbConfig = {
    host: config.DB_HOST,
    port: parseInt(config.DB_PORT || '26140'),
    user: config.DB_USER,
    password: config.DB_PASS,
    database: config.DB_NAME || 'okekirim',
    ssl: { rejectUnauthorized: false }
  };

  console.log(`Connecting to ${dbConfig.host}:${dbConfig.port}...`);
  const connection = await mysql.createConnection(dbConfig);

  try {
    // Helper to check if index exists
    const indexExists = async (tableName, indexName) => {
      const [rows] = await connection.execute(
        `SHOW INDEX FROM \`${tableName}\` WHERE Key_name = ?`,
        [indexName]
      );
      return rows.length > 0;
    };

    // 1. Add idx_schedules_driver_date
    const hasDriverDateIndex = await indexExists('schedules', 'idx_schedules_driver_date');
    if (hasDriverDateIndex) {
      console.log("Index 'idx_schedules_driver_date' already exists.");
    } else {
      console.log("Adding index 'idx_schedules_driver_date' to 'schedules' table...");
      await connection.execute(
        `ALTER TABLE schedules ADD INDEX idx_schedules_driver_date (driver, date)`
      );
      console.log("Index 'idx_schedules_driver_date' successfully added!");
    }

    // 2. Add idx_schedules_status_date
    const hasStatusDateIndex = await indexExists('schedules', 'idx_schedules_status_date');
    if (hasStatusDateIndex) {
      console.log("Index 'idx_schedules_status_date' already exists.");
    } else {
      console.log("Adding index 'idx_schedules_status_date' to 'schedules' table...");
      await connection.execute(
        `ALTER TABLE schedules ADD INDEX idx_schedules_status_date (status, date)`
      );
      console.log("Index 'idx_schedules_status_date' successfully added!");
    }

  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await connection.end();
    console.log('Migration finished.');
  }
}

migrate().catch(err => {
  console.error(err);
  process.exit(1);
});
