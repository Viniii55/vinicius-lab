import { AlertaMemoria, DestinoMemoria, GuardaMemoria, RegistroMemoria } from '../src/adaptadores/memoria.js';
import { ExtratorQuadrosFake, TranscritorFake, VisaoFake } from '../src/adaptadores/fake.js';
import { Pipeline } from '../src/pipeline.js';
import type { ConteudoProcessado, MensagemEntrada, ModeloIA } from '../src/tipos.js';

export const saidaValida = {
  titulo: 'Esteira parada na embalagem',
  local: 'Linha de embalagem',
  prioridade: 'alta',
  descricao: 'A esteira 2 parou durante o turno.',
};

/** Modelo de teste: `agir` devolve o que a ferramenta forçada devolveria, ou lança/pendura. */
export function modelo(
  nome: string,
  agir: (c: ConteudoProcessado) => Promise<unknown> | unknown,
): ModeloIA & { chamadas: number } {
  const m = {
    nome,
    chamadas: 0,
    async extrairTarefa(c: ConteudoProcessado) {
      m.chamadas++;
      return agir(c);
    },
  };
  return m;
}

export const ok = (nome: string) => modelo(nome, () => saidaValida);
export const quebrado = (nome: string) =>
  modelo(nome, () => {
    throw new Error('503 do provedor');
  });
export const jsonInvalido = (nome: string) =>
  modelo(nome, () => ({ titulo: 'x', prioridade: 'critica' }));
export const naoResponde = (nome: string) => modelo(nome, () => new Promise<never>(() => undefined));

export const texto = (id: string, conteudo = 'A esteira da embalagem parou'): MensagemEntrada => ({
  id,
  autor: 'operador-01',
  tipo: 'texto',
  conteudo,
});

export function montar(modelos: ModeloIA[], extras: { timeoutModeloMs?: number } = {}) {
  const destino = new DestinoMemoria();
  const guarda = new GuardaMemoria();
  const alerta = new AlertaMemoria();
  const registro = new RegistroMemoria();
  const pipeline = new Pipeline({
    processadores: {
      transcritor: new TranscritorFake({ 'https://exemplo.invalid/a.ogg': 'o forno parou' }),
      visao: new VisaoFake({
        'https://exemplo.invalid/f.jpg': 'vazamento no chão',
        'https://exemplo.invalid/v.mp4#quadro1': 'quadro um',
        'https://exemplo.invalid/v.mp4#quadro2': 'quadro dois',
        'https://exemplo.invalid/v.mp4#quadro3': 'quadro três',
      }),
      extratorQuadros: new ExtratorQuadrosFake(),
    },
    modelos,
    destino,
    guarda,
    alerta,
    registro,
    timeoutModeloMs: extras.timeoutModeloMs ?? 50,
  });
  return { pipeline, destino, guarda, alerta, registro };
}
