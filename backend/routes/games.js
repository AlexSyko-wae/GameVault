const express = require('express');
const router = express.Router();
async function rawg(path, params = {}) {
  const key = process.env.RAWG_API_KEY;
  if (!key || key === 'TU_API_KEY_AQUI') {
    const error = new Error('Configura RAWG_API_KEY en el archivo .env y reinicia el servidor para explorar videojuegos.');
    error.status = 503; throw error;
  }
  const url = new URL(`https://api.rawg.io/api/${path}`);
  url.search = new URLSearchParams({ ...params, key });
  let response;
  try { response = await fetch(url, { signal: AbortSignal.timeout(12000) }); }
  catch { const error = new Error('RAWG no responde. Inténtalo de nuevo en unos momentos.'); error.status = 502; throw error; }
  if (!response.ok) { const error = new Error(response.status === 404 ? 'No se encontró el videojuego.' : 'No se pudo consultar RAWG. Revisa la clave o inténtalo más tarde.'); error.status = response.status === 404 ? 404 : 502; throw error; }
  return response.json();
}
async function list(req, res) {
  const search = req.query.q ?? '';
  const genre = req.query.genre ?? '';
  const page = req.query.page ?? '1';
  const ordering = req.query.ordering ?? '-added';
  if (typeof search !== 'string' || search.length > 100 || typeof genre !== 'string' || !/^[a-z0-9-]*$/.test(genre) || !/^\d{1,4}$/.test(page) || Number(page) < 1 || !['-added', '-rating', '-released', 'name'].includes(ordering)) return res.status(400).json({ message: 'Los filtros de búsqueda no son válidos.' });
  const data = await rawg('games', { page, page_size: '12', ordering, ...(search.trim() && { search: search.trim() }), ...(genre && { genres: genre }) });
  // No devolver next/previous: las URLs del proveedor contienen la clave privada.
  res.json({ count: data.count, hasNext: Boolean(data.next), results: data.results.map(({ id, name, background_image, genres, rating, released }) => ({ id, name, background_image, genres, rating, released })) });
}
router.get('/games', list);
router.get('/games/search', list);
router.get('/genres', async (req, res) => { const data = await rawg('genres', { page_size: '40' }); res.json({ results: data.results.map(({ id, name, slug }) => ({ id, name, slug })) }); });
router.get('/games/:id', async (req, res) => {
  if (!/^\d{1,10}$/.test(req.params.id)) return res.status(400).json({ message: 'Identificador de videojuego inválido.' });
  const { id, name, background_image, description_raw, platforms, released, genres, rating, metacritic } = await rawg(`games/${req.params.id}`);
  res.json({ id, name, background_image, description: description_raw, platforms: platforms?.map(p => p.platform.name), released, genres, rating, metacritic });
});
module.exports = router;
