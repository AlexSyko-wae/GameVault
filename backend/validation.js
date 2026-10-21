const clean = value => typeof value === 'string' ? value.trim().normalize('NFC') : '';
function validateRegistration(body = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) body = {};
  const data = { name: clean(body.name), username: clean(body.username).toLowerCase(), email: clean(body.email).toLowerCase(), password: typeof body.password === 'string' ? body.password : '', confirmPassword: body.confirmPassword, terms: body.terms };
  const errors = {};
  if (data.name.length < 2 || data.name.length > 100 || /[<>\x00-\x1f]/.test(data.name)) errors.name = 'Escribe un nombre válido de 2 a 100 caracteres.';
  if (!/^[a-z0-9_]{3,30}$/.test(data.username)) errors.username = 'Usa entre 3 y 30 letras, números o guiones bajos.';
  if (data.email.length > 254 || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(data.email)) errors.email = 'Escribe un correo electrónico válido.';
  // bcrypt procesa hasta 72 bytes: rechazamos entradas que se truncarían.
  if (data.password.length < 8 || Buffer.byteLength(data.password) > 72 || !/[a-zA-Z]/.test(data.password) || !/[0-9]/.test(data.password)) errors.password = 'Usa al menos 8 caracteres con letras y números (máximo 72 bytes).';
  if (data.password !== data.confirmPassword) errors.confirmPassword = 'Las contraseñas no coinciden.';
  if (data.terms !== true) errors.terms = 'Debes aceptar los términos.';
  return { data, errors };
}
module.exports = { validateRegistration };
