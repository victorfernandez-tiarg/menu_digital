const { getDb, initDb } = require('./src/db/database.js');

(async () => {
  await initDb();
  const today = new Date().toISOString().split('T')[0];
  
  const db = getDb();
  
  // Obtener IDs de usuarios y items
  const users = db.prepare('SELECT id FROM canteen_users LIMIT 4').all();
  const items = db.prepare('SELECT id, period FROM canteen_items LIMIT 8').all();
  
  console.log('📝 Creando órdenes de prueba para hoy...');
  
  // Crear 5 órdenes de prueba
  const insertOrder = db.prepare(
    'INSERT INTO canteen_orders (user_id, item_id, period, date, ordered_at) VALUES (?, ?, ?, ?, ?)'
  );
  
  insertOrder.run(users[0].id, items[0].id, items[0].period, today, new Date().toISOString());
  insertOrder.run(users[1].id, items[0].id, items[0].period, today, new Date().toISOString());
  insertOrder.run(users[2].id, items[1].id, items[1].period, today, new Date().toISOString());
  insertOrder.run(users[0].id, items[2].id, items[2].period, today, new Date().toISOString());
  insertOrder.run(users[3].id, items[0].id, items[0].period, today, new Date().toISOString());
  
  console.log('✅ Órdenes creadas\n');
  
  // Ahora consultar como lo hace el admin
  const orders = db.prepare(`
    SELECT o.id, o.period, o.date, o.ordered_at,
           u.username, u.full_name, u.department, u.shift,
           i.name AS item_name, i.description AS item_description
    FROM canteen_orders o
    JOIN canteen_users u ON o.user_id = u.id
    JOIN canteen_items i ON o.item_id = i.id
    WHERE o.date = ?
    ORDER BY o.period, u.full_name ASC
  `).all(today);
  
  console.log('📊 Órdenes devueltas (5 total):');
  orders.forEach((o, i) => {
    console.log(`${i+1}. ${o.full_name} - ${o.item_name} (${o.period})`);
  });
  
  console.log('\n🔑 Estructura de primera orden:');
  console.log(JSON.stringify(orders[0], null, 2));
})();
