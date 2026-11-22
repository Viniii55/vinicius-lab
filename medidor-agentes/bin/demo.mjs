#!/usr/bin/env node
// Roda a régua sobre as duas correções de exemplo e mostra a diferença.
// Sai com erro se o resultado não for o esperado (3/8 e 8/8).
import { dirname, join, resolve } from 'node:path';
import { exit } from 'node:process';
import { fileURLToPath } from 'node:url';
import { conferir } from './conferir.mjs';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const casos = [
  { nome: 'só do exemplo (conserta o que o teste mostra)', pasta: 'so-do-exemplo', esperado: 3 },
  { nome: 'com o requisito escrito', pasta: 'com-requisito', esperado: 8 },
];

let ok = true;
for (const c of casos) {
  const r = conferir(join(raiz, 'exemplos', c.pasta));
  const bateu = r.gateVisivel && r.testesIntactos && r.acertos === c.esperado;
  ok &&= bateu;
  console.log(`${c.nome}\n  gate visível: ${r.gateVisivel ? 'passou' : 'falhou'} · régua oculta: ${r.acertos}/${r.total} · ${r.veredito}${bateu ? '' : '  <-- FORA DO ESPERADO'}\n`);
}
exit(ok ? 0 : 1);
