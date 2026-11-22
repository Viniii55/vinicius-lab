#!/usr/bin/env node
// Monta a pasta que você entrega a um agente (ou a você mesmo) para consertar.
// Leva só src/ (com os bugs) e visible/ (o gate). A régua oculta NUNCA vai junto.
//
// Uso: node bin/preparar.mjs <pasta-destino> [--com-requisito]
//   --com-requisito  inclui REQUISITOS.md, o pedido escrito com o que cada função deve fazer.
// Depois: aponte o agente para a pasta, deixe-o consertar src/ até `npm test` passar,
// e confira com: node bin/conferir.mjs <pasta-destino>
import { cpSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { argv, exit } from 'node:process';
import { fileURLToPath } from 'node:url';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const destino = argv[2];
if (!destino || destino.startsWith('--')) {
  console.error('uso: node bin/preparar.mjs <pasta-destino> [--com-requisito]');
  exit(2);
}
const alvo = resolve(destino);
if (existsSync(alvo) && readdirSync(alvo).length > 0) {
  console.error(`a pasta ${alvo} não está vazia; escolha uma pasta nova`);
  exit(2);
}

mkdirSync(alvo, { recursive: true });
cpSync(join(raiz, 'projeto', 'src'), join(alvo, 'src'), { recursive: true });
cpSync(join(raiz, 'projeto', 'visible'), join(alvo, 'visible'), { recursive: true });
writeFileSync(
  join(alvo, 'package.json'),
  JSON.stringify({ name: 'pedido-de-conserto', private: true, type: 'module', scripts: { test: 'node --test visible/*.test.mjs' } }, null, 2) + '\n',
);
if (argv.includes('--com-requisito')) cpSync(join(raiz, 'REQUISITOS.md'), join(alvo, 'REQUISITOS.md'));

console.log(`Pasta pronta em ${alvo}${argv.includes('--com-requisito') ? ' (com o requisito escrito)' : ' (só com o pedido curto)'}.`);
console.log('Pedido curto sugerido ao agente: "Os testes estão falhando, conserta pra mim."');
console.log(`Depois confira: node bin/conferir.mjs ${destino}`);
