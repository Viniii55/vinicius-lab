import { describe, expect, it } from 'vitest';
import { FalhaDeEntrega } from '../src/pipeline.js';
import {
  jsonInvalido,
  modelo,
  montar,
  naoResponde,
  ok,
  quebrado,
  saidaValida,
  texto,
} from './ajudas.js';
import type { ModeloIA } from '../src/tipos.js';

type Cenario = {
  nome: string;
  modelos: () => ModeloIA[];
  destinoFalha?: boolean;
  esperado: 'tarefa_criada' | 'guardada_com_alerta';
};

const cenarios: Cenario[] = [
  { nome: '1º modelo ok', modelos: () => [ok('a'), ok('b')], esperado: 'tarefa_criada' },
  { nome: '1º falha, 2º ok', modelos: () => [quebrado('a'), ok('b')], esperado: 'tarefa_criada' },
  {
    nome: 'os dois falham',
    modelos: () => [quebrado('a'), quebrado('b')],
    esperado: 'guardada_com_alerta',
  },
  {
    nome: 'timeout no 1º, 2º ok',
    modelos: () => [naoResponde('a'), ok('b')],
    esperado: 'tarefa_criada',
  },
  {
    nome: 'timeout nos dois',
    modelos: () => [naoResponde('a'), naoResponde('b')],
    esperado: 'guardada_com_alerta',
  },
  {
    nome: 'schema inválido no 1º, 2º ok',
    modelos: () => [jsonInvalido('a'), ok('b')],
    esperado: 'tarefa_criada',
  },
  {
    nome: 'schema inválido nos dois',
    modelos: () => [jsonInvalido('a'), jsonInvalido('b')],
    esperado: 'guardada_com_alerta',
  },
  {
    nome: 'IA ok, mas o destino falha',
    modelos: () => [ok('a')],
    destinoFalha: true,
    esperado: 'guardada_com_alerta',
  },
  { nome: 'nenhum modelo configurado', modelos: () => [], esperado: 'guardada_com_alerta' },
];

describe('invariante: toda mensagem aceita termina em (a) OU (b), nunca nos dois, nunca em nenhum', () => {
  it.each(cenarios)('$nome', async (c) => {
    const { pipeline, destino, guarda, alerta } = montar(c.modelos());
    destino.falhar = c.destinoFalha ?? false;

    const r = await pipeline.tratar(texto('m1'));

    const tarefas = destino.tarefas.size;
    const guardadas = guarda.mensagens.size;
    const alertas = alerta.avisos.length;

    expect(r.estado).toBe(c.esperado);
    // exatamente um destino final
    expect(tarefas + guardadas).toBe(1);
    if (c.esperado === 'tarefa_criada') {
      expect([tarefas, guardadas, alertas]).toEqual([1, 0, 0]);
      expect(destino.tarefas.get('m1')?.mensagemId).toBe('m1');
    } else {
      expect([tarefas, guardadas, alertas]).toEqual([0, 1, 1]);
      // a mensagem original é guardada inteira
      expect(guarda.mensagens.get('m1')?.mensagem).toEqual(texto('m1'));
    }
  });

  it('o id da tarefa vem da mensagem, mesmo que o modelo invente outro', async () => {
    const m = modelo('a', () => ({ ...saidaValida, mensagemId: 'inventado' }));
    const { pipeline, destino } = montar([m]);
    await pipeline.tratar(texto('real'));
    expect([...destino.tarefas.keys()]).toEqual(['real']);
  });

  it('falha ao transcrever/descrever também termina em (b)', async () => {
    const { pipeline, destino, guarda, alerta } = montar([ok('a')]);
    const r = await pipeline.tratar({
      id: 'm2',
      autor: 'op',
      tipo: 'audio',
      url: 'https://exemplo.invalid/nao-existe.ogg',
    });
    expect(r.estado).toBe('guardada_com_alerta');
    expect([destino.tarefas.size, guarda.mensagens.size, alerta.avisos.length]).toEqual([0, 1, 1]);
  });

  it('áudio, imagem e vídeo chegam à tarefa pelo caminho normal', async () => {
    const { pipeline, destino } = montar([ok('a')]);
    await pipeline.tratar({ id: 'a1', autor: 'op', tipo: 'audio', url: 'https://exemplo.invalid/a.ogg' });
    await pipeline.tratar({ id: 'i1', autor: 'op', tipo: 'imagem', url: 'https://exemplo.invalid/f.jpg' });
    await pipeline.tratar({ id: 'v1', autor: 'op', tipo: 'video', url: 'https://exemplo.invalid/v.mp4' });
    expect([...destino.tarefas.keys()].sort()).toEqual(['a1', 'i1', 'v1']);
  });
});

describe('quando o plano B também falha, a mensagem não é aceita (o remetente reenvia)', () => {
  it('guarda indisponível: lança FalhaDeEntrega e não envia alerta nem registra', async () => {
    const { pipeline, guarda, alerta, registro } = montar([quebrado('a')]);
    guarda.falhar = true;
    await expect(pipeline.tratar(texto('m1'))).rejects.toBeInstanceOf(FalhaDeEntrega);
    expect(alerta.avisos).toHaveLength(0);
    expect(registro.resultados.size).toBe(0);
  });

  it('alerta indisponível: lança, e a reentrega completa o plano B sem duplicar nada', async () => {
    const { pipeline, guarda, alerta } = montar([quebrado('a')]);
    alerta.falhar = true;
    await expect(pipeline.tratar(texto('m1'))).rejects.toBeInstanceOf(FalhaDeEntrega);
    alerta.falhar = false;
    const r = await pipeline.tratar(texto('m1'));
    expect(r.estado).toBe('guardada_com_alerta');
    expect(guarda.mensagens.size).toBe(1);
    expect(alerta.avisos).toHaveLength(1);
  });

  it('reentrega depois de falha parcial que agora dá certo: tarefa criada e cópia guardada descartada', async () => {
    let chamadas = 0;
    const m = modelo('a', () => {
      if (chamadas++ === 0) throw new Error('fora do ar');
      return saidaValida;
    });
    const { pipeline, destino, guarda, alerta } = montar([m]);
    alerta.falhar = true;
    await expect(pipeline.tratar(texto('m1'))).rejects.toBeInstanceOf(FalhaDeEntrega);
    expect(guarda.mensagens.size).toBe(1); // guardou, mas o alerta caiu

    const r = await pipeline.tratar(texto('m1'));
    expect(r.estado).toBe('tarefa_criada');
    expect(destino.tarefas.size).toBe(1);
    expect(guarda.mensagens.size).toBe(0); // nunca nos dois
  });
});

describe('idempotência: mesmo id duas vezes gera uma tarefa só', () => {
  it('envio duplicado em sequência', async () => {
    const m = ok('a');
    const { pipeline, destino } = montar([m]);
    const r1 = await pipeline.tratar(texto('dup'));
    const r2 = await pipeline.tratar(texto('dup'));
    expect(destino.tarefas.size).toBe(1);
    expect(m.chamadas).toBe(1); // a segunda não gastou IA
    expect(r2).toEqual(r1);
  });

  it('envio duplicado ao mesmo tempo', async () => {
    const m = ok('a');
    const { pipeline, destino } = montar([m]);
    const [r1, r2] = await Promise.all([
      pipeline.tratar(texto('dup')),
      pipeline.tratar(texto('dup')),
    ]);
    expect(destino.tarefas.size).toBe(1);
    expect(m.chamadas).toBe(1);
    expect(r2).toEqual(r1);
  });

  it('duplicada de uma mensagem que terminou em (b) não gera segundo alerta', async () => {
    const { pipeline, guarda, alerta } = montar([quebrado('a')]);
    await pipeline.tratar(texto('dup'));
    await pipeline.tratar(texto('dup'));
    expect(guarda.mensagens.size).toBe(1);
    expect(alerta.avisos).toHaveLength(1);
  });

  it('ids diferentes geram tarefas diferentes', async () => {
    const { pipeline, destino } = montar([ok('a')]);
    await pipeline.tratar(texto('x'));
    await pipeline.tratar(texto('y'));
    expect(destino.tarefas.size).toBe(2);
  });
});
