import type { ConteudoProcessado, ModeloIA } from '../tipos.js';
import {
  DESCRICAO_FERRAMENTA,
  INSTRUCAO_SISTEMA,
  NOME_FERRAMENTA,
  cabecalhoAutorizacao,
  esquemaDaFerramenta,
  exigirOk,
  textoDoUsuario,
} from './http.js';
import type { FetchFn } from './http.js';

/** Tool use forçado no formato chat completions. Serve também a provedores com API compatível. */
export class ModeloOpenAI implements ModeloIA {
  readonly nome: string;
  private readonly http: FetchFn;

  constructor(
    private readonly o: { chave: string; modelo: string; urlBase?: string; fetch?: FetchFn },
  ) {
    this.nome = `openai:${o.modelo}`;
    this.http = o.fetch ?? fetch;
  }

  async extrairTarefa(conteudo: ConteudoProcessado, { signal }: { signal: AbortSignal }): Promise<unknown> {
    const base = this.o.urlBase ?? 'https://api.openai.com/v1';
    const resposta = await this.http(`${base}/chat/completions`, {
      method: 'POST',
      signal,
      headers: {
        authorization: cabecalhoAutorizacao('Bearer', this.o.chave),
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: this.o.modelo,
        messages: [
          { role: 'system', content: INSTRUCAO_SISTEMA },
          { role: 'user', content: textoDoUsuario(conteudo) },
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: NOME_FERRAMENTA,
              description: DESCRICAO_FERRAMENTA,
              parameters: esquemaDaFerramenta(),
            },
          },
        ],
        tool_choice: { type: 'function', function: { name: NOME_FERRAMENTA } },
      }),
    });
    const corpo = (await (await exigirOk(resposta, this.nome)).json()) as {
      choices?: { message?: { tool_calls?: { function?: { name?: string; arguments?: string } }[] } }[];
    };
    const chamada = corpo.choices?.[0]?.message?.tool_calls?.find(
      (c) => c.function?.name === NOME_FERRAMENTA,
    );
    const argumentos = chamada?.function?.arguments;
    if (argumentos === undefined) throw new Error(`${this.nome}: resposta sem chamada da ferramenta`);
    return JSON.parse(argumentos); // JSON quebrado lança aqui e vira falha na cadeia
  }
}
