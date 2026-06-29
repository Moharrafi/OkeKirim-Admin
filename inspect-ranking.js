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

function addOneMonth(dateString) {
  const [year, month] = dateString.split("-").map(Number);
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  return `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;
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
    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

    console.log("Current Month Start:", monthStart);

    const [monthlyCountRows] = await pool.execute(
      "SELECT COUNT(*) as count FROM schedules WHERE date >= ?",
      [monthStart]
    );
    const currentMonthCount = monthlyCountRows[0].count;
    console.log("Current Month Trip Count:", currentMonthCount);

    const [latestMonthRows] = await pool.execute(
      "SELECT DATE_FORMAT(MAX(date), '%Y-%m-01') as monthStart FROM schedules WHERE date IS NOT NULL"
    );
    const latestMonthStart = latestMonthRows[0].monthStart;
    console.log("Latest Month with Trips in DB:", latestMonthStart);

    let driverChartMonthStart = monthStart;
    if (currentMonthCount === 0 && latestMonthStart) {
      driverChartMonthStart = latestMonthStart;
    }
    const driverChartMonthEnd = addOneMonth(driverChartMonthStart);
    console.log("Selected Ranking Month:", driverChartMonthStart, "to", driverChartMonthEnd);

    console.log("\n=== DRIVER INCOME QUERY RESULTS ===");
    const [driverIncome] = await pool.execute(
      `SELECT s.driver, CAST(SUM(s.companyShare) AS UNSIGNED) as total, COUNT(*) as trips
       FROM schedules s 
       WHERE s.date >= ? AND s.date < ?
       GROUP BY s.driver 
       ORDER BY total DESC`,
      [driverChartMonthStart, driverChartMonthEnd]
    );
    console.log(driverIncome);

    console.log("\n=== DRIVER DEPOSIT BY MONTH RESULTS ===");
    const [driverDepositByMonth] = await pool.execute(
      `SELECT s.driver,
              CAST(COALESCE(SUM(s.fare), 0) AS UNSIGNED) as totalFare,
              CAST(COALESCE(SUM(s.companyShare), 0) AS UNSIGNED) as total,
              COUNT(*) as trips
       FROM schedules s
       WHERE s.date >= ? AND s.date < ?
       GROUP BY s.driver
       ORDER BY total DESC`,
      [driverChartMonthStart, driverChartMonthEnd]
    );
    console.log(driverDepositByMonth);

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

main();
