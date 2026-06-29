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
    const [rows] = await connection.execute(
      "SELECT id, driver, vehicle, date, fare, status, lastPaidAt FROM schedules WHERE driver = 'Ajay' ORDER BY id DESC"
    );
    for (const r of rows) {
      console.log(`ID: ${r.id} | Driver: ${r.driver} | Vehicle: ${r.vehicle} | Date: ${r.date} | Fare: ${r.fare} | Status: ${r.status} | lastPaidAt: ${r.lastPaidAt}`);
    }
  } catch (err) {
    console.error(err);
  } finally {
    await connection.end();
  }
}

run();
