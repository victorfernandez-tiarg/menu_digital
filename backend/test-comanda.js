const http = require('http');

// Test del endpoint de comanda
function makeRequest(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({ status: res.statusCode, body: data });
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

(async () => {
  try {
    // Login
    console.log('1️⃣ Haciendo login...');
    const loginRes = await makeRequest('POST', '/canteen/auth/login', {
      username: 'comedor_admin',
      password: 'Admin123'
    });
    const loginData = JSON.parse(loginRes.body);
    const token = loginData.token;
    console.log(`✓ Login exitoso. Token: ${token.substring(0, 30)}...`);

    // Get comanda de hoy
    console.log('\n2️⃣ Obteniendo comanda de hoy...');
    const today = new Date().toISOString().split('T')[0];
    const comandaRes = await makeRequest('GET', `/canteen/admin/orders/export/comanda?date=${today}`, null, {
      Authorization: `Bearer ${token}`
    });
    const comandaData = JSON.parse(comandaRes.body);
    console.log(`✓ Comanda obtenida:`);
    console.log(JSON.stringify(comandaData, null, 2));

    // Verificar estructura
    console.log('\n3️⃣ Validando estructura de comanda...');
    const { date, comanda } = comandaData;
    console.log(`Fecha: ${date}`);
    const periods = Object.keys(comanda);
    console.log(`Períodos con datos: ${periods.join(', ')}`);
    
    if (periods.length > 0) {
      console.log(`\n✅ Estructura de comanda válida!`);
      periods.forEach(period => {
        console.log(`\n  ${period.toUpperCase()}:`);
        comanda[period].forEach(item => {
          console.log(`    - [${item.qty}x] ${item.name}`);
          if (item.description) console.log(`      ${item.description}`);
        });
      });
    } else {
      console.log('⚠️ Sin datos de comanda para hoy (es normal si no hay pedidos)');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
  
  process.exit(0);
})();
