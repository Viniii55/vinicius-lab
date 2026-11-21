import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  AlertaConsole,
  DestinoJson,
  GuardaArquivo,
  RegistroArquivo,
} from '../src/adaptadores/local.js';
import { saidaValida, texto } from './ajudas.js';
import type { Tarefa } from '../src/tipos.js';

let pasta: string;
beforeEach(async () => {
  pasta = await mkdtemp(join(tmpdir(), 'robo-teste-'));
});
afterEach(async () => {
  await rm(pasta, { recursive: true, force: true });
});

const tarefa = (id: string): Tarefa => ({ ...saidaValida, prioridade: 'alta', mensagemId: id });

describe('adaptadores locais', () => {
  it('DestinoJson: mesmo mensagemId não duplica, mesmo em chamadas simultâneas', async () => {
    const d = new DestinoJson(pasta);
    await Promise.all([d.criar(tarefa('a')), d.criar(tarefa('a')), d.criar(tarefa('b'))]);
    const lidas = JSON.parse(await readFile(join(pasta, 'tarefas.json'), 'utf8')) as Tarefa[];
    expect(lidas.map((t) => t.mensagemId).sort()).toEqual(['a', 'b']);
  });

  it('GuardaArquivo: guarda a original, regravar não duplica e descartar remove', async () => {
    const g = new GuardaArquivo(pasta);
    await g.guardar(texto('../../escape'), 'motivo 1');
    await g.guardar(texto('../../escape'), 'motivo 2');
    const arquivos = await readdir(join(pasta, 'guardadas'));
    expect(arquivos).toHaveLength(1); // o id não vira caminho
    const conteudo = JSON.parse(await readFile(join(pasta, 'guardadas', arquivos[0] ?? ''), 'utf8'));
    expect(conteudo.mensagem).toEqual(texto('../../escape'));
    expect(conteudo.motivo).toBe('motivo 2');
    await g.descartar('../../escape');
    expect(await readdir(join(pasta, 'guardadas'))).toHaveLength(0);
    await expect(g.descartar('nunca-guardada')).resolves.toBeUndefined();
  });

  it('RegistroArquivo: persiste o resultado e acha de novo numa instância nova', async () => {
    const r1 = new RegistroArquivo(pasta);
    expect(await r1.obter('x')).toBeUndefined();
    await r1.gravar({ estado: 'guardada_com_alerta', mensagemId: 'x', motivo: 'm' });
    const r2 = new RegistroArquivo(pasta);
    expect((await r2.obter('x'))?.estado).toBe('guardada_com_alerta');
    expect(await r2.obter('constructor')).toBeUndefined();
  });

  it('AlertaConsole escreve o id e o motivo', async () => {
    const linhas: string[] = [];
    await new AlertaConsole((l) => linhas.push(l)).enviar({ mensagemId: 'm9', motivo: 'sem IA' });
    expect(linhas[0]).toContain('m9');
    expect(linhas[0]).toContain('sem IA');
  });
});
