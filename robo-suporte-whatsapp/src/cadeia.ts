import { SaidaModelo } from './tipos.js';
import type { ConteudoProcessado, ModeloIA } from './tipos.js';

export interface TentativaFalha {
  modelo: string;
  motivo: string;
}

export type ResultadoCadeia =
  | { ok: true; modelo: string; saida: SaidaModelo; falhas: TentativaFalha[] }
  | { ok: false; falhas: TentativaFalha[] };

/**
 * Tenta cada modelo em ordem. Para no primeiro que devolver uma saída válida.
 * Erro, timeout e saída fora do schema contam igual: falha, próximo da lista.
 * Nunca lança: o chamador decide o destino da mensagem olhando o resultado.
 */
export async function executarCadeia(
  modelos: readonly ModeloIA[],
  conteudo: ConteudoProcessado,
  timeoutMs: number,
): Promise<ResultadoCadeia> {
  const falhas: TentativaFalha[] = [];

  for (const modelo of modelos) {
    const controle = new AbortController();
    let temporizador: NodeJS.Timeout | undefined;
    try {
      const bruto = await Promise.race([
        modelo.extrairTarefa(conteudo, { signal: controle.signal }),
        new Promise<never>((_, rejeitar) => {
          temporizador = setTimeout(() => {
            controle.abort();
            rejeitar(new Error(`timeout após ${timeoutMs} ms`));
          }, timeoutMs);
        }),
      ]);
      const validada = SaidaModelo.safeParse(bruto);
      if (validada.success) {
        return { ok: true, modelo: modelo.nome, saida: validada.data, falhas };
      }
      falhas.push({
        modelo: modelo.nome,
        motivo: `saída fora do schema: ${validada.error.issues.map((i) => i.path.join('.') || '(raiz)').join(', ')}`,
      });
    } catch (erro) {
      falhas.push({ modelo: modelo.nome, motivo: mensagemDeErro(erro) });
    } finally {
      clearTimeout(temporizador);
    }
  }

  return { ok: false, falhas };
}

export function mensagemDeErro(erro: unknown): string {
  return erro instanceof Error ? erro.message : String(erro);
}
