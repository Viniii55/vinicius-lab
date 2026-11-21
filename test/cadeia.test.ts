import { describe, expect, it } from 'vitest';
import { executarCadeia } from '../src/cadeia.js';
import { jsonInvalido, naoResponde, ok, quebrado } from './ajudas.js';

const conteudo = { mensagemId: 'm1', autor: 'op', tipo: 'texto' as const, texto: 'algo' };

describe('cadeia de modelos', () => {
  it('JSON fora do schema conta como falha e passa para o próximo modelo', async () => {
    const a = jsonInvalido('a');
    const b = ok('b');
    const r = await executarCadeia([a, b], conteudo, 50);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.modelo).toBe('b');
      expect(r.falhas).toHaveLength(1);
      expect(r.falhas[0]?.motivo).toMatch(/fora do schema/);
    }
    expect(a.chamadas).toBe(1);
    expect(b.chamadas).toBe(1);
  });

  it('timeout passa para o próximo modelo', async () => {
    const r = await executarCadeia([naoResponde('a'), ok('b')], conteudo, 20);
    expect(r.ok && r.modelo).toBe('b');
  });

  it('não chama o segundo modelo se o primeiro deu certo', async () => {
    const b = ok('b');
    await executarCadeia([ok('a'), b], conteudo, 50);
    expect(b.chamadas).toBe(0);
  });

  it('todos falhando devolve ok:false com o motivo de cada um, sem lançar', async () => {
    const r = await executarCadeia([quebrado('a'), jsonInvalido('b')], conteudo, 50);
    expect(r.ok).toBe(false);
    expect(r.falhas.map((f) => f.modelo)).toEqual(['a', 'b']);
  });

  it('cadeia vazia é falha, não sucesso', async () => {
    const r = await executarCadeia([], conteudo, 50);
    expect(r.ok).toBe(false);
  });
});
