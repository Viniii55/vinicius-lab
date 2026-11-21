import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';
import type { ConteudoProcessado, ModeloIA, Visao } from '../tipos.js';
import {
  DESCRICAO_FERRAMENTA,
  INSTRUCAO_SISTEMA,
  NOME_FERRAMENTA,
  esquemaDaFerramenta,
  exigirOk,
  textoDoUsuario,
} from './http.js';
import type { FetchFn } from './http.js';

const URL_API = 'https://api.anthropic.com/v1/messages';

interface OpcoesBase {
  chave: string;
  modelo: string;
  fetch?: FetchFn;
}

function cabecalhos(chave: string): Record<string, string> {
  return { 'x-api-key': chave, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' };
}

/** Tool use forçado: o modelo só pode responder chamando `registrar_tarefa`. */
export class ModeloAnthropic implements ModeloIA {
  readonly nome: string;
  private readonly http: FetchFn;

  constructor(private readonly o: OpcoesBase) {
    this.nome = `anthropic:${o.modelo}`;
    this.http = o.fetch ?? fetch;
  }

  async extrairTarefa(conteudo: ConteudoProcessado, { signal }: { signal: AbortSignal }): Promise<unknown> {
    const resposta = await this.http(URL_API, {
      method: 'POST',
      signal,
      headers: cabecalhos(this.o.chave),
      body: JSON.stringify({
        model: this.o.modelo,
        max_tokens: 1024,
        system: INSTRUCAO_SISTEMA,
        messages: [{ role: 'user', content: textoDoUsuario(conteudo) }],
        tools: [
          {
            name: NOME_FERRAMENTA,
            description: DESCRICAO_FERRAMENTA,
            input_schema: esquemaDaFerramenta(),
          },
        ],
        tool_choice: { type: 'tool', name: NOME_FERRAMENTA },
      }),
    });
    const corpo = (await (await exigirOk(resposta, this.nome)).json()) as {
      content?: { type: string; name?: string; input?: unknown }[];
    };
    const uso = corpo.content?.find((b) => b.type === 'tool_use' && b.name === NOME_FERRAMENTA);
    if (!uso) throw new Error(`${this.nome}: resposta sem chamada da ferramenta`);
    return uso.input;
  }
}

const TIPOS_IMAGEM: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};

/** Visão: aceita URL http(s) ou caminho de arquivo local (os quadros do vídeo são arquivos locais). */
export class VisaoAnthropic implements Visao {
  private readonly http: FetchFn;

  constructor(private readonly o: OpcoesBase) {
    this.http = o.fetch ?? fetch;
  }

  async descrever(imagem: string): Promise<string> {
    const fonte = /^https?:\/\//i.test(imagem)
      ? { type: 'url', url: imagem }
      : await this.fonteLocal(imagem);
    const resposta = await this.http(URL_API, {
      method: 'POST',
      headers: cabecalhos(this.o.chave),
      body: JSON.stringify({
        model: this.o.modelo,
        max_tokens: 512,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', source: fonte },
              {
                type: 'text',
                text: 'Descreva em português, em até 4 frases, o problema ou equipamento visível. Só o que se vê.',
              },
            ],
          },
        ],
      }),
    });
    const corpo = (await (await exigirOk(resposta, 'visão')).json()) as {
      content?: { type: string; text?: string }[];
    };
    const texto = corpo.content?.find((b) => b.type === 'text')?.text;
    if (!texto) throw new Error('visão: resposta sem texto');
    return texto;
  }

  private async fonteLocal(caminho: string) {
    const tipo = TIPOS_IMAGEM[extname(caminho).toLowerCase()];
    if (!tipo) throw new Error(`visão: tipo de imagem não suportado: ${extname(caminho) || '(sem extensão)'}`);
    const dados = (await readFile(caminho)).toString('base64');
    return { type: 'base64', media_type: tipo, data: dados };
  }
}
