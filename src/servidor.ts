import { montarDoAmbiente } from './composicao.js';
import { criarApp } from './webhook.js';

const { pipeline, porta, token, avisos } = montarDoAmbiente();
for (const aviso of avisos) console.warn(`[aviso] ${aviso}`);

const app = criarApp({ pipeline, ...(token !== undefined ? { token } : {}), logger: true });
await app.listen({ port: porta, host: '0.0.0.0' });
