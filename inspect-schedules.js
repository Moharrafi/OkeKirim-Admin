const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

// Load .env.local
try {
  const envPath = path.join(__dirname, '.env.local');
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const parts = line.trim().split('=');
    if (parts.length >= 2 && !line.startsWith('#')) {
      const key = parts[0].trim();
      const val = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
      process.env[key] = val;
    }
  });
} catch (e) {
  console.warn("Failed to load .env.local");
}

async function main() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || "",
    port: parseInt(process.env.DB_PORT || "26140"),
    user: process.env.DB_USER || "",
    password: process.env.DB_PASS || "",
    database: process.env.DB_NAME || "okekirim",
    ssl: { rejectUnauthorized: false },
  });

  try {
    console.log("=== SCHEDULES UPDATED TODAY ===");
    const [rows] = await pool.execute(`
      SELECT id, driver, 
             DATE_FORMAT(lastPaidAt, '%Y-%m-%d %H:%i:%s') as rawLastPaidAt,
             DATE_FORMAT(DATE_ADD(lastPaidAt, INTERVAL 7 HOUR), '%Y-%m-%d %H:%i:%s') as rawJakartaDateTime,
             paidCompanyAmount
      FROM schedules 
      WHERE DATE(DATE_ADD(lastPaidAt, INTERVAL 7 HOUR)) = '2026-06-28'
    `);
    console.log(rows);
  } catch (err) {
    console.error(err);
  } finally {
    // End the pool
    try { await pool.end(); } catch {}
  }
}

main();
