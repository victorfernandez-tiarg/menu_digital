const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { initDb } = require('./db/database');
const { createApp } = require('./app');
const app = createApp();
const PORT = process.env.PORT || 3001;

async function start() {
  await initDb();
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
