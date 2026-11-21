import { z } from 'zod';
import { SaidaModelo } from '../tipos.js';
import type { ConteudoProcessado } from '../tipos.js';

/** Injetável nos testes: nenhum teste do repositório faz chamada de rede. */
export type FetchFn = typeof fetch;

export function cabecalhoAutorizacao(esquema: string, credencial: string): string {
  return `${esquema} ${credencial}`;
}

export async function exigirOk(resposta: Response, quem: string): Promise<Response> {
  if (resposta.ok) return resposta;
  const corpo = (await resposta.text().catch(() => '')).slice(0, 200);
  throw new Error(`${quem}: HTTP ${resposta.status} ${corpo}`.trim());
}

export const NOME_FERRAMENTA = 'registrar_tarefa';

export const DESCRICAO_FERRAMENTA =
  'Registra a tarefa de manutenção ou de produção descrita no aviso. Deve ser chamada sempre, exatamente uma vez.';

/** JSON Schema da ferramenta, gerado do mesmo zod que valida a resposta. Uma fonte só. */
export function esquemaDaFerramenta(): Record<string, unknown> {
  const esquema = { ...z.toJSONSchema(SaidaModelo) } as Record<string, unknown>;
  delete esquema.$schema;
  return esquema;
}

export const INSTRUCAO_SISTEMA = [
  'Você recebe o aviso de um problema numa fábrica, escrito ou transcrito de áudio, imagem ou vídeo.',
  'Transforme o aviso em uma tarefa chamando a ferramenta registrar_tarefa.',
  'Título curto e específico. Local é o setor ou equipamento citado, ou "Não informado".',
  'Prioridade: urgente só para risco de pessoas ou de parada total; alta para parada de linha;',
  'media para falha que ainda permite produzir; baixa para o resto.',
  'Não invente fatos que não estão no aviso.',
].join(' ');

export function textoDoUsuario(c: ConteudoProcessado): string {
  return `Aviso de ${c.autor} (via ${c.tipo}):\n${c.texto}`;
}
