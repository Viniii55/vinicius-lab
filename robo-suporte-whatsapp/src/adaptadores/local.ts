import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type {
  Alerta,
  Destino,
  Guarda,
  MensagemEntrada,
  Registro,
  Resultado,
  Tarefa,
} from '../tipos.js';

/** Arquivo JSON com escrita atômica e fila: duas escritas ao mesmo tempo não se corrompem. */
class ArquivoJson<T> {
  private fila: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly caminho: string,
    private readonly vazio: () => T,
  ) {}

  async ler(): Promise<T> {
    try {
      return JSON.parse(await readFile(this.caminho, 'utf8')) as T;
    } catch (erro) {
      if ((erro as NodeJS.ErrnoException).code === 'ENOENT') return this.vazio();
      throw erro;
    }
  }

  /** Lê, aplica `mudar` e grava, tudo dentro da fila. */
  atualizar<R>(mudar: (atual: T) => { novo: T; retorno: R }): Promise<R> {
    const passo = this.fila.then(async () => {
      const { novo, retorno } = mudar(await this.ler());
      await gravarAtomico(this.caminho, JSON.stringify(novo, null, 2));
      return retorno;
    });
    this.fila = passo.catch(() => undefined);
    return passo;
  }
}

async function gravarAtomico(caminho: string, conteudo: string): Promise<void> {
  await mkdir(dirname(caminho), { recursive: true });
  const temporario = `${caminho}.${process.pid}.tmp`;
  await writeFile(temporario, conteudo, 'utf8');
  await rename(temporario, caminho);
}

/** Destino padrão: acrescenta a tarefa em `tarefas.json`. Mesmo `mensagemId` = mesma tarefa. */
export class DestinoJson implements Destino {
  private readonly arquivo: ArquivoJson<Tarefa[]>;

  constructor(pasta: string) {
    this.arquivo = new ArquivoJson<Tarefa[]>(join(pasta, 'tarefas.json'), () => []);
  }

  criar(tarefa: Tarefa): Promise<string> {
    return this.arquivo.atualizar((tarefas) => {
      const existe = tarefas.some((t) => t.mensagemId === tarefa.mensagemId);
      return {
        novo: existe ? tarefas : [...tarefas, tarefa],
        retorno: `tarefas.json#${tarefa.mensagemId}`,
      };
    });
  }
}

/** Guarda padrão: um arquivo por mensagem. O nome é o hash do id, então o id nunca vira caminho. */
export class GuardaArquivo implements Guarda {
  constructor(private readonly pasta: string) {}

  async guardar(mensagem: MensagemEntrada, motivo: string): Promise<void> {
    const registro = { guardadaEm: new Date().toISOString(), motivo, mensagem };
    await gravarAtomico(this.caminho(mensagem.id), JSON.stringify(registro, null, 2));
  }

  async descartar(mensagemId: string): Promise<void> {
    await rm(this.caminho(mensagemId), { force: true });
  }

  private caminho(mensagemId: string): string {
    const nome = createHash('sha256').update(mensagemId).digest('hex').slice(0, 24);
    return join(this.pasta, 'guardadas', `${nome}.json`);
  }
}

/** Alerta padrão: escreve no console (stderr). */
export class AlertaConsole implements Alerta {
  constructor(private readonly saida: (linha: string) => void = (l) => console.error(l)) {}

  async enviar(aviso: { mensagemId: string; motivo: string }): Promise<void> {
    this.saida(`[ALERTA] mensagem ${aviso.mensagemId} não virou tarefa e foi guardada: ${aviso.motivo}`);
  }
}

/** Registro de ids já processados (base da idempotência). */
export class RegistroArquivo implements Registro {
  private readonly arquivo: ArquivoJson<Record<string, Resultado>>;

  constructor(pasta: string) {
    this.arquivo = new ArquivoJson<Record<string, Resultado>>(
      join(pasta, 'registro.json'),
      () => ({}),
    );
  }

  async obter(mensagemId: string): Promise<Resultado | undefined> {
    const todos = await this.arquivo.ler();
    return Object.hasOwn(todos, mensagemId) ? todos[mensagemId] : undefined;
  }

  gravar(resultado: Resultado): Promise<void> {
    return this.arquivo.atualizar((todos) => ({
      novo: { ...todos, [resultado.mensagemId]: resultado },
      retorno: undefined,
    }));
  }
}
