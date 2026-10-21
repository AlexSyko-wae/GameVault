const express = require('express');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');
const bcrypt = require('bcrypt');
const path = require('node:path');
const { validateRegistration } = require('./validation');
const { openDatabase } = require('./database');
function createApp(db = openDatabase()) {
  const app = express();
  app.disable('x-powered-by');
  // Scripts y estilos locales; CSP bloquea scripts inyectados y conexiones ajenas.
  app.use(helmet({ contentSecurityPolicy: { directives: { 'img-src': ["'self'", 'https://media.rawg.io', 'https://images.unsplash.com', 'data:'], 'script-src': ["'self'"], 'style-src': ["'self'"], 'connect-src': ["'self'"], 'upgrade-insecure-requests': null } } }));
  app.use(express.json({ limit: '8kb' }));
  app.use('/api', rateLimit({ windowMs: 60000, limit: 100, standardHeaders: 'draft-8', legacyHeaders: false, message: { message: 'Demasiadas solicitudes. Espera un minuto.' } }));
  app.post('/api/register', rateLimit({ windowMs: 15 * 60000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false, message: { message: 'Demasiados intentos. Vuelve a intentarlo en 15 minutos.' } }), async (req, res) => {
    const { data, errors } = validateRegistration(req.body);
    if (Object.keys(errors).length) return res.status(400).json({ message: 'Revisa los campos indicados.', errors });
    const hash = await bcrypt.hash(data.password, 12);
    try {
      // Parámetros separados de SQL para prevenir inyección; UNIQUE evita carreras.
      db.prepare('INSERT INTO users (name, username, email, password_hash) VALUES (?, ?, ?, ?)').run(data.name, data.username, data.email, hash);
    } catch (error) {
      if (error.code?.includes('CONSTRAINT') || error.message?.includes('UNIQUE constraint')) return res.status(409).json({ message: 'El correo o el nombre de usuario ya está registrado.' });
      throw error;
    }
    res.status(201).json({ message: '¡Registro completado! Tu cuenta de GameVault se guardó correctamente.' });
  });
  app.use('/api', require('./routes/games'));
  app.use('/api', (req, res) => res.status(404).json({ message: 'Endpoint no encontrado.' }));
  app.use('/vendor/bootstrap', express.static(path.join(__dirname, '../node_modules/bootstrap/dist')));
  app.use(express.static(path.join(__dirname, '../frontend')));
  app.use((error, req, res, next) => {
    const status = error.status >= 400 && error.status < 600 ? error.status : 500;
    res.status(status).json({ message: error.type === 'entity.parse.failed' ? 'El JSON enviado no es válido.' : status === 500 ? 'Ocurrió un error interno. Inténtalo más tarde.' : error.message });
  });
  return app;
}
module.exports = { createApp };
