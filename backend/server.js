require('dotenv').config({ quiet: true });
const { createApp } = require('./app');
const port = Number(process.env.PORT) || 3000;
createApp().listen(port, () => console.log(`GameVault disponible en http://localhost:${port}`));
