const { getDb, initDb } = require('./src/db/database.js');

(async () => {
  await initDb();
  const today = new Date().toISOString().split('T')[0];
  console.log('📅 Buscando órdenes para:', today);
  
  const orders = getDb().prepare(`
    SELECT o.id, o.period, o.date, o.ordered_at,
           u.username, u.full_name, u.department, u.shift,
           i.name AS item_name, i.description AS item_description
    FROM canteen_orders o
    JOIN canteen_users u ON o.user_id = u.id
    JOIN canteen_items i ON o.item_id = i.id
    WHERE o.date = ?
    ORDER BY o.period, u.full_name ASC
  `).all(today);
  
  console.log('\n✅ Primeras 3 órdenes:');
  console.log(JSON.stringify(orders.slice(0, 3), null, 2));
  console.log('\n📊 Total órdenes para hoy:', orders.length);
  
  if (orders.length > 0) {
    console.log('\n🔑 Campos en la primera orden:');
    console.log(Object.keys(orders[0]));
  }
})();
