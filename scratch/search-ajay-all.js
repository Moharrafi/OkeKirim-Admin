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
    // List tables
    const [tables] = await connection.execute("SHOW TABLES");
    console.log("Database tables:");
    const tableNames = tables.map(row => Object.values(row)[0]);
    console.log(tableNames);

    for (const table of tableNames) {
      // Find columns
      const [columns] = await connection.execute(`SHOW COLUMNS FROM \`${table}\``);
      const textColumns = columns
        .filter(c => c.Type.includes('varchar') || c.Type.includes('text') || c.Type.includes('char'))
        .map(c => c.Field);

      if (textColumns.length === 0) continue;

      const conditions = textColumns.map(col => `\`${col}\` LIKE '%Ajay%'`).join(' OR ');
      const [results] = await connection.execute(`SELECT * FROM \`${table}\` WHERE ${conditions}`);
      if (results.length > 0) {
        console.log(`\nFound matches in table "${table}":`);
        console.log(JSON.stringify(results, null, 2));
      }
    }
  } catch (err) {
    console.error(err);
  } finally {
    await connection.end();
  }
}

run();
