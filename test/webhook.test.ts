import { describe, expect, it } from 'vitest';
import { criarApp } from '../src/webhook.js';
import { montar, ok, quebrado } from './ajudas.js';

const valido = { id: 'w1', autor: 'operador-01', tipo: 'texto', conteudo: 'A esteira parou' };

describe('POST /webhook/mensagem', () => {
  it('aceita payload válido e devolve 200 com o estado', async () => {
    const { pipeline, destino } = montar([ok('a')]);
    const app = criarApp({ pipeline });
    const r = await app.inject({ method: 'POST', url: '/webhook/mensagem', payload: valido });
    expect(r.statusCode).toBe(200);
    expect(r.json().estado).toBe('tarefa_criada');
    expect(destino.tarefas.size).toBe(1);
  });

  it.each([
    ['sem id', { autor: 'x', tipo: 'texto', conteudo: 'a' }],
    ['tipo desconhecido', { id: '1', autor: 'x', tipo: 'gif', conteudo: 'a' }],
    ['texto sem conteudo', { id: '1', autor: 'x', tipo: 'texto' }],
    ['áudio sem url', { id: '1', autor: 'x', tipo: 'audio' }],
    ['corpo vazio', {}],
  ])('devolve 400 para payload inválido: %s', async (_nome, payload) => {
    const { pipeline, destino, guarda } = montar([ok('a')]);
    const app = criarApp({ pipeline });
    const r = await app.inject({ method: 'POST', url: '/webhook/mensagem', payload });
    expect(r.statusCode).toBe(400);
    expect(r.json().erro).toBe('payload inválido');
    // payload inválido não é mensagem aceita: nada é processado
    expect(destino.tarefas.size + guarda.mensagens.size).toBe(0);
  });

  it('devolve 200 também quando a IA falha: a mensagem foi guardada e o alerta saiu', async () => {
    const { pipeline, guarda, alerta } = montar([quebrado('a')]);
    const app = criarApp({ pipeline });
    const r = await app.inject({ method: 'POST', url: '/webhook/mensagem', payload: valido });
    expect(r.statusCode).toBe(200);
    expect(r.json().estado).toBe('guardada_com_alerta');
    expect([guarda.mensagens.size, alerta.avisos.length]).toEqual([1, 1]);
  });

  it('devolve 500 quando nem guardar funciona, para o remetente reenviar', async () => {
    const { pipeline, guarda } = montar([quebrado('a')]);
    guarda.falhar = true;
    const app = criarApp({ pipeline });
    const r = await app.inject({ method: 'POST', url: '/webhook/mensagem', payload: valido });
    expect(r.statusCode).toBe(500);
  });

  it('exige o token quando configurado', async () => {
    const { pipeline } = montar([ok('a')]);
    const app = criarApp({ pipeline, token: 'segredo-de-teste' });
    const sem = await app.inject({ method: 'POST', url: '/webhook/mensagem', payload: valido });
    const errado = await app.inject({
      method: 'POST',
      url: '/webhook/mensagem',
      payload: valido,
      headers: { 'x-webhook-token': 'outro' },
    });
    const certo = await app.inject({
      method: 'POST',
      url: '/webhook/mensagem',
      payload: valido,
      headers: { 'x-webhook-token': 'segredo-de-teste' },
    });
    expect([sem.statusCode, errado.statusCode, certo.statusCode]).toEqual([401, 401, 200]);
  });

  it('envio duplicado pelo HTTP gera uma tarefa só', async () => {
    const { pipeline, destino } = montar([ok('a')]);
    const app = criarApp({ pipeline });
    await app.inject({ method: 'POST', url: '/webhook/mensagem', payload: valido });
    await app.inject({ method: 'POST', url: '/webhook/mensagem', payload: valido });
    expect(destino.tarefas.size).toBe(1);
  });
});
