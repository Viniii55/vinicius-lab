/**
 * Simulador de linha de comando: injeta as mensagens de exemplos/ no pipeline,
 * sem chave, sem rede, com modelo falso determinístico e adaptadores locais.
 */
import { readdir, readFile, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ExtratorQuadrosFake, ModeloFake, TranscritorFake, VisaoFake } from './adaptadores/fake.js';
import { AlertaConsole, DestinoJson, GuardaArquivo, RegistroArquivo } from './adaptadores/local.js';
import { Pipeline } from './pipeline.js';
import { MensagemEntrada } from './tipos.js';
import type { Resultado } from './tipos.js';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const pastaDados = join(raiz, 'dados', 'demo');

const midias = JSON.parse(await readFile(join(raiz, 'exemplos', 'midias-simuladas.json'), 'utf8')) as {
  transcricoes: Record<string, string>;
  descricoes: Record<string, string>;
};

// Cada execução parte do zero (a pasta é só da demo e está no .gitignore).
await rm(pastaDados, { recursive: true, force: true });

const eventos: string[] = [];
const alertas: string[] = [];

const pipeline = new Pipeline({
  processadores: {
    transcritor: new TranscritorFake(midias.transcricoes),
    visao: new VisaoFake(midias.descricoes),
    extratorQuadros: new ExtratorQuadrosFake(),
  },
  // Cadeia de dois modelos falsos. O marcador "[falha-primario]" derruba só o primeiro;
  // "[falha-simulada]" derruba os dois.
  modelos: [
    new ModeloFake('fake-principal', /\[falha-primario\]|\[falha-simulada\]/),
    new ModeloFake('fake-reserva', /\[falha-simulada\]/),
  ],
  destino: new DestinoJson(pastaDados),
  guarda: new GuardaArquivo(pastaDados),
  alerta: new AlertaConsole((linha) => alertas.push(linha)),
  registro: new RegistroArquivo(pastaDados),
  timeoutModeloMs: 1_000,
  aoRegistrar: (evento, dados) => {
    if (evento === 'modelo_ok') {
      eventos.push(`modelo ${String(dados.modelo)} (falhas antes: ${String(dados.falhasAntes)})`);
    }
  },
});

const pastaMensagens = join(raiz, 'exemplos', 'mensagens');
const arquivos = (await readdir(pastaMensagens)).filter((f) => f.endsWith('.json')).sort();
const mensagens = [];
for (const arquivo of arquivos) {
  const bruta: unknown = JSON.parse(await readFile(join(pastaMensagens, arquivo), 'utf8'));
  mensagens.push({ arquivo, msg: MensagemEntrada.parse(bruta) });
}
// Reenvio da primeira, como o WhatsApp faz quando o webhook demora: tem de dar 1 tarefa só.
const primeira = mensagens[0];
if (primeira) mensagens.push({ arquivo: `${primeira.arquivo} (reenvio)`, msg: primeira.msg });

console.log('=== Robô de suporte: demonstração (modelo falso, dados fictícios, sem chaves) ===\n');

const resultados = new Map<string, Resultado>();
for (const { arquivo, msg } of mensagens) {
  eventos.length = 0;
  const r = await pipeline.tratar(msg);
  resultados.set(msg.id, r);
  const detalhe =
    r.estado === 'tarefa_criada'
      ? `${eventos[0] ?? 'já processada antes (idempotência)'}`
      : 'plano B';
  console.log(`${arquivo}\n  -> ${r.estado}   [${detalhe}]`);
}

const tarefas = JSON.parse(await readFile(join(pastaDados, 'tarefas.json'), 'utf8')) as {
  titulo: string;
  local: string;
  prioridade: string;
  mensagemId: string;
}[];

console.log('\n=== Tarefas criadas ===');
for (const t of tarefas) {
  console.log(`- [${t.prioridade.toUpperCase()}] ${t.titulo} | local: ${t.local} | msg: ${t.mensagemId}`);
}

const guardadas = [...resultados.values()].filter((r) => r.estado === 'guardada_com_alerta');
console.log('\n=== Terminaram em (b): mensagem guardada + alerta ===');
for (const r of guardadas) console.log(`- ${r.mensagemId}: ${r.estado === 'guardada_com_alerta' ? r.motivo : ''}`);
for (const a of alertas) console.log(a);

// Confere a invariante nos dados que ficaram em disco, não só nas respostas.
const guardadasEmDisco = (await readdir(join(pastaDados, 'guardadas'))).length;
const unicas = resultados.size;
const ok =
  tarefas.length + guardadasEmDisco === unicas &&
  alertas.length === guardadasEmDisco &&
  tarefas.every((t) => resultados.get(t.mensagemId)?.estado === 'tarefa_criada');

console.log(
  `\nMensagens enviadas: ${mensagens.length} | ids distintos: ${unicas} | tarefas: ${tarefas.length} | guardadas: ${guardadasEmDisco} | alertas: ${alertas.length}`,
);
console.log(ok ? 'Invariante OK: cada mensagem terminou em (a) ou em (b), nunca nos dois.' : 'INVARIANTE VIOLADA');
process.exitCode = ok ? 0 : 1;
