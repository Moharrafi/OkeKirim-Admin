const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function migrate() {
  console.log('Starting migration...');
  
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
    // Check if column orderProof exists
    const [columns] = await connection.execute(
      `SHOW COLUMNS FROM schedules LIKE 'orderProof'`
    );

    if (columns.length > 0) {
      console.log("Column 'orderProof' already exists. Migration not needed.");
    } else {
      console.log("Adding column 'orderProof' of type MEDIUMTEXT to 'schedules' table...");
      await connection.execute(
        `ALTER TABLE schedules ADD COLUMN orderProof MEDIUMTEXT DEFAULT NULL`
      );
      console.log("Column 'orderProof' successfully added!");
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
