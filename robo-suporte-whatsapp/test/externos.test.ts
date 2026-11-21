import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { ModeloAnthropic, VisaoAnthropic } from '../src/adaptadores/anthropic.js';
import { DestinoClickUp } from '../src/adaptadores/clickup.js';
import { ExtratorQuadrosFfmpeg } from '../src/adaptadores/ffmpeg.js';
import { TranscritorGroq } from '../src/adaptadores/groq.js';
import { ModeloOpenAI } from '../src/adaptadores/openai.js';
import { AlertaSmtp } from '../src/adaptadores/smtp.js';
import { saidaValida } from './ajudas.js';
import type { FetchFn } from '../src/adaptadores/http.js';
import type { Tarefa } from '../src/tipos.js';

// Nenhum teste aqui usa rede nem chave real: `fetch` é substituído e as chaves são de mentira.
const CHAVE_FALSA = 'chave-de-teste';
const conteudo = { mensagemId: 'm1', autor: 'op', tipo: 'texto' as const, texto: 'forno parou' };
const sinal = new AbortController().signal;

function respostaJson(corpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(corpo), { status, headers: { 'content-type': 'application/json' } });
}

function fetchFalso(resposta: Response) {
  return vi.fn<FetchFn>(async () => resposta);
}

function corpoEnviado(f: ReturnType<typeof fetchFalso>): Record<string, unknown> {
  const init = f.mock.calls[0]?.[1];
  return JSON.parse(String(init?.body)) as Record<string, unknown>;
}

describe('ModeloAnthropic', () => {
  it('força a ferramenta e devolve os argumentos dela', async () => {
    const f = fetchFalso(
      respostaJson({ content: [{ type: 'tool_use', name: 'registrar_tarefa', input: saidaValida }] }),
    );
    const m = new ModeloAnthropic({ chave: CHAVE_FALSA, modelo: 'modelo-x', fetch: f });
    expect(await m.extrairTarefa(conteudo, { signal: sinal })).toEqual(saidaValida);
    const corpo = corpoEnviado(f);
    expect(corpo.tool_choice).toEqual({ type: 'tool', name: 'registrar_tarefa' });
    const schema = (corpo.tools as { input_schema: { required: string[] } }[])[0]?.input_schema;
    expect(schema?.required).toEqual(['titulo', 'local', 'prioridade', 'descricao']);
  });

  it('resposta sem chamada da ferramenta é falha', async () => {
    const f = fetchFalso(respostaJson({ content: [{ type: 'text', text: 'oi' }] }));
    const m = new ModeloAnthropic({ chave: CHAVE_FALSA, modelo: 'modelo-x', fetch: f });
    await expect(m.extrairTarefa(conteudo, { signal: sinal })).rejects.toThrow(/sem chamada/);
  });

  it('HTTP de erro é falha', async () => {
    const f = fetchFalso(respostaJson({ erro: 'x' }, 529));
    const m = new ModeloAnthropic({ chave: CHAVE_FALSA, modelo: 'modelo-x', fetch: f });
    await expect(m.extrairTarefa(conteudo, { signal: sinal })).rejects.toThrow(/529/);
  });
});

describe('ModeloOpenAI', () => {
  const comArgumentos = (args: string) =>
    respostaJson({
      choices: [{ message: { tool_calls: [{ function: { name: 'registrar_tarefa', arguments: args } }] } }],
    });

  it('força a ferramenta e faz o parse dos argumentos', async () => {
    const f = fetchFalso(comArgumentos(JSON.stringify(saidaValida)));
    const m = new ModeloOpenAI({ chave: CHAVE_FALSA, modelo: 'modelo-y', fetch: f });
    expect(await m.extrairTarefa(conteudo, { signal: sinal })).toEqual(saidaValida);
    expect(corpoEnviado(f).tool_choice).toEqual({ type: 'function', function: { name: 'registrar_tarefa' } });
  });

  it('argumentos que não são JSON viram falha (a cadeia segue para o próximo)', async () => {
    const f = fetchFalso(comArgumentos('{titulo: quebrado'));
    const m = new ModeloOpenAI({ chave: CHAVE_FALSA, modelo: 'modelo-y', fetch: f });
    await expect(m.extrairTarefa(conteudo, { signal: sinal })).rejects.toThrow();
  });
});

describe('TranscritorGroq', () => {
  it('baixa o áudio, envia ao Whisper e devolve o texto', async () => {
    const f = vi
      .fn<FetchFn>()
      .mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3])))
      .mockResolvedValueOnce(respostaJson({ text: '  o forno parou  ' }));
    const t = new TranscritorGroq({ chave: CHAVE_FALSA, modelo: 'whisper-x', fetch: f });
    expect(await t.transcrever('https://exemplo.invalid/a.ogg')).toBe('o forno parou');
    expect(f.mock.calls[1]?.[0]).toContain('/audio/transcriptions');
  });

  it('transcrição vazia é falha', async () => {
    const f = vi
      .fn<FetchFn>()
      .mockResolvedValueOnce(new Response(new Uint8Array([1])))
      .mockResolvedValueOnce(respostaJson({ text: '   ' }));
    const t = new TranscritorGroq({ chave: CHAVE_FALSA, modelo: 'whisper-x', fetch: f });
    await expect(t.transcrever('https://exemplo.invalid/a.ogg')).rejects.toThrow(/vazia/);
  });
});

describe('VisaoAnthropic', () => {
  it('manda URL http(s) como fonte de imagem por URL', async () => {
    const f = fetchFalso(respostaJson({ content: [{ type: 'text', text: 'um forno aberto' }] }));
    const v = new VisaoAnthropic({ chave: CHAVE_FALSA, modelo: 'modelo-v', fetch: f });
    expect(await v.descrever('https://exemplo.invalid/f.jpg')).toBe('um forno aberto');
    const msgs = corpoEnviado(f).messages as { content: { source?: { type: string } }[] }[];
    expect(msgs[0]?.content[0]?.source?.type).toBe('url');
  });

  it('rejeita extensão de imagem desconhecida em arquivo local', async () => {
    const v = new VisaoAnthropic({ chave: CHAVE_FALSA, modelo: 'modelo-v', fetch: fetchFalso(respostaJson({})) });
    await expect(v.descrever('quadro.bmp')).rejects.toThrow(/não suportado/);
  });
});

describe('DestinoClickUp', () => {
  const tarefa: Tarefa = { ...saidaValida, prioridade: 'urgente', mensagemId: 'm1' };

  it('cria na lista, mapeia a prioridade e devolve a URL', async () => {
    const f = fetchFalso(respostaJson({ id: 'abc', url: 'https://exemplo.invalid/t/abc' }));
    const d = new DestinoClickUp({ token: CHAVE_FALSA, listaId: 'lista-1', fetch: f });
    expect(await d.criar(tarefa)).toBe('https://exemplo.invalid/t/abc');
    expect(String(f.mock.calls[0]?.[0])).toContain('/list/lista-1/task');
    const corpo = corpoEnviado(f);
    expect(corpo.priority).toBe(1);
    expect(corpo.name).toBe(tarefa.titulo);
    expect(String(corpo.description)).toContain('ID da mensagem: m1');
  });

  it('erro HTTP é falha (a mensagem vai para o plano B)', async () => {
    const f = fetchFalso(respostaJson({ err: 'x' }, 401));
    const d = new DestinoClickUp({ token: CHAVE_FALSA, listaId: 'l', fetch: f });
    await expect(d.criar(tarefa)).rejects.toThrow(/401/);
  });
});

describe('AlertaSmtp', () => {
  it('envia o e-mail com id e motivo', async () => {
    const sendMail = vi.fn(async () => ({}));
    await new AlertaSmtp({ sendMail }, 'robo@exemplo.invalid', 'equipe@exemplo.invalid').enviar({
      mensagemId: 'm7',
      motivo: 'ia fora do ar',
    });
    const enviado = (sendMail.mock.calls[0] as unknown as [{ to: string; subject: string; text: string }])[0];
    expect(enviado.to).toBe('equipe@exemplo.invalid');
    expect(enviado.subject).toContain('m7');
    expect(enviado.text).toContain('ia fora do ar');
  });

  it('falha do SMTP propaga (o pipeline trata como plano B incompleto)', async () => {
    const sendMail = vi.fn(async () => {
      throw new Error('conexão recusada');
    });
    await expect(
      new AlertaSmtp({ sendMail }, 'a@exemplo.invalid', 'b@exemplo.invalid').enviar({ mensagemId: 'x', motivo: 'y' }),
    ).rejects.toThrow(/recusada/);
  });
});

describe('ExtratorQuadrosFfmpeg', () => {
  it('chama o ffmpeg com argumentos em lista e devolve só os quadros que existem', async () => {
    const executar = vi.fn(async (_cmd: string, args: string[]) => {
      const molde = args[args.length - 1] ?? '';
      const pasta = dirname(molde);
      await mkdir(pasta, { recursive: true });
      await writeFile(molde.replace('%02d', '01'), 'x');
      await writeFile(molde.replace('%02d', '02'), 'x');
    });
    const quadros = await new ExtratorQuadrosFfmpeg(executar).extrair('https://exemplo.invalid/v.mp4', 3);
    expect(quadros).toHaveLength(2); // pediu 3, o vídeo só rendeu 2
    expect(executar.mock.calls[0]?.[0]).toBe('ffmpeg');
    expect(executar.mock.calls[0]?.[1]).toContain('https://exemplo.invalid/v.mp4');
  });
});
