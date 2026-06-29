const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function run() {
  const envPath = path.join(__dirname, '..', '.env.local');
  const envContent = fs.readFileSync(envPath, 'utf8');
  const config = {};
  envContent.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) {
      config[parts[0].trim()] = parts.slice(1).join('=').trim();
    }
  });

  const connection = await mysql.createConnection({
    host: config.DB_HOST,
    port: parseInt(config.DB_PORT || '26140'),
    user: config.DB_USER,
    password: config.DB_PASS,
    database: config.DB_NAME || 'okekirim',
    ssl: { rejectUnauthorized: false }
  });

  try {
    const [rows] = await connection.execute("SELECT * FROM drivers WHERE name LIKE '%Ajay%'");
    console.log("Drivers matching Ajay:", JSON.stringify(rows, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await connection.end();
  }
}

run();
