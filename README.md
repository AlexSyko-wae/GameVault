# GameVault

Plataforma académica en español para descubrir videojuegos con **HTML5, CSS3, Bootstrap 5, JavaScript, Node.js, Express y RAWG**. El registro persiste en SQLite con hashes bcrypt. Sin frameworks de frontend ni compilación.

## Instalación y ejecución

1. Instala **Node.js 22.13 o superior** (recomendado: una versión LTS reciente). SQLite está integrado en Node; no requiere instalar un servidor de base de datos. Node 22 puede mostrar un aviso de que SQLite es experimental.
2. Abre esta carpeta en VS Code y ejecuta `npm install`.
3. El archivo `.env` incluido contiene únicamente valores de ejemplo. Obtén tu propia clave registrándote en [RAWG API](https://rawg.io/apidocs) y reemplaza `TU_API_KEY_AQUI`:

   ```dotenv
   RAWG_API_KEY=tu_clave_real
   PORT=3000
   ```

   Si no tienes `.env`, copia `.env.example` a `.env`. No compartas ni publiques tu clave.
4. Ejecuta `npm start` y abre **http://localhost:3000**.

En PowerShell, si la política de ejecución bloquea `npm.ps1`, usa **`npm.cmd install`** y **`npm.cmd start`**. No necesitas modificar la política de Windows.

`npm run dev` reinicia el servidor al cambiar archivos. Después de cambiar `.env`, reinicia el servidor. `npm test` ejecuta las pruebas de integración con una base de datos en memoria; no modifica tus usuarios.

## Pantallas

- **Inicio:** hero editorial, videojuegos destacados consultados a RAWG y presentación de la plataforma.
- **Explorar:** buscador por nombre, géneros, ordenación, paginación y detalles en un diálogo accesible. Hay estados de carga, error, reintento y catálogo vacío.
- **Registro:** validación de campos en ambos lados, aceptación de términos y confirmación solo después de insertar el usuario. No incluye inicio de sesión.

Sin una clave configurada, la interfaz y el registro funcionan; el catálogo muestra un mensaje de configuración. **No se usan juegos inventados ni respuestas de respaldo.** El destacado de inicio muestra la portada y el título de un juego real obtenido de RAWG y abre su ficha. Las portadas y datos del catálogo provienen de RAWG y requieren internet. Bootstrap, CSS y JavaScript se sirven localmente.

## Estructura

```text
backend/
  server.js             # Carga dotenv e inicia el servidor
  app.js                # Middleware, registro y archivos públicos
  database.js           # Esquema SQLite
  validation.js         # Validación de registro
  routes/games.js       # Proxy a RAWG
frontend/
  index.html            # Tres pantallas con navegación por hash
  assets/app.js         # Fetch, tarjetas, filtros, diálogos y formulario
  assets/styles.css     # Diseño responsive
  assets/theme.css      # Tema local
database/               # Se crea al iniciar; contiene gamevault.sqlite
test/app.test.js         # Integración y seguridad básica
```

## API REST

El flujo es **Navegador → Express → RAWG → Express → Navegador**. La clave se añade exclusivamente en el servidor. Los endpoints de catálogo son para uso de esta aplicación, no para redistribuir una base de datos.

| Método y ruta | Función |
| --- | --- |
| `GET /api/games` | Catálogo popular; acepta `page`, `genre`, `ordering` y `q` |
| `GET /api/games/search?q=portal` | Búsqueda por nombre; acepta los mismos filtros |
| `GET /api/games/:id` | Descripción en texto, plataformas, géneros, fecha y puntuación |
| `GET /api/genres` | Géneros disponibles en RAWG |
| `POST /api/register` | Valida y guarda un usuario |

`ordering`: `-added` (popularidad), `-rating`, `-released` o `name`. Las listas entregan 12 juegos por página, `count`, `hasNext` y `results`. No se devuelven las URLs de paginación de RAWG porque contienen la clave.

Ejemplo de registro JSON:

```json
{"name":"Ana López","username":"ana_player","email":"ana@example.com","password":"Adventure2026","confirmPassword":"Adventure2026","terms":true}
```

Respuestas: `201` registro completado; `400` validación con errores por campo; `409` correo/usuario duplicado; `429` límite de solicitudes; `503` falta configurar RAWG; `502` fallo del proveedor. No se devuelven hashes ni datos personales desde el registro.

## Seguridad — Unidad 3

- **Validación en cliente y servidor:** tipos, tamaños, correo, usuario, contraseña y aceptación de términos. La validación del navegador mejora la experiencia; la del servidor es obligatoria.
- **Normalización:** espacios exteriores, Unicode NFC y minúsculas en usuario/correo. Se rechazan caracteres de control y etiquetas en el nombre. No se recortan las contraseñas.
- **SQLite parametrizado:** valores separados del SQL. Restricciones `UNIQUE` protegen correo y usuario incluso ante registros simultáneos.
- **bcrypt:** factor de costo 12 y sal automática; nunca se persisten contraseñas en texto plano. Máximo 72 bytes para evitar truncamiento de bcrypt.
- **Prevención de XSS:** texto externo con `textContent`, sin `innerHTML`; descripciones de RAWG en texto. Solo se aceptan portadas HTTPS del dominio de imágenes de RAWG.
- **Helmet/CSP:** scripts, estilos y conexiones locales; imágenes limitadas a los proveedores usados. Sin scripts inline ni CDN para Bootstrap.
- **Límites:** JSON de 8 KB, 10 intentos de registro por IP cada 15 minutos y 100 solicitudes API por minuto. La instancia local no confía en cabeceras de proxy.
- **Secretos:** dotenv solo en servidor. `.env`, dependencias, caché y archivos SQLite están ignorados por Git. Solo `frontend` y Bootstrap son públicos.
- **Errores:** sin stack traces ni detalles SQL en las respuestas. Las consultas externas tienen un tiempo máximo de 12 segundos.

La base de datos persiste en `database/gamevault.sqlite`. Para reiniciar los usuarios de prueba, detén el servidor y elimina ese archivo y sus archivos auxiliares `-wal`/`-shm`, si existen. Usa datos de prueba en la demostración. Este proyecto está preparado para ejecución local; no incorpora autenticación ni gestión de cuentas.

## Presentación y verificación

1. Abre Inicio y muestra el catálogo con la clave configurada.
2. Busca un juego, cambia género y orden, pagina y abre sus detalles.
3. En Registro muestra errores, crea un usuario y vuelve a intentar el mismo correo/usuario.
4. Explica la cadena REST y las medidas anteriores; muestra en Network que el navegador llama a `/api`, nunca a RAWG con tu clave.
5. Ejecuta `npm test`. La prueba de contrato del proveedor usa una respuesta simulada **solo dentro de las pruebas**; no verifica la disponibilidad real ni la validez de tu clave.

Documentación oficial: [RAWG API y atribución](https://rawg.io/apidocs), [referencia de endpoints](https://api.rawg.io/docs/). Se incluye un enlace visible a RAWG en el footer de todas las pantallas y en el detalle. Respeta las condiciones y cuotas vigentes de tu cuenta.
