/**
 * database.js — SQLite via sql.js (WASM, sin compilación nativa)
 *
 * sql.js compila SQLite a WebAssembly: funciona en cualquier
 * plataforma sin Visual Studio ni gcc.
 * La DB vive en memoria y se persiste en disco tras cada escritura.
 */
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, '../../data/menu.db');
let sqlJsDb = null;

function saveDb() {
  const data = sqlJsDb.export();
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

function makePrepared(sql) {
  return {
    get(...params) {
      const stmt = sqlJsDb.prepare(sql);
      stmt.bind(params);
      const row = stmt.step() ? stmt.getAsObject() : undefined;
      stmt.free();
      return row;
    },
    all(...params) {
      const stmt = sqlJsDb.prepare(sql);
      stmt.bind(params);
      const rows = [];
      while (stmt.step()) rows.push(stmt.getAsObject());
      stmt.free();
      return rows;
    },
    run(...params) {
      sqlJsDb.run(sql, params);
      const changes = sqlJsDb.getRowsModified();
      const r = sqlJsDb.exec('SELECT last_insert_rowid()');
      const lastInsertRowid = r?.[0]?.values?.[0]?.[0] ?? 0;
      saveDb();
      return { changes, lastInsertRowid };
    },
  };
}

function getDb() {
  return {
    prepare: makePrepared,
    exec(sql) { sqlJsDb.exec(sql); saveDb(); },
    pragma() {},
  };
}

async function initDb() {
  const initSqlJs = require('sql.js');
  const SQL = await initSqlJs();

  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  if (fs.existsSync(DB_PATH)) {
    sqlJsDb = new SQL.Database(fs.readFileSync(DB_PATH));
  } else {
    sqlJsDb = new SQL.Database();
  }

  sqlJsDb.run('PRAGMA foreign_keys = ON');

  const database = getDb();

  database.exec(`
    CREATE TABLE IF NOT EXISTS restaurants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      description TEXT,
      logo_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS branches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      restaurant_id INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      address TEXT,
      phone TEXT,
      active BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      restaurant_id INTEGER REFERENCES restaurants(id),
      branch_id INTEGER REFERENCES branches(id),
      role TEXT DEFAULT 'owner',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      branch_id INTEGER REFERENCES branches(id),
      name TEXT NOT NULL,
      description TEXT,
      icon TEXT DEFAULT '🍽️',
      color TEXT DEFAULT '#f59e0b',
      order_index INTEGER DEFAULT 0,
      active BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      branch_id INTEGER REFERENCES branches(id),
      category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
      name TEXT NOT NULL,
      description TEXT,
      price REAL NOT NULL,
      image_url TEXT,
      available BOOLEAN DEFAULT 1,
      featured BOOLEAN DEFAULT 0,
      order_index INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS analytics_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      branch_id INTEGER REFERENCES branches(id),
      session_id TEXT NOT NULL,
      event TEXT NOT NULL,
      data TEXT DEFAULT '{}',
      ts INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS analytics_event_rejections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      branch_id INTEGER REFERENCES branches(id),
      branch_slug TEXT,
      session_id TEXT,
      event TEXT,
      payload TEXT NOT NULL,
      errors TEXT NOT NULL,
      primary_error TEXT NOT NULL,
      received_at_ts INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS product_downtime (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      branch_id INTEGER NOT NULL REFERENCES branches(id),
      product_name TEXT NOT NULL,
      turned_off_at INTEGER NOT NULL,
      turned_on_at INTEGER,
      duration_minutes REAL
    );

    CREATE TABLE IF NOT EXISTS canteen_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      full_name TEXT NOT NULL,
      department TEXT,
      role TEXT NOT NULL DEFAULT 'staff',
      shift TEXT,
      active BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS canteen_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      period TEXT NOT NULL,
      available BOOLEAN DEFAULT 1,
      order_index INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS canteen_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES canteen_users(id) ON DELETE CASCADE,
      item_id INTEGER NOT NULL REFERENCES canteen_items(id) ON DELETE CASCADE,
      period TEXT NOT NULL,
      date TEXT NOT NULL,
      ordered_at TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Seed: solo si no hay restaurantes
  const anyRestaurant = database.prepare('SELECT id FROM restaurants LIMIT 1').get();
  if (!anyRestaurant) {
    const insertCat  = database.prepare('INSERT INTO categories (branch_id, name, description, icon, color, order_index) VALUES (?, ?, ?, ?, ?, ?)');
    const insertProd = database.prepare(`INSERT INTO products (branch_id, category_id, name, description, price, available, featured, order_index) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
    const hashed     = bcrypt.hashSync('admin123', 10);

    // ── Restaurante 1: La Parrilla Don Carlos ──────────────────────────────
    const r1 = database.prepare("INSERT INTO restaurants (name, slug, description) VALUES ('La Parrilla Don Carlos', 'don-carlos', 'Cocina argentina a las brasas desde 1985')").run();
    const b1 = database.prepare('INSERT INTO branches (restaurant_id, name, slug, address, phone) VALUES (?, ?, ?, ?, ?)').run(r1.lastInsertRowid, 'Sede Central', 'don-carlos', 'Av. Corrientes 1234, CABA', '+54 11 4444-5555');
    database.prepare('INSERT INTO users (username, password, restaurant_id, branch_id, role) VALUES (?, ?, ?, ?, ?)').run('carlos', hashed, r1.lastInsertRowid, b1.lastInsertRowid, 'owner');
    const bid1 = b1.lastInsertRowid;

    const c1 = [
      insertCat.run(bid1, 'Achuras & Entradas', 'Lo mejor para arrancar la parrillada', '🔥', '#ef4444', 1).lastInsertRowid,
      insertCat.run(bid1, 'Parrilla',            'Cortes premium a las brasas',            '🥩', '#f59e0b', 2).lastInsertRowid,
      insertCat.run(bid1, 'Guarniciones',        'Para acompañar la carne',                '🥔', '#10b981', 3).lastInsertRowid,
      insertCat.run(bid1, 'Postres',             'El cierre perfecto',                     '🍮', '#8b5cf6', 4).lastInsertRowid,
      insertCat.run(bid1, 'Bebidas',             'Vinos, cervezas y más',                  '🍷', '#3b82f6', 5).lastInsertRowid,
    ];

    [
      [c1[0], 'Provoleta a la parrilla',   'Provoleta entera con orégano, tomate y aceite de oliva',                  1600, 1, 1, 1],
      [c1[0], 'Chorizo criollo',            'Chorizo artesanal con pan de campo y chimichurri casero',                  1100, 1, 0, 2],
      [c1[0], 'Morcilla especial',          'Morcilla de campo con grasa de pella y especias secretas',                 980, 1, 0, 3],
      [c1[0], 'Mollejas al limón',          'Tiernas mollejas de corazón con limón exprimido y ají molido',            2200, 1, 1, 4],
      [c1[1], 'Bife de chorizo 400g',       '400g del mejor bife con chimichurri y papas rústicas',                    5800, 1, 1, 1],
      [c1[1], 'Entraña a la parrilla',      'Entraña fina, jugosa y tierna. Se sirve con ensalada mixta',              4900, 1, 1, 2],
      [c1[1], 'Costillar de cerdo',         'Costillar 600g laqueado con salsa BBQ de la casa',                        5200, 1, 0, 3],
      [c1[1], 'Vacío completo',             'Vacío entero para compartir, cortado a la vista (800g aprox)',            6800, 1, 0, 4],
      [c1[1], 'Pollo a las brasas',         'Pollo entero marinado en ajo y pimentón, con papas asadas',               3900, 1, 0, 5],
      [c1[2], 'Papas fritas',               'Papas cortadas a mano, bien crocantes',                                   1100, 1, 0, 1],
      [c1[2], 'Ensalada mixta',             'Lechuga, tomate, zanahoria rallada y cebolla morada',                      950, 1, 0, 2],
      [c1[2], 'Papas rústicas con romero',  'Papas al horno con ajo entero y romero fresco',                           1300, 1, 0, 3],
      [c1[3], 'Flan casero con dulce',      'Flan de vainilla con dulce de leche y nata montada',                      1200, 1, 1, 1],
      [c1[3], 'Panqueques de dulce de leche','Tres panqueques rellenos con dulce de leche y helado de crema',          1400, 1, 0, 2],
      [c1[4], 'Malbec copa',               'Malbec reserva Mendoza, taninos sedosos',                                   950, 1, 0, 1],
      [c1[4], 'Cerveza rubia 500ml',        'Tirada bien fría en vaso helado',                                          800, 1, 0, 2],
      [c1[4], 'Agua mineral 500ml',         'Con o sin gas',                                                            400, 1, 0, 3],
    ].forEach(([cat, name, desc, price, avail, feat, ord]) =>
      insertProd.run(bid1, cat, name, desc, price, avail, feat, ord)
    );

    // ── Restaurante 2: Sushi Neko ──────────────────────────────────────────
    const r2 = database.prepare("INSERT INTO restaurants (name, slug, description) VALUES ('Sushi Neko', 'sushi-neko', 'Cocina japonesa y fusión contemporánea')").run();
    const b2 = database.prepare('INSERT INTO branches (restaurant_id, name, slug, address, phone) VALUES (?, ?, ?, ?, ?)').run(r2.lastInsertRowid, 'Palermo', 'sushi-neko', 'Thames 1890, Palermo Soho', '+54 11 3333-9999');
    database.prepare('INSERT INTO users (username, password, restaurant_id, branch_id, role) VALUES (?, ?, ?, ?, ?)').run('neko', hashed, r2.lastInsertRowid, b2.lastInsertRowid, 'owner');
    const bid2 = b2.lastInsertRowid;

    const c2 = [
      insertCat.run(bid2, 'Entradas',      'Gyozas, edamame y más',                        '🥢', '#10b981', 1).lastInsertRowid,
      insertCat.run(bid2, 'Nigiris',       '2 piezas por orden, arroz de sushi premium',   '🍣', '#f59e0b', 2).lastInsertRowid,
      insertCat.run(bid2, 'Rolls Clásicos','Makis y uramakis de siempre',                   '🌀', '#ef4444', 3).lastInsertRowid,
      insertCat.run(bid2, 'Rolls Especiales','Creaciones exclusivas del chef',              '⭐', '#8b5cf6', 4).lastInsertRowid,
      insertCat.run(bid2, 'Postres',       'Toques asiáticos y fusión',                    '🍡', '#ec4899', 5).lastInsertRowid,
      insertCat.run(bid2, 'Bebidas',       'Sake, té y bebidas frías',                     '🍵', '#3b82f6', 6).lastInsertRowid,
    ];

    [
      [c2[0], 'Edamame con sal marina',   'Vainas de soja al vapor con fleur de sel',                                  850, 1, 0, 1],
      [c2[0], 'Gyoza de cerdo (6 pzs)',   'Dumplings crujientes con relleno de cerdo y jengibre. Salsa ponzu',        1400, 1, 1, 2],
      [c2[0], 'Tataki de salmón',         'Salmón sellado 30 segundos, chips de ajo y salsa ponzu',                   2200, 1, 1, 3],
      [c2[0], 'Tempura de langostinos',   '4 langostinos en tempura liviana con salsa tentsuyu',                      2400, 1, 0, 4],
      [c2[1], 'Nigiri salmón',            '2 piezas de salmón fresco sobre arroz avinagrado',                        1200, 1, 0, 1],
      [c2[1], 'Nigiri atún rojo',         '2 piezas de atún de aleta azul',                                          1600, 1, 1, 2],
      [c2[1], 'Nigiri langostino',        '2 piezas de langostino blanqueado',                                       1100, 1, 0, 3],
      [c2[1], 'Nigiri pulpo',             '2 piezas de pulpo a la plancha con toque de limón',                       1300, 1, 0, 4],
      [c2[2], 'California Roll (8 pzs)', 'Cangrejo, palta y pepino. Rebozado en masago naranja',                     1800, 1, 1, 1],
      [c2[2], 'Philadelphia Roll (8 pzs)','Salmón, queso crema y ciboulette',                                        1900, 1, 0, 2],
      [c2[2], 'Spicy Tuna Roll (8 pzs)', 'Atún picante, pepino y salsa sriracha mayo',                               2100, 1, 0, 3],
      [c2[3], 'Dragon Roll (8 pzs)',      'Langostino tempura cubierto con láminas de palta y salsa teriyaki',        2800, 1, 1, 1],
      [c2[3], 'Rainbow Roll (8 pzs)',     'Uramaki de cangrejo cubierto con cortes variados de pescado',              3200, 1, 1, 2],
      [c2[3], 'Volcano Roll (8 pzs)',     'Roll horneado con mix de mariscos y salsa dynamite gratinada',             3000, 1, 0, 3],
      [c2[4], 'Mochi de té verde',        '3 bolitas de mochi rellenas con helado de matcha',                        1200, 1, 1, 1],
      [c2[4], 'Dorayaki',                 'Panqueques japoneses rellenos con anko y nata',                            1100, 1, 0, 2],
      [c2[5], 'Sake caliente (1 go)',     'Sake junmai servido caliente en taza de cerámica',                         1400, 1, 0, 1],
      [c2[5], 'Té verde matcha',          'Ceremonial grade, servido con espumado de leche',                           950, 1, 0, 2],
      [c2[5], 'Agua mineral 500ml',       'Con o sin gas',                                                             400, 1, 0, 3],
      [c2[5], 'Soda japonesa ramune',     'Sabores: original, frutilla, melón',                                        700, 1, 0, 4],
    ].forEach(([cat, name, desc, price, avail, feat, ord]) =>
      insertProd.run(bid2, cat, name, desc, price, avail, feat, ord)
    );

    console.log('✅ Seed: 2 restaurantes creados');
    console.log('   🥩 La Parrilla Don Carlos  →  /menu/don-carlos   (admin: carlos / admin123)');
    console.log('   🍣 Sushi Neko              →  /menu/sushi-neko   (admin: neko  / admin123)');
  }

  // ── Comedor seed ──────────────────────────────────────────────────────────
  const anyCanteenUser = database.prepare('SELECT id FROM canteen_users LIMIT 1').get();
  if (!anyCanteenUser) {
    const adminPwd = bcrypt.hashSync('Admin123', 10);
    const staffPwd = bcrypt.hashSync('Turno123', 10);

    const insertUser = database.prepare(
      'INSERT INTO canteen_users (username, password, full_name, department, role, shift) VALUES (?, ?, ?, ?, ?, ?)'
    );
    insertUser.run('comedor_admin', adminPwd, 'Admin Comedor',  'Administración', 'admin', null);
    insertUser.run('juan_garcia',   staffPwd, 'Juan García',    'Enfermería',     'staff', 'morning');
    insertUser.run('maria_lopez',   staffPwd, 'María López',    'Guardia',        'staff', 'afternoon');
    insertUser.run('pedro_ramos',   staffPwd, 'Pedro Ramos',    'Laboratorio',    'staff', 'night');

    const insertItem = database.prepare(
      'INSERT INTO canteen_items (name, description, period, available, order_index) VALUES (?, ?, ?, ?, ?)'
    );

    // Desayuno
    insertItem.run('Café con leche',       'Bebida caliente de café con leche entera',                                  'desayuno', 1, 1);
    insertItem.run('Mate cocido',           'Con azúcar o edulcorante a elección',                                       'desayuno', 1, 2);
    insertItem.run('Tostadas con manteca',  '2 rebanadas de pan de molde tostadas con manteca y mermelada de durazno',   'desayuno', 1, 3);
    insertItem.run('Medialunas de manteca', '2 medialunas de manteca recién horneadas',                                  'desayuno', 1, 4);

    // Almuerzo
    insertItem.run('Milanesa con puré',   'Milanesa de ternera rebozada con puré de papas casero',              'almuerzo', 1, 1);
    insertItem.run('Arroz con pollo',     'Pollo en cubos con arroz blanco y verduras salteadas',               'almuerzo', 1, 2);
    insertItem.run('Guiso de fideos',     'Fideos cortos en salsa de tomate con carne picada y morrón',         'almuerzo', 1, 3);
    insertItem.run('Lentejas guisadas',   'Guiso de lentejas con chorizo colorado y papa',                      'almuerzo', 1, 4);

    // Merienda
    insertItem.run('Mate cocido con facturas',  'Mate cocido y 2 facturas de panadería',                    'merienda', 1, 1);
    insertItem.run('Sándwich de jamón y queso', 'Miga integral con jamón cocido y queso cremoso',           'merienda', 1, 2);
    insertItem.run('Fruta de estación',         'Porción de fruta fresca según disponibilidad del día',     'merienda', 1, 3);

    // Cena
    insertItem.run('Sopa de verduras',          'Caldo casero con zanahoria, zapallo, choclo y fideos finos',   'cena', 1, 1);
    insertItem.run('Revuelto gramajo',          'Huevos revueltos con papas paja, jamón y morrón',               'cena', 1, 2);
    insertItem.run('Tortilla de papas',         'Tortilla española con papa, cebolla y morrón',                  'cena', 1, 3);
    insertItem.run('Arroz salteado con verduras','Arroz largo con zucchini, zanahoria y arvejas',                'cena', 1, 4);

    console.log('✅ Seed: comedor creado');
    console.log('   👤 comedor_admin / Admin123  →  /comedor/admin  (admin - ve todo)');
    console.log('   👤 juan_garcia   / Turno123  →  /comedor        (turno mañana: desayuno + almuerzo)');
    console.log('   👤 maria_lopez   / Turno123  →  /comedor        (turno tarde: almuerzo + merienda + cena)');
    console.log('   👤 pedro_ramos   / Turno123  →  /comedor        (turno noche: cena + desayuno)');
  }

  saveDb();
  console.log('Base de datos lista');
}

module.exports = { getDb, initDb };
