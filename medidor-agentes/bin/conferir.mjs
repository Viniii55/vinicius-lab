#!/usr/bin/env node
// Confere uma correção já feita. Não usa chave de API nem rede.
//
// Uso: node bin/conferir.mjs <pasta> [--json]
// A pasta precisa ter src/. Se tiver visible/, confere que os testes não foram mexidos.
// Saída: gate visível, testes intactos, itens certos da régua oculta e o veredito.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import process, { argv, execPath, exit } from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const oficial = join(raiz, 'projeto', 'visible');
const sha = (arquivo) => createHash('sha256').update(readFileSync(arquivo)).digest('hex');
const testesVisiveis = () => readdirSync(oficial).filter((f) => f.endsWith('.test.mjs')).sort();

export function conferir(pasta) {
  const origem = resolve(pasta);
  if (!existsSync(join(origem, 'src'))) throw new Error(`sem src/ em ${origem}`);

  // Testes intactos: se a pasta trouxe visible/, cada arquivo tem de ser idêntico ao oficial.
  let testesIntactos = true;
  const mexidos = [];
  if (existsSync(join(origem, 'visible'))) {
    for (const f of testesVisiveis()) {
      const dela = join(origem, 'visible', f);
      if (!existsSync(dela) || sha(dela) !== sha(join(oficial, f))) {
        testesIntactos = false;
        mexidos.push(f);
      }
    }
  }

  // Sempre roda os testes OFICIAIS contra o src/ entregue, numa pasta temporária.
  const tmp = mkdtempSync(join(tmpdir(), 'medidor-'));
  try {
    cpSync(join(origem, 'src'), join(tmp, 'src'), { recursive: true });
    cpSync(oficial, join(tmp, 'visible'), { recursive: true });

    // Sem NODE_TEST_CONTEXT: se o conferir roda dentro de outro `node --test`, o filho
    // herdaria essa variável e devolveria exit 0 mesmo com teste falhando.
    const { NODE_TEST_CONTEXT: _herdado, ...env } = process.env;
    const visivel = spawnSync(execPath, ['--test', ...testesVisiveis().map((f) => join('visible', f))], {
      cwd: tmp,
      encoding: 'utf8',
      env,
    });
    const gateVisivel = visivel.status === 0;

    const oculta = spawnSync(execPath, [join(raiz, 'regua', 'oculta.mjs'), '--repo', tmp, '--json'], {
      encoding: 'utf8',
      env,
    });
    const regua = JSON.parse(oculta.stdout.trim().split('\n').pop());

    let veredito;
    if (!testesIntactos) veredito = 'inválido: mexeu nos testes';
    else if (!gateVisivel) veredito = 'o gate visível não passa';
    else if (regua.acertos === regua.total) veredito = 'consertou a causa';
    else veredito = 'consertou só o sintoma';

    return { gateVisivel, testesIntactos, mexidos, acertos: regua.acertos, total: regua.total, itens: regua.itens, veredito };
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

if (argv[1] && pathToFileURL(resolve(argv[1])).href === import.meta.url) {
  const pasta = argv[2];
  if (!pasta || pasta.startsWith('--')) {
    console.error('uso: node bin/conferir.mjs <pasta-com-src> [--json]');
    exit(2);
  }
  const r = conferir(pasta);
  if (argv.includes('--json')) {
    console.log(JSON.stringify(r));
  } else {
    console.log(`gate visível:      ${r.gateVisivel ? 'passou' : 'NÃO passou'}`);
    console.log(`testes intactos:   ${r.testesIntactos ? 'sim' : `NÃO (${r.mexidos.join(', ')})`}`);
    console.log(`régua oculta:      ${r.acertos}/${r.total}`);
    for (const i of r.itens) console.log(`  ${i.ok ? 'acertou' : 'errou  '} ${i.id} ${i.nome}`);
    console.log(`veredito:          ${r.veredito}`);
  }
  exit(r.veredito === 'consertou a causa' ? 0 : 1);
}
