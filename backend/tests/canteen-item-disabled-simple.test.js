/**
 * Test Simple: Item Disabled Validation
 * 
 * Valida: Backend rechaza órdenes de platos deshabilitados con código ITEM_DISABLED
 * Propósito: Demostrar que la race condition está manejada correctamente
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const { initDb, getDb } = require('../src/db/database');
const { createApp } = require('../src/app');

let server;
let staffToken;

async function setup() {
  await initDb();
  const db = getDb();

  // Obtener staff user
  const staff = db.prepare('SELECT id FROM canteen_users WHERE username = ?').get('juan_garcia');

  // Generar token
  const jwt = require('jsonwebtoken');
  const JWT_SECRET = require('../src/middleware/auth').JWT_SECRET;

  staffToken = jwt.sign(
    { id: staff.id, username: 'juan_garcia', role: 'staff', shift: 'morning', type: 'canteen' },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  // Arrancar servidor
  const app = createApp();
  server = app.listen(3098, () => {});
}

function request(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3098,
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

async function testItemDisabledValidation() {
  console.log('\n✅ TEST: Item Disabled Validation\n');

  // Obtener un plato del menú
  const db = getDb();
  let item = db.prepare('SELECT * FROM canteen_items LIMIT 1').get();
  
  if (!item) {
    console.log('❌ No hay items en la DB');
    return false;
  }

  const itemId = item.id;
  const originalAvailable = item.available;

  console.log(`📋 Probando con: "${item.name}" (ID: ${itemId})`);
  console.log(`   Estado inicial: available=${originalAvailable}\n`);

  // Step 1: Deshabilitar el plato
  console.log('1️⃣ Deshabilitar el plato en la BD...');
  db.prepare('UPDATE canteen_items SET available = 0 WHERE id = ?').run(itemId);
  let updated = db.prepare('SELECT available FROM canteen_items WHERE id = ?').get(itemId);
  console.log(`   ✅ Plato deshabilitado: available=${updated.available}\n`);

  // Step 2: Intentar pedir el plato deshabilitado
  const today = new Date().toISOString().split('T')[0];
  console.log('2️⃣ Staff intenta pedir el plato deshabilitado...');
  let res = await request('POST', '/api/comedor/orders',
    { item_id: itemId, date: today },
    staffToken
  );

  console.log(`   Status: ${res.status}`);
  console.log(`   Error code: "${res.body.code}"`);
  console.log(`   Message: "${res.body.error}"\n`);

  // Validaciones
  const pass1 = res.status === 409;
  const pass2 = res.body.code === 'ITEM_DISABLED';
  const pass3 = res.body.error && res.body.error.includes('deshabilitado');

  console.log('='.repeat(60));
  console.log('📊 VALIDACIONES:');
  console.log(`  ${pass1 ? '✅' : '❌'} Status 409 (Conflict): ${pass1}`);
  console.log(`  ${pass2 ? '✅' : '❌'} Code 'ITEM_DISABLED': ${pass2}`);
  console.log(`  ${pass3 ? '✅' : '❌'} Mensaje descriptivo: ${pass3}`);
  console.log('='.repeat(60) + '\n');

  // Restaurar estado original
  db.prepare('UPDATE canteen_items SET available = ? WHERE id = ?').run(originalAvailable, itemId);

  return pass1 && pass2 && pass3;
}

async function run() {
  try {
    await setup();
    const passed = await testItemDisabledValidation();
    process.exit(passed ? 0 : 1);
  } catch (err) {
    console.error('❌ Test error:', err.message);
    process.exit(1);
  } finally {
    if (server) server.close();
  }
}

run();
