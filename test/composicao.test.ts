import { describe, expect, it } from 'vitest';
import { ModeloFake } from '../src/adaptadores/fake.js';
import { montarDoAmbiente } from '../src/composicao.js';
import { SaidaModelo } from '../src/tipos.js';

describe('montarDoAmbiente', () => {
  it('sem nenhuma variável, monta com o modelo falso e avisa', () => {
    const m = montarDoAmbiente({ PASTA_DADOS: 'dados/teste' });
    expect(m.porta).toBe(3000);
    expect(m.avisos.join(' ')).toMatch(/modelo falso/);
  });

  it('variável vazia (como no .env.example) conta como ausente', () => {
    const m = montarDoAmbiente({ CADEIA_MODELOS: '', DESTINO: '', ALERTA: '', PORTA: '' });
    expect(m.porta).toBe(3000);
  });

  it('falha cedo com provedor desconhecido', () => {
    expect(() => montarDoAmbiente({ CADEIA_MODELOS: 'outro:x' })).toThrow(/desconhecido/);
  });

  it('falha cedo quando falta a credencial do provedor da cadeia', () => {
    expect(() => montarDoAmbiente({ CADEIA_MODELOS: 'anthropic:x' })).toThrow(/ANTHROPIC_API_KEY/);
  });

  it('falha cedo com item mal formado', () => {
    expect(() => montarDoAmbiente({ CADEIA_MODELOS: 'semdoispontos' })).toThrow(/provedor:modelo/);
  });
});

describe('ModeloFake', () => {
  it('é determinístico e sempre devolve algo que passa no schema', async () => {
    const c = { mensagemId: 'm', autor: 'op', tipo: 'texto' as const, texto: 'Forno parou de aquecer' };
    const a = await new ModeloFake('f').extrairTarefa(c);
    const b = await new ModeloFake('f').extrairTarefa(c);
    expect(a).toEqual(b);
    expect(SaidaModelo.safeParse(a).success).toBe(true);
  });
});
