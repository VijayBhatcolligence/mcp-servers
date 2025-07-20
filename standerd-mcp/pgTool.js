// pgTool.js
require('dotenv').config();
const { Pool } = require('pg');

// Setup PostgreSQL connection
const pool = new Pool({
  user: process.env.DB_USER || 'youruser',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'yourdb',
  password: process.env.DB_PASSWORD || 'yourpassword',
  port: process.env.DB_PORT || 5432,
});

// Main function
console.log('🔗 Connected to PostgreSQL database:', process.env.DB_NAME || 'yourdb');

async function runQuery(sql) {
  try {
    const result = await pool.query(sql);
    return result.rows; // ✅ This returns the query result
  } catch (err) {
    console.error('Query error:', err);
    throw err; // 🔁 Important to rethrow so calling function knows it failed
  }
}

// Run if called from command line
if (require.main === module) {
  const query = process.argv.slice(2).join(' ');
  
  if (!query) {
    console.error("❌ Please provide a SQL query as an argument.");
    process.exit(1);
  }
  
  // FIX 1: Need to handle async function properly
  runQuery(query)
    .then(result => {
      console.log('✅ Query executed successfully:');
      console.log(JSON.stringify(result, null, 2));
      process.exit(0); // Exit successfully
    })
    .catch(err => {
      console.error('❌ Query failed:', err.message);
      process.exit(1); // Exit with error
    });
}

module.exports = { runQuery };