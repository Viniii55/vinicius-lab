import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { timingSafeEqual } from 'node:crypto';
import { FalhaDeEntrega } from './pipeline.js';
import type { Pipeline } from './pipeline.js';
import { MensagemEntrada } from './tipos.js';

export interface OpcoesWebhook {
  pipeline: Pick<Pipeline, 'tratar'>;
  /** Se definido, a requisição precisa trazer o mesmo valor no cabeçalho `x-webhook-token`. */
  token?: string;
  logger?: boolean;
}

/**
 * POST /webhook/mensagem
 *   200 -> a mensagem foi aceita e terminou em (a) ou (b); o corpo diz qual.
 *   400 -> payload fora do formato (nada é processado).
 *   401 -> token ausente ou errado.
 *   500 -> o plano B também falhou; a mensagem NÃO foi aceita, o remetente deve reenviar.
 *
 * O processamento é síncrono para ficar simples de ler e de testar. Em produção com
 * provedor que exige resposta rápida, responda 202 e processe numa fila.
 */
export function criarApp(opcoes: OpcoesWebhook): FastifyInstance {
  const app = Fastify({ logger: opcoes.logger ?? false });

  app.get('/saude', async () => ({ ok: true }));

  app.post('/webhook/mensagem', async (req, resposta) => {
    if (opcoes.token !== undefined && !tokenConfere(req.headers['x-webhook-token'], opcoes.token)) {
      return resposta.code(401).send({ erro: 'token inválido' });
    }

    const analise = MensagemEntrada.safeParse(req.body);
    if (!analise.success) {
      return resposta.code(400).send({
        erro: 'payload inválido',
        detalhes: analise.error.issues.map((i) => ({ campo: i.path.join('.'), problema: i.message })),
      });
    }

    try {
      const r = await opcoes.pipeline.tratar(analise.data);
      return resposta.code(200).send(r);
    } catch (erro) {
      req.log.error({ erro }, 'mensagem sem destino final');
      const id = erro instanceof FalhaDeEntrega ? erro.mensagemId : analise.data.id;
      return resposta.code(500).send({ erro: 'não foi possível guardar nem criar tarefa; reenvie', mensagemId: id });
    }
  });

  return app;
}

function tokenConfere(recebido: string | string[] | undefined, esperado: string): boolean {
  if (typeof recebido !== 'string') return false;
  const a = Buffer.from(recebido);
  const b = Buffer.from(esperado);
  return a.length === b.length && timingSafeEqual(a, b);
}
