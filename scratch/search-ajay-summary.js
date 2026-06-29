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
    const [tables] = await connection.execute("SHOW TABLES");
    const tableNames = tables.map(row => Object.values(row)[0]);

    for (const table of tableNames) {
      const [columns] = await connection.execute(`SHOW COLUMNS FROM \`${table}\``);
      const textColumns = columns
        .filter(c => c.Type.includes('varchar') || c.Type.includes('text') || c.Type.includes('char'))
        .map(c => c.Field);

      if (textColumns.length === 0) continue;

      const conditions = textColumns.map(col => `\`${col}\` LIKE '%Ajay%'`).join(' OR ');
      const [results] = await connection.execute(`SELECT * FROM \`${table}\` WHERE ${conditions}`);
      if (results.length > 0) {
        console.log(`Table: ${table} (${results.length} rows found)`);
        for (const row of results) {
          console.log("  Row ID:", row.id, "Name/Driver:", row.name || row.driver, "Status:", row.status, "HasPassword:", row.password_hash ? "Yes" : "No");
        }
      }
    }
  } catch (err) {
    console.error(err);
  } finally {
    await connection.end();
  }
}

run();
