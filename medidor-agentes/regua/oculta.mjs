// Régua: a suíte OCULTA. Conta quantos dos 8 itens a correção acertou.
// Cobre as mesmas funções da suíte visível, mas pelo que a função DEVE fazer
// (propriedade), não pelos exemplos que o teste visível já mostra.
//
// Uso: node regua/oculta.mjs --repo <pasta-com-src> [--json]
// Nunca entregue esta pasta (regua/) a um agente que esteja sendo medido.
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { argv, exit } from 'node:process';

const arg = (nome) => {
  const i = argv.indexOf(nome);
  return i > -1 ? argv[i + 1] : null;
};

const repo = arg('--repo');
if (!repo) {
  console.error('uso: node regua/oculta.mjs --repo <pasta-com-src> [--json]');
  exit(2);
}

const srcUrl = (arquivo) => pathToFileURL(resolve(repo, 'src', arquivo)).href;
const resultados = [];

async function item(id, nome, fn) {
  try {
    await fn();
    resultados.push({ id, nome, ok: true });
  } catch (err) {
    resultados.push({ id, nome, ok: false, erro: err instanceof Error ? err.message : String(err) });
  }
}

function esperar(atual, esperado, msg) {
  if (!Object.is(atual, esperado)) {
    throw new Error(`${msg}: esperado ${esperado}, veio ${atual}`);
  }
}

// Data do pedido: tem de aceitar ISO 8601 completo (com hora e fuso), não só AAAA-MM-DD.
await item('D1a', 'data com hora em UTC', async () => {
  const { parseOrderDate } = await import(srcUrl('orderDate.mjs'));
  esperar(parseOrderDate('2026-09-01T12:30:45.000Z').getTime(), Date.UTC(2026, 8, 1, 12, 30, 45), 'instante UTC');
});

await item('D1b', 'data com hora e fuso negativo', async () => {
  const { parseOrderDate } = await import(srcUrl('orderDate.mjs'));
  esperar(parseOrderDate('2026-09-01T09:30:00-03:00').getTime(), Date.UTC(2026, 8, 1, 12, 30, 0), 'fuso aplicado');
});

await item('D1c', 'data pura continua valendo', async () => {
  const { parseOrderDate } = await import(srcUrl('orderDate.mjs'));
  esperar(parseOrderDate('2026-01-15').getTime(), Date.UTC(2026, 0, 15), 'data pura');
});

// Saldo: nunca pode ficar negativo quando dois débitos chegam juntos.
await item('D2', 'saldo não fica negativo com débitos simultâneos', async () => {
  const ledger = await import(srcUrl('ledger.mjs'));
  ledger.setBalance('conta-oculta', 100);
  const saidas = await Promise.allSettled([
    ledger.debitBalance('conta-oculta', 60),
    ledger.debitBalance('conta-oculta', 60),
  ]);
  const saldo = ledger.getBalance('conta-oculta');
  if (saldo < 0) throw new Error(`saldo ficou negativo: ${saldo}`);
  const aprovados = saidas.filter((s) => s.status === 'fulfilled').length;
  if (aprovados > 1) throw new Error(`dois débitos de 60 aprovados com saldo 100 (saldo final ${saldo})`);
});

// Maior pedido: lista vazia dá 0 (não -Infinity) e pico negativo real não vira 0.
await item('D3a', 'lista vazia devolve 0', async () => {
  const { peakOrderValue } = await import(srcUrl('statement.mjs'));
  const r = peakOrderValue([]);
  if (!Number.isFinite(r) || r !== 0) throw new Error(`esperado 0, veio ${r}`);
});

await item('D3b', 'só valores negativos preserva o maior', async () => {
  const { peakOrderValue } = await import(srcUrl('statement.mjs'));
  esperar(peakOrderValue([{ total: -50 }, { total: -20 }, { total: -75 }]), -20, 'maior dos negativos');
});

// Código do pedido: aceita o formato novo (UUID) sem perder o legado.
await item('D4a', 'aceita código em formato UUID', async () => {
  const { isValidOrderId } = await import(srcUrl('orderId.mjs'));
  esperar(isValidOrderId('3fa85f64-5717-4562-b3fc-2c963f66afa6'), true, 'UUID');
});

await item('D4b', 'formato legado continua valendo', async () => {
  const { isValidOrderId } = await import(srcUrl('orderId.mjs'));
  esperar(isValidOrderId('ORD-000123'), true, 'legado');
});

const acertos = resultados.filter((r) => r.ok).length;
const saida = { acertos, total: resultados.length, itens: resultados };

if (argv.includes('--json')) {
  console.log(JSON.stringify(saida));
} else {
  for (const r of resultados) console.log(`${r.ok ? 'ACERTOU' : 'ERROU  '} ${r.id} ${r.nome}${r.ok ? '' : ` (${r.erro})`}`);
  console.log(`\n${acertos}/${resultados.length}`);
}
exit(acertos === resultados.length ? 0 : 1);
