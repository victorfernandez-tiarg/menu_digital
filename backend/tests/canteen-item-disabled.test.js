/**
 * Test: Item Disabled Race Condition
 * 
 * Simula: Admin deshabilita un plato justo cuando un staff intenta pedirlo
 * Esperado: Backend rechaza con código ITEM_DISABLED y mensaje claro
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const { initDb, getDb } = require('../src/db/database');
const { createApp } = require('../src/app');

// Limpiar DB antes de empezar
const dbPath = path.join(__dirname, '../../data/menu.db');
if (fs.existsSync(dbPath)) {
  fs.unlinkSync(dbPath);
  console.log('🗑️  DB anterior eliminada\n');
}

// Limpiar también el module cache de database.js para forzar reload
delete require.cache[require.resolve('../src/db/database')];
const dbModule = require('../src/db/database');
const { initDb: freshInitDb, getDb: freshGetDb } = dbModule;

let server;
let adminToken, staffToken;
let staffUserId, itemId;

async function setup() {
  await freshInitDb();
  const db = freshGetDb();

  // Limpiar cualquier orden previa para el test
  db.prepare('DELETE FROM canteen_orders').run();

  // Obtener IDs desde la DB
  const staff = db.prepare('SELECT id FROM canteen_users WHERE username = ?').get('juan_garcia');
  const item = db.prepare('SELECT id FROM canteen_items WHERE name = ? LIMIT 1').get('Café con leche');

  staffUserId = staff.id;
  itemId = item.id;

  // Generar tokens
  const jwt = require('jsonwebtoken');
  const JWT_SECRET = require('../src/middleware/auth').JWT_SECRET;

  adminToken = jwt.sign(
    { id: 1, username: 'admin', role: 'admin', type: 'canteen' },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  staffToken = jwt.sign(
    { id: staffUserId, username: 'juan_garcia', role: 'staff', shift: 'morning', type: 'canteen' },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  // Arrancar servidor
  const app = createApp();
  server = app.listen(3099, () => {
    console.log('✅ Test server running on 3099');
  });
}

function request(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3099,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          body: JSON.parse(data || '{}'),
        });
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function testItemDisabledRaceCondition() {
  console.log('\n🔬 TEST: Item Disabled Race Condition\n');

  // Step 1: Verificar que el item está disponible
  console.log('1️⃣ Verificar que Café con leche está disponible...');
  const db = freshGetDb();
  let item = db.prepare('SELECT available, name, id FROM canteen_items WHERE name = ?').get('Café con leche');
  console.log(`   Item ID: ${item.id}`);
  console.log(`   Available value: ${item.available} (type: ${typeof item.available})`);
  console.log(`   Status: ${item.available ? '✅ Available' : '❌ Disabled'}`);

  // Step 2: Intentar pedir el item (debería funcionar)
  console.log('\n2️⃣ Staff intenta pedir Café con leche (todavía está disponible)...');
  const today = new Date().toISOString().split('T')[0];
  let res1 = await request('POST', '/api/comedor/orders', 
    { item_id: itemId, date: today },
    staffToken
  );
  console.log(`   Status: ${res1.status}`);
  console.log(`   Response: ${JSON.stringify(res1.body, null, 2)}`);

  const orderId = res1.body.id;

  // Step 3: Admin deshabilita el plato
  console.log('\n3️⃣ Admin deshabilita el plato...');
  let res2 = await request('PUT', `/api/comedor/admin/items/${itemId}`,
    {
      name: 'Café con leche',
      description: 'Bebida caliente de café con leche entera',
      period: 'desayuno',
      order_index: 1,
      available: 0, // ← Deshabilitar
    },
    adminToken
  );
  console.log(`   Status: ${res2.status}`);
  console.log(`   Item available: ${res2.body.available}`);

  // Verificar en DB
  item = db.prepare('SELECT available FROM canteen_items WHERE id = ?').get(itemId);
  console.log(`   DB check: available=${item.available}`);

  // Step 4: Otro staff intenta pedir el mismo plato (debería fallar con ITEM_DISABLED)
  console.log('\n4️⃣ Otro staff intenta pedir Café con leche (ya está deshabilitado)...');
  let res3 = await request('POST', '/api/comedor/orders',
    { item_id: itemId, date: today },
    staffToken
  );
  console.log(`   Status: ${res3.status} ${res3.status === 409 ? '✅' : '❌'}`);
  console.log(`   Error code: ${res3.body.code} ${res3.body.code === 'ITEM_DISABLED' ? '✅' : '❌'}`);
  console.log(`   Message: "${res3.body.error}"`);

  // Validaciones
  const pass1 = res1.status === 201;
  const pass2 = res2.status === 200 && res2.body.available === 0;
  const pass3 = res3.status === 409 && res3.body.code === 'ITEM_DISABLED';

  console.log('\n' + '='.repeat(60));
  console.log('📊 RESULTADOS:');
  console.log(`  ${pass1 ? '✅' : '❌'} Primera orden: éxito (201)`);
  console.log(`  ${pass2 ? '✅' : '❌'} Item deshabilitado: exitoso`);
  console.log(`  ${pass3 ? '✅' : '❌'} Segunda orden: rechazada (409 + ITEM_DISABLED)`);
  console.log('='.repeat(60) + '\n');

  return pass1 && pass2 && pass3;
}

async function run() {
  try {
    await setup();
    const passed = await testItemDisabledRaceCondition();
    process.exit(passed ? 0 : 1);
  } catch (err) {
    console.error('❌ Test error:', err);
    process.exit(1);
  } finally {
    if (server) server.close();
  }
}

run();
