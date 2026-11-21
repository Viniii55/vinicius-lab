import type {
  Alerta,
  Destino,
  Guarda,
  MensagemEntrada,
  Registro,
  Resultado,
  Tarefa,
} from '../tipos.js';

/** Adaptadores em memória, com injeção de falha. Servem aos testes e a quem quiser experimentar. */

export class DestinoMemoria implements Destino {
  readonly tarefas = new Map<string, Tarefa>();
  falhar = false;

  async criar(tarefa: Tarefa): Promise<string> {
    if (this.falhar) throw new Error('destino indisponível');
    this.tarefas.set(tarefa.mensagemId, tarefa);
    return `memoria#${tarefa.mensagemId}`;
  }
}

export class GuardaMemoria implements Guarda {
  readonly mensagens = new Map<string, { mensagem: MensagemEntrada; motivo: string }>();
  falhar = false;

  async guardar(mensagem: MensagemEntrada, motivo: string): Promise<void> {
    if (this.falhar) throw new Error('disco cheio');
    this.mensagens.set(mensagem.id, { mensagem, motivo });
  }

  async descartar(mensagemId: string): Promise<void> {
    this.mensagens.delete(mensagemId);
  }
}

export class AlertaMemoria implements Alerta {
  readonly avisos: { mensagemId: string; motivo: string }[] = [];
  falhar = false;

  async enviar(aviso: { mensagemId: string; motivo: string }): Promise<void> {
    if (this.falhar) throw new Error('smtp fora do ar');
    this.avisos.push(aviso);
  }
}

export class RegistroMemoria implements Registro {
  readonly resultados = new Map<string, Resultado>();

  async obter(mensagemId: string): Promise<Resultado | undefined> {
    return this.resultados.get(mensagemId);
  }

  async gravar(resultado: Resultado): Promise<void> {
    this.resultados.set(resultado.mensagemId, resultado);
  }
}
