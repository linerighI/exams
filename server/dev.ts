import { createApp } from './app';
import { resolve } from 'node:path';
const { app } = await createApp({ directory: resolve(process.env.SCHOOL_DATA_DIR || '.data') });
const port = Number(process.env.SCHOOL_API_PORT || 4310);
await app.listen({ port, host: '127.0.0.1' });
console.log(`خادم التطوير: http://127.0.0.1:${port}`);
