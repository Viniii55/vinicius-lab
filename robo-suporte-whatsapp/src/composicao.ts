import { z } from 'zod';
import { AlertaSmtp } from './adaptadores/smtp.js';
import { ModeloAnthropic, VisaoAnthropic } from './adaptadores/anthropic.js';
import { ExtratorQuadrosFfmpeg } from './adaptadores/ffmpeg.js';
import { ModeloFake } from './adaptadores/fake.js';
import { TranscritorGroq } from './adaptadores/groq.js';
import { DestinoClickUp } from './adaptadores/clickup.js';
import {
  AlertaConsole,
  DestinoJson,
  GuardaArquivo,
  RegistroArquivo,
} from './adaptadores/local.js';
import { ModeloOpenAI } from './adaptadores/openai.js';
import { Pipeline } from './pipeline.js';
import type { Alerta, Destino, ModeloIA, Transcritor, Visao } from './tipos.js';

type Env = Record<string, string | undefined>;

export interface Montagem {
  pipeline: Pipeline;
  porta: number;
  token: string | undefined;
  /** Avisos de configuração para mostrar na subida. */
  avisos: string[];
}

/** Lê o ambiente. Variável vazia (como no .env.example) conta como ausente. */
export function montarDoAmbiente(env: Env = process.env): Montagem {
  const v = (nome: string): string | undefined => {
    const valor = env[nome]?.trim();
    return valor ? valor : undefined;
  };
  const exigir = (nome: string, motivo: string): string => {
    const valor = v(nome);
    if (valor === undefined) throw new Error(`Configuração: ${nome} é obrigatória para ${motivo}.`);
    return valor;
  };
  const avisos: string[] = [];
  const pasta = v('PASTA_DADOS') ?? 'dados';

  const modelos = montarCadeia(v('CADEIA_MODELOS'), exigir);
  if (modelos.length === 0) {
    modelos.push(new ModeloFake('fake'));
    avisos.push('CADEIA_MODELOS vazia: usando o modelo falso. Serve para demonstração, não para produção.');
  }

  const destino: Destino =
    (v('DESTINO') ?? 'json') === 'clickup'
      ? new DestinoClickUp({
          token: exigir('CLICKUP_TOKEN', 'DESTINO=clickup'),
          listaId: exigir('CLICKUP_LISTA_ID', 'DESTINO=clickup'),
        })
      : new DestinoJson(pasta);

  const alerta: Alerta =
    (v('ALERTA') ?? 'console') === 'smtp'
      ? AlertaSmtp.criar({
          host: exigir('SMTP_HOST', 'ALERTA=smtp'),
          porta: z.coerce.number().int().positive().parse(v('SMTP_PORTA') ?? '587'),
          ...(v('SMTP_USUARIO') !== undefined ? { usuario: v('SMTP_USUARIO') as string } : {}),
          ...(v('SMTP_SENHA') !== undefined ? { senha: v('SMTP_SENHA') as string } : {}),
          de: exigir('ALERTA_DE', 'ALERTA=smtp'),
          para: exigir('ALERTA_PARA', 'ALERTA=smtp'),
        })
      : new AlertaConsole();

  const chaveGroq = v('GROQ_API_KEY');
  const transcritor: Transcritor =
    chaveGroq !== undefined
      ? new TranscritorGroq({ chave: chaveGroq, modelo: v('GROQ_MODELO_WHISPER') ?? 'whisper-large-v3' })
      : naoConfigurado('Transcritor', 'GROQ_API_KEY');
  if (chaveGroq === undefined) avisos.push('GROQ_API_KEY ausente: áudios vão para a guarda com alerta.');

  const chaveAnthropic = v('ANTHROPIC_API_KEY');
  const modeloVisao = v('VISAO_MODELO_ANTHROPIC');
  const visaoConfigurada = chaveAnthropic !== undefined && modeloVisao !== undefined;
  const visao: Visao = visaoConfigurada
    ? new VisaoAnthropic({ chave: chaveAnthropic, modelo: modeloVisao })
    : naoConfigurado('Visão', 'ANTHROPIC_API_KEY e VISAO_MODELO_ANTHROPIC');
  if (!visaoConfigurada) {
    avisos.push('Visão não configurada: imagens e vídeos vão para a guarda com alerta.');
  }

  const pipeline = new Pipeline({
    processadores: { transcritor, visao, extratorQuadros: new ExtratorQuadrosFfmpeg() },
    modelos,
    destino,
    guarda: new GuardaArquivo(pasta),
    alerta,
    registro: new RegistroArquivo(pasta),
    timeoutModeloMs: z.coerce.number().int().positive().parse(v('MODELO_TIMEOUT_MS') ?? '30000'),
    aoRegistrar: (evento, dados) => console.log(JSON.stringify({ evento, ...dados })),
  });

  return {
    pipeline,
    porta: z.coerce.number().int().positive().parse(v('PORTA') ?? '3000'),
    token: v('WEBHOOK_TOKEN'),
    avisos,
  };
}

function montarCadeia(
  lista: string | undefined,
  exigir: (nome: string, motivo: string) => string,
): ModeloIA[] {
  if (lista === undefined) return [];
  return lista.split(',').map((item) => {
    const [provedor, ...resto] = item.trim().split(':');
    const modelo = resto.join(':');
    if (!provedor || !modelo) {
      throw new Error(`CADEIA_MODELOS: "${item}" deve ter o formato provedor:modelo.`);
    }
    switch (provedor) {
      case 'anthropic':
        return new ModeloAnthropic({ chave: exigir('ANTHROPIC_API_KEY', 'o provedor anthropic'), modelo });
      case 'openai':
        return new ModeloOpenAI({ chave: exigir('OPENAI_API_KEY', 'o provedor openai'), modelo });
      case 'fake':
        return new ModeloFake(`fake:${modelo}`);
      default:
        throw new Error(`CADEIA_MODELOS: provedor desconhecido "${provedor}" (use anthropic, openai ou fake).`);
    }
  });
}

/** Adaptador que sempre falha, com mensagem clara: a mensagem segue para o plano B em vez de sumir. */
function naoConfigurado(nome: string, variaveis: string): Transcritor & Visao {
  const falhar = async (): Promise<never> => {
    throw new Error(`${nome} não configurado (defina ${variaveis})`);
  };
  return { transcrever: falhar, descrever: falhar };
}
