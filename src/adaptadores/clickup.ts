import type { Destino, Prioridade, Tarefa } from '../tipos.js';
import { exigirOk } from './http.js';
import type { FetchFn } from './http.js';

// ClickUp: 1 urgente, 2 alta, 3 normal, 4 baixa.
const PRIORIDADE: Record<Prioridade, number> = { urgente: 1, alta: 2, media: 3, baixa: 4 };

/**
 * Cria a tarefa numa lista do ClickUp.
 * A API não tem chave de idempotência: a proteção contra duplicata é o registro de ids do
 * Pipeline. O id da mensagem vai no fim da descrição para quem precisar achar a origem.
 */
export class DestinoClickUp implements Destino {
  private readonly http: FetchFn;

  constructor(private readonly o: { token: string; listaId: string; fetch?: FetchFn }) {
    this.http = o.fetch ?? fetch;
  }

  async criar(tarefa: Tarefa): Promise<string> {
    const resposta = await this.http(
      `https://api.clickup.com/api/v2/list/${encodeURIComponent(this.o.listaId)}/task`,
      {
        method: 'POST',
        // O token pessoal do ClickUp vai puro no cabeçalho, sem prefixo.
        headers: { authorization: this.o.token, 'content-type': 'application/json' },
        body: JSON.stringify({
          name: tarefa.titulo,
          description: `Local: ${tarefa.local}\n\n${tarefa.descricao}\n\nID da mensagem: ${tarefa.mensagemId}`,
          priority: PRIORIDADE[tarefa.prioridade],
        }),
      },
    );
    const corpo = (await (await exigirOk(resposta, 'clickup')).json()) as { id?: string; url?: string };
    const referencia = corpo.url ?? corpo.id;
    if (!referencia) throw new Error('clickup: resposta sem id da tarefa');
    return referencia;
  }
}
