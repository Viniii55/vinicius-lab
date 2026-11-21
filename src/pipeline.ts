import { executarCadeia, mensagemDeErro } from './cadeia.js';
import { processar } from './processamento.js';
import type { Processadores } from './processamento.js';
import type {
  Alerta,
  Destino,
  Guarda,
  MensagemEntrada,
  ModeloIA,
  Registro,
  Resultado,
  Tarefa,
} from './tipos.js';

export interface DependenciasPipeline {
  processadores: Processadores;
  modelos: readonly ModeloIA[];
  destino: Destino;
  guarda: Guarda;
  alerta: Alerta;
  registro: Registro;
  timeoutModeloMs?: number;
  /** Para observar a execução (logs). Não pode lançar. */
  aoRegistrar?: (evento: string, dados: Record<string, unknown>) => void;
}

/** Lançado quando nem o plano B (guardar + alertar) fechou. A mensagem NÃO foi aceita. */
export class FalhaDeEntrega extends Error {
  constructor(
    readonly mensagemId: string,
    detalhe: string,
  ) {
    super(`mensagem ${mensagemId} sem destino final: ${detalhe}`);
    this.name = 'FalhaDeEntrega';
  }
}

/**
 * INVARIANTE: toda mensagem aceita termina em exatamente um estado.
 *   (a) tarefa criada, ou
 *   (b) mensagem original guardada + alerta enviado.
 * Se nem (a) nem (b) se completam, `tratar` lança FalhaDeEntrega: o chamador
 * responde erro, o remetente reenvia e o mesmo id roda de novo (idempotente).
 */
export class Pipeline {
  private readonly emAndamento = new Map<string, Promise<Resultado>>();

  constructor(private readonly dep: DependenciasPipeline) {}

  tratar(msg: MensagemEntrada): Promise<Resultado> {
    // Duas entregas simultâneas do mesmo id compartilham a mesma execução.
    const atual = this.emAndamento.get(msg.id);
    if (atual) return atual;
    const execucao = this.executar(msg).finally(() => this.emAndamento.delete(msg.id));
    this.emAndamento.set(msg.id, execucao);
    return execucao;
  }

  private async executar(msg: MensagemEntrada): Promise<Resultado> {
    const anterior = await this.dep.registro.obter(msg.id);
    if (anterior) {
      this.log('duplicada', { mensagemId: msg.id, estado: anterior.estado });
      return anterior;
    }

    const tarefa = await this.tentarGerarTarefa(msg);
    if (typeof tarefa === 'string') return this.caminhoB(msg, tarefa);

    let referencia: string;
    try {
      referencia = await this.dep.destino.criar(tarefa);
    } catch (erro) {
      return this.caminhoB(msg, `destino da tarefa falhou: ${mensagemDeErro(erro)}`);
    }

    const resultado: Resultado = {
      estado: 'tarefa_criada',
      mensagemId: msg.id,
      tarefa,
      referencia,
    };
    // Reentrega depois de uma falha parcial em (b): a cópia guardada ficou velha, sai de cena.
    await this.tentar('descartar_guardada', msg.id, () => this.dep.guarda.descartar(msg.id));
    // A tarefa já existe. Se o registro falhar, o destino precisa ser idempotente por mensagemId.
    await this.tentar('registro', msg.id, () => this.dep.registro.gravar(resultado));
    this.log('tarefa_criada', { mensagemId: msg.id, referencia });
    return resultado;
  }

  /** Devolve a tarefa, ou a string com o motivo da falha. Nunca lança. */
  private async tentarGerarTarefa(msg: MensagemEntrada): Promise<Tarefa | string> {
    try {
      const conteudo = await processar(msg, this.dep.processadores);
      const cadeia = await executarCadeia(
        this.dep.modelos,
        conteudo,
        this.dep.timeoutModeloMs ?? 30_000,
      );
      if (!cadeia.ok) {
        return `todos os modelos falharam: ${cadeia.falhas.map((f) => `${f.modelo} (${f.motivo})`).join('; ') || 'nenhum modelo configurado'}`;
      }
      this.log('modelo_ok', { mensagemId: msg.id, modelo: cadeia.modelo, falhasAntes: cadeia.falhas.length });
      return { ...cadeia.saida, mensagemId: msg.id };
    } catch (erro) {
      return `falha ao processar a mídia: ${mensagemDeErro(erro)}`;
    }
  }

  /** Estado (b): guarda a original, depois alerta. Qualquer falha aqui vira FalhaDeEntrega. */
  private async caminhoB(msg: MensagemEntrada, motivo: string): Promise<Resultado> {
    try {
      await this.dep.guarda.guardar(msg, motivo);
      await this.dep.alerta.enviar({ mensagemId: msg.id, motivo });
    } catch (erro) {
      throw new FalhaDeEntrega(msg.id, mensagemDeErro(erro));
    }
    const resultado: Resultado = { estado: 'guardada_com_alerta', mensagemId: msg.id, motivo };
    try {
      await this.dep.registro.gravar(resultado);
    } catch (erro) {
      throw new FalhaDeEntrega(msg.id, `registro: ${mensagemDeErro(erro)}`);
    }
    this.log('guardada_com_alerta', { mensagemId: msg.id, motivo });
    return resultado;
  }

  private async tentar(etapa: string, mensagemId: string, acao: () => Promise<void>): Promise<void> {
    try {
      await acao();
    } catch (erro) {
      this.log('falha_nao_fatal', { mensagemId, etapa, erro: mensagemDeErro(erro) });
    }
  }

  private log(evento: string, dados: Record<string, unknown>): void {
    try {
      this.dep.aoRegistrar?.(evento, dados);
    } catch {
      /* observação nunca derruba o fluxo */
    }
  }
}
