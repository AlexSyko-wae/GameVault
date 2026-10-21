const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcrypt');
const { openDatabase } = require('../backend/database');
const { createApp } = require('../backend/app');
const db = openDatabase(':memory:');
let server, base;
before(async () => { process.env.RAWG_API_KEY = 'TU_API_KEY_AQUI'; server = createApp(db).listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve)); base = `http://127.0.0.1:${server.address().port}`; });
after(async () => { await new Promise(resolve => server.close(resolve)); db.close(); });
const user = { name: 'Ana López', username: 'ana_player', email: 'ana@example.com', password: 'Adventure2026', confirmPassword: 'Adventure2026', terms: true };
const register = data => fetch(`${base}/api/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
test('página y recursos locales con cabeceras de seguridad', async () => {
  const response = await fetch(base); assert.equal(response.status, 200); assert.match(await response.text(), /Tu próxima/); assert.match(response.headers.get('content-security-policy'), /script-src 'self'/); assert.equal(response.headers.get('x-powered-by'), null);
  for (const asset of ['/assets/app.js', '/assets/styles.css', '/vendor/bootstrap/css/bootstrap.min.css']) assert.equal((await fetch(base + asset)).status, 200);
});
test('validación de backend rechaza entradas y no guarda usuarios inválidos', async () => {
  const response = await register({ ...user, name: '<script>', username: 'bad user', email: 'incorrecto', password: '123', terms: false });
  assert.equal(response.status, 400); const body = await response.json(); assert.ok(body.errors.name); assert.ok(body.errors.password); assert.ok(body.errors.confirmPassword); assert.ok(body.errors.terms); assert.equal(db.prepare('SELECT count(*) AS n FROM users').get().n, 0);
});
test('registro real, hash bcrypt y duplicados sin distinguir mayúsculas', async () => {
  assert.equal((await register(user)).status, 201);
  const row = db.prepare('SELECT * FROM users WHERE username = ?').get(user.username);
  assert.notEqual(row.password_hash, user.password); assert.ok(await bcrypt.compare(user.password, row.password_hash));
  assert.equal((await register({ ...user, username: 'different', email: 'ANA@EXAMPLE.COM' })).status, 409);
  assert.equal((await register({ ...user, email: 'other@example.com', username: 'ANA_PLAYER' })).status, 409);
  assert.equal(db.prepare('SELECT count(*) AS n FROM users').get().n, 1);
});
test('API maneja falta de clave y filtros inválidos', async () => {
  assert.equal((await fetch(base + '/api/games')).status, 503);
  assert.equal((await fetch(base + '/api/games/search?q=a&page=-1')).status, 400);
  assert.equal((await fetch(base + '/api/games/not-an-id')).status, 400);
  assert.equal((await fetch(base + '/api/unknown')).status, 404);
});
test('contrato del proxy elimina URLs que contienen la clave (proveedor simulado solo en pruebas)', async () => {
  const original = global.fetch; process.env.RAWG_API_KEY = 'test-secret';
  global.fetch = async (url, options) => {
    if (String(url).startsWith('https://api.rawg.io/')) return new Response(JSON.stringify({ count: 1, next: 'https://api.rawg.io/api/games?key=test-secret&page=2', results: [{ id: 1, name: 'Provider game', genres: [], rating: 4 }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    return original(url, options);
  };
  try { const response = await original(base + '/api/games'); const body = await response.json(); assert.equal(body.hasNext, true); assert.equal(body.results[0].name, 'Provider game'); assert.ok(!JSON.stringify(body).includes('test-secret')); }
  finally { global.fetch = original; process.env.RAWG_API_KEY = 'TU_API_KEY_AQUI'; }
});
test('limita intentos de registro', async () => {
  let response; for (let i = 0; i < 11; i++) response = await register({});
  assert.equal(response.status, 429);
});
