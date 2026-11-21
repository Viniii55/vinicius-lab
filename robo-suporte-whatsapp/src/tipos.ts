import { z } from 'zod';

/** Formato próprio do webhook. Texto traz `conteudo`; as demais mídias trazem `url`. */
const base = {
  id: z.string().min(1).max(200),
  autor: z.string().min(1).max(200),
  recebidaEm: z.iso.datetime().optional(),
};

export const MensagemEntrada = z.discriminatedUnion('tipo', [
  z.object({ ...base, tipo: z.literal('texto'), conteudo: z.string().min(1).max(10_000) }),
  z.object({
    ...base,
    tipo: z.literal('audio'),
    url: z.string().min(1),
    legenda: z.string().max(2_000).optional(),
  }),
  z.object({
    ...base,
    tipo: z.literal('imagem'),
    url: z.string().min(1),
    legenda: z.string().max(2_000).optional(),
  }),
  z.object({
    ...base,
    tipo: z.literal('video'),
    url: z.string().min(1),
    legenda: z.string().max(2_000).optional(),
  }),
]);
export type MensagemEntrada = z.infer<typeof MensagemEntrada>;

export const Prioridade = z.enum(['baixa', 'media', 'alta', 'urgente']);
export type Prioridade = z.infer<typeof Prioridade>;

/** O que o modelo é obrigado a devolver (argumentos da ferramenta forçada). */
export const SaidaModelo = z.object({
  titulo: z.string().min(3).max(120),
  local: z.string().min(1).max(120),
  prioridade: Prioridade,
  descricao: z.string().min(1).max(4_000),
});
export type SaidaModelo = z.infer<typeof SaidaModelo>;

/** A tarefa final. O id da mensagem é colocado pelo sistema, nunca pelo modelo. */
export const Tarefa = SaidaModelo.extend({ mensagemId: z.string().min(1) });
export type Tarefa = z.infer<typeof Tarefa>;

/** Texto já extraído da mensagem (transcrição, descrição da imagem etc.). */
export interface ConteudoProcessado {
  mensagemId: string;
  autor: string;
  tipo: MensagemEntrada['tipo'];
  texto: string;
}

export type Resultado =
  | { estado: 'tarefa_criada'; mensagemId: string; tarefa: Tarefa; referencia: string }
  | { estado: 'guardada_com_alerta'; mensagemId: string; motivo: string };

// ---- Interfaces plugáveis ----

export interface Transcritor {
  transcrever(url: string): Promise<string>;
}

export interface Visao {
  /** Descreve uma imagem (URL ou caminho de arquivo local) em texto. */
  descrever(imagem: string): Promise<string>;
}

export interface ExtratorQuadros {
  /** Devolve até `quantidade` quadros do vídeo, como caminhos ou URLs de imagem. */
  extrair(video: string, quantidade: number): Promise<string[]>;
}

export interface ModeloIA {
  readonly nome: string;
  /**
   * Chama o modelo com ferramenta forçada e devolve os argumentos crus da ferramenta.
   * A validação contra o schema é feita por quem chama, nunca confiamos no modelo.
   */
  extrairTarefa(conteudo: ConteudoProcessado, opcoes: { signal: AbortSignal }): Promise<unknown>;
}

export interface Destino {
  /** Cria a tarefa e devolve uma referência (id ou URL). Deve ser idempotente por `mensagemId`. */
  criar(tarefa: Tarefa): Promise<string>;
}

export interface Alerta {
  enviar(aviso: { mensagemId: string; motivo: string }): Promise<void>;
}

export interface Guarda {
  /** Guarda a mensagem original. Regravar o mesmo id substitui, não duplica. */
  guardar(mensagem: MensagemEntrada, motivo: string): Promise<void>;
  /** Remove a cópia guardada, se existir (reentrega que depois deu certo). Sem cópia, não faz nada. */
  descartar(mensagemId: string): Promise<void>;
}

export interface Registro {
  obter(mensagemId: string): Promise<Resultado | undefined>;
  gravar(resultado: Resultado): Promise<void>;
}
