'use strict';
const $ = selector => document.querySelector(selector);
let currentPage = 1, hasNext = false, exploreController, detailController, exploreLoaded = false, featuredLoaded = false;
async function api(path, options = {}) {
  const response = await fetch(path, options);
  const data = await response.json();
  if (!response.ok) { const error = new Error(data.message || 'No se pudo completar la solicitud.'); error.errors = data.errors; throw error; }
  return data;
}
// Construimos el contenido externo con textContent: nunca insertamos HTML de RAWG o del usuario.
function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}
function imageUrl(value) {
  try { const url = new URL(value); return url.protocol === 'https:' && url.hostname === 'media.rawg.io' ? url.href : null; } catch { return null; }
}
function cover(url, title, className) {
  const safe = imageUrl(url);
  if (!safe) return node('div', 'cover-fallback', '✦');
  const image = node('img', className); image.src = safe; image.alt = title; image.loading = 'lazy';
  image.addEventListener('error', () => image.replaceWith(node('div', 'cover-fallback', '✦')), { once: true });
  return image;
}
function date(value) {
  if (!value) return 'Fecha por anunciar';
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? 'Fecha por anunciar' : parsed.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
}
function loading(target) { target.replaceChildren(node('span', 'loader'), document.createTextNode('Cargando videojuegos…')); }
function failure(target, error, retry) {
  target.replaceChildren(node('span', '', error.message || 'No se pudo conectar. Comprueba tu conexión.'));
  if (retry) { const button = node('button', 'button button-outline', 'Reintentar'); button.type = 'button'; button.addEventListener('click', retry); target.append(button); }
}
function cards(target, games) {
  target.replaceChildren(...games.map(game => {
    const card = node('button', 'game-card'); card.type = 'button'; card.setAttribute('aria-label', `Ver detalles de ${game.name}`);
    card.append(cover(game.background_image, `Portada de ${game.name}`));
    const copy = node('div', 'card-copy');
    copy.append(node('span', 'genre-text', game.genres?.map(g => g.name).slice(0, 2).join(' · ') || 'Sin género disponible'), node('h3', '', game.name));
    const meta = node('div', 'card-meta'); meta.append(node('span', '', date(game.released)), node('span', 'rating', `★ ${Number(game.rating || 0).toFixed(1)} / 5`));
    copy.append(meta); card.append(copy, node('span', 'card-open', 'Ver ficha ↗')); card.addEventListener('click', () => showDetails(game.id)); return card;
  }));
}
function heroFeature(game) {
  if (!game) return;
  const button = node('button', 'hero-game');
  button.type = 'button'; button.setAttribute('aria-label', `Ver detalles de ${game.name}`);
  const image = cover(game.background_image, `Portada de ${game.name}`, 'hero-image');
  if (image.tagName === 'IMG') { image.loading = 'eager'; image.fetchPriority = 'high'; }
  const caption = node('div', 'hero-game-caption');
  const info = node('div'); info.append(node('span', 'hero-game-label', 'DESTACADO DEL CATÁLOGO'), node('h2', '', game.name));
  info.append(node('p', 'hero-game-meta', `${game.genres?.map(g => g.name).slice(0, 2).join(' / ') || 'Videojuego'} · ★ ${Number(game.rating || 0).toFixed(1)}`));
  caption.append(info, node('span', 'hero-game-arrow', '↗'));
  button.append(image, caption); button.addEventListener('click', () => showDetails(game.id));
  $('#hero-feature').replaceChildren(button);
}
async function loadFeatured() {
  const status = $('#featured-status'); loading(status);
  try { const data = await api('/api/games'); heroFeature(data.results[0]); cards($('#featured'), data.results.slice(0, 4)); status.textContent = data.results.length ? '' : 'No hay videojuegos destacados disponibles.'; featuredLoaded = true; }
  catch (error) { failure(status, error, loadFeatured); }
}
async function loadGenres() {
  try {
    const data = await api('/api/genres');
    $('#genre').append(...data.results.map(genre => { const option = node('option', '', genre.name); option.value = genre.slug; return option; }));
    $('#genre-status').textContent = '';
  } catch { $('#genre-status').textContent = 'Los géneros no están disponibles por el momento. Puedes buscar por nombre.'; }
}
function pagination() {
  $('#previous').disabled = currentPage <= 1;
  $('#next').disabled = !hasNext;
  $('#page-label').textContent = `Página ${currentPage}`;
}
async function loadGames() {
  exploreController?.abort(); exploreController = new AbortController();
  const signal = exploreController.signal;
  const status = $('#explore-status'); loading(status); $('#games').replaceChildren();
  $('#previous').disabled = $('#next').disabled = true; $('#result-count').textContent = '';
  const search = $('#search').value.trim();
  const params = new URLSearchParams({ q: search, genre: $('#genre').value, ordering: $('#ordering').value, page: currentPage });
  $('#results-title').textContent = search ? `Resultados para “${search}”` : 'Explora el catálogo';
  try {
    const data = await api(`/api/games${search ? '/search' : ''}?${params}`, { signal });
    cards($('#games'), data.results); status.textContent = data.results.length ? '' : 'No encontramos videojuegos. Prueba con otro nombre o género.';
    $('#result-count').textContent = `${Number(data.count).toLocaleString('es-MX')} resultados`;
    hasNext = data.hasNext; pagination();
  } catch (error) { if (signal.aborted) return; hasNext = false; failure(status, error, loadGames); pagination(); }
}
async function showDetails(id) {
  detailController?.abort(); detailController = new AbortController(); const signal = detailController.signal;
  const dialog = $('#detail-dialog'), content = $('#detail-content');
  const holder = node('div', 'dialog-body'); const title = node('h2', '', 'Cargando detalles'); title.id = 'detail-title'; holder.append(title); content.replaceChildren(holder); loading(holder); holder.prepend(title); dialog.showModal();
  try {
    const game = await api(`/api/games/${id}`, { signal });
    const body = node('div', 'dialog-body'); const heading = node('h2', '', game.name); heading.id = 'detail-title';
    body.append(node('p', 'eyebrow', 'DENTRO DE LA AVENTURA'), heading);
    const facts = node('dl', 'detail-facts');
    const entries = [['Lanzamiento', date(game.released)], ['Calificación', `${game.rating ?? 0} / 5`], ['Plataformas', game.platforms?.join(' · ') || 'Sin información'], ['Géneros', game.genres?.map(g => g.name).join(' · ') || 'Sin información']];
    for (const [label, value] of entries) { const pair = node('div'); pair.append(node('dt', '', label), node('dd', '', value)); facts.append(pair); }
    body.append(facts, node('p', 'detail-description', game.description || 'No hay descripción disponible.'));
    const attribution = node('a', 'text-link', 'Información proporcionada por RAWG ↗'); attribution.href = `https://rawg.io/games/${game.id}`; attribution.target = '_blank'; attribution.rel = 'noopener noreferrer'; body.append(attribution);
    content.replaceChildren(cover(game.background_image, game.name, 'detail-image'), body);
  } catch (error) { if (!signal.aborted) { title.textContent = 'No se pudieron cargar los detalles'; holder.replaceChildren(title); failure(holder, error); holder.prepend(title); } }
}
function route() {
  const page = ['inicio', 'explorar', 'registro'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'inicio';
  if (location.hash === '#acerca') { $('#inicio').hidden = false; $('#explorar').hidden = $('#registro').hidden = true; if (!featuredLoaded) loadFeatured(); $('#nav-links').classList.remove('open'); $('#menu-toggle').setAttribute('aria-expanded', 'false'); requestAnimationFrame(() => $('#acerca').scrollIntoView()); return; }
  document.querySelectorAll('.page').forEach(section => { section.hidden = section.id !== page; });
  document.querySelectorAll('[data-nav]').forEach(link => { link.classList.toggle('active', link.dataset.nav === page); if (link.dataset.nav === page) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current'); });
  $('#nav-links').classList.remove('open'); $('#menu-toggle').setAttribute('aria-expanded', 'false');
  document.title = `GameVault — ${{ inicio: 'Tu próxima aventura', explorar: 'Explorar videojuegos', registro: 'Crear cuenta' }[page]}`;
  if (page === 'inicio' && !featuredLoaded) loadFeatured();
  if (page === 'explorar' && !exploreLoaded) { exploreLoaded = true; loadGames(); loadGenres(); }
  window.scrollTo(0, 0);
}
$('#menu-toggle').addEventListener('click', () => { const open = $('#nav-links').classList.toggle('open'); $('#menu-toggle').setAttribute('aria-expanded', String(open)); });
window.addEventListener('hashchange', route);
$('#search-form').addEventListener('submit', event => { event.preventDefault(); currentPage = 1; loadGames(); });
for (const selector of ['#genre', '#ordering']) $(selector).addEventListener('change', () => { currentPage = 1; loadGames(); });
$('#previous').addEventListener('click', () => { if (currentPage > 1) { currentPage--; loadGames(); } });
$('#next').addEventListener('click', () => { if (hasNext) { currentPage++; loadGames(); } });
document.querySelectorAll('.dialog-close').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()));
$('#detail-dialog').addEventListener('close', () => detailController?.abort());
$('#show-terms').addEventListener('click', () => $('#terms-dialog').showModal());
function formErrors(errors = {}) {
  for (const field of ['name', 'username', 'email', 'password', 'confirmPassword', 'terms']) {
    $(`#${field}-error`).textContent = errors[field] || ''; $(`#${field}`).classList.toggle('is-invalid', Boolean(errors[field])); $(`#${field}`).setAttribute('aria-invalid', String(Boolean(errors[field])));
  }
}
$('#register-form').addEventListener('submit', async event => {
  event.preventDefault(); const form = event.currentTarget;
  const data = Object.fromEntries(new FormData(form)); data.terms = $('#terms').checked;
  data.name = data.name.trim().normalize('NFC'); data.username = data.username.trim().toLowerCase(); data.email = data.email.trim().toLowerCase();
  const errors = {};
  if (data.name.length < 2 || data.name.length > 100 || /[<>\x00-\x1f]/.test(data.name)) errors.name = 'Escribe un nombre válido de 2 a 100 caracteres.';
  if (!/^[a-z0-9_]{3,30}$/.test(data.username)) errors.username = 'Usa entre 3 y 30 letras, números o guiones bajos.';
  if (data.email.length > 254 || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(data.email)) errors.email = 'Escribe un correo electrónico válido.';
  if (data.password.length < 8 || new TextEncoder().encode(data.password).length > 72 || !/[a-zA-Z]/.test(data.password) || !/[0-9]/.test(data.password)) errors.password = 'Usa al menos 8 caracteres con letras y números (máximo 72 bytes).';
  if (data.confirmPassword !== data.password) errors.confirmPassword = 'Las contraseñas no coinciden.';
  if (!data.terms) errors.terms = 'Debes aceptar los términos.';
  formErrors(errors); const status = $('#register-status'); status.className = 'form-status'; status.textContent = '';
  if (Object.keys(errors).length) { $(`#${Object.keys(errors)[0]}`).focus(); return; }
  const button = $('#register-submit'); button.disabled = true; button.textContent = 'Creando cuenta…';
  try {
    const result = await api('/api/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    status.classList.add('success'); status.textContent = result.message; form.reset(); formErrors();
  } catch (error) { formErrors(error.errors); status.classList.add('error'); status.textContent = error.message || 'No se pudo completar el registro. Inténtalo nuevamente.'; }
  finally { button.disabled = false; button.textContent = 'Crear mi cuenta ↗'; }
});
route();
