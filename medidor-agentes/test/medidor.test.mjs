import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { execPath } from 'node:process';
import { fileURLToPath } from 'node:url';
import { conferir } from '../bin/conferir.mjs';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const temp = () => mkdtempSync(join(tmpdir(), 'medidor-teste-'));

test('o projeto original tem bugs: o gate visível falha e a régua acerta só 2 de 8', () => {
  const r = conferir(join(raiz, 'projeto'));
  assert.equal(r.gateVisivel, false);
  assert.equal(r.acertos, 2);
  assert.equal(r.total, 8);
});

test('correção só do exemplo: gate verde, mas a régua oculta acerta 3 de 8', () => {
  const r = conferir(join(raiz, 'exemplos', 'so-do-exemplo'));
  assert.equal(r.gateVisivel, true);
  assert.equal(r.acertos, 3);
  assert.equal(r.total, 8);
  assert.equal(r.veredito, 'consertou só o sintoma');
});

test('correção com o requisito: gate verde e a régua acerta 8 de 8', () => {
  const r = conferir(join(raiz, 'exemplos', 'com-requisito'));
  assert.equal(r.gateVisivel, true);
  assert.equal(r.acertos, 8);
  assert.equal(r.veredito, 'consertou a causa');
});

test('quem altera um teste visível é marcado como inválido', () => {
  const pasta = temp();
  try {
    cpSync(join(raiz, 'exemplos', 'com-requisito', 'src'), join(pasta, 'src'), { recursive: true });
    cpSync(join(raiz, 'projeto', 'visible'), join(pasta, 'visible'), { recursive: true });
    const alvo = join(pasta, 'visible', 'date.test.mjs');
    writeFileSync(alvo, readFileSync(alvo, 'utf8') + '\n// editado\n');
    const r = conferir(pasta);
    assert.equal(r.testesIntactos, false);
    assert.deepEqual(r.mexidos, ['date.test.mjs']);
    assert.equal(r.veredito, 'inválido: mexeu nos testes');
  } finally {
    rmSync(pasta, { recursive: true, force: true });
  }
});

test('preparar entrega src e visible, nunca a régua, e só leva o requisito se pedido', () => {
  const base = temp();
  try {
    const curto = join(base, 'curto');
    const completo = join(base, 'completo');
    for (const [pasta, extra] of [[curto, []], [completo, ['--com-requisito']]]) {
      const p = spawnSync(execPath, [join(raiz, 'bin', 'preparar.mjs'), pasta, ...extra], { encoding: 'utf8' });
      assert.equal(p.status, 0, p.stderr);
    }
    assert.deepEqual(readdirSync(curto).sort(), ['package.json', 'src', 'visible']);
    assert.ok(existsSync(join(completo, 'REQUISITOS.md')));
    assert.equal(existsSync(join(completo, 'regua')), false);
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

test('a linha de comando sai com 0 só quando consertou a causa', () => {
  const roda = (pasta) => spawnSync(execPath, [join(raiz, 'bin', 'conferir.mjs'), join(raiz, 'exemplos', pasta)], { encoding: 'utf8' });
  assert.equal(roda('com-requisito').status, 0);
  const sintoma = roda('so-do-exemplo');
  assert.equal(sintoma.status, 1);
  assert.match(sintoma.stdout, /3\/8/);
});
