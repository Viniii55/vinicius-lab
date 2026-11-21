import type {
  ConteudoProcessado,
  ExtratorQuadros,
  ModeloIA,
  Prioridade,
  Transcritor,
  Visao,
} from '../tipos.js';

/**
 * Modelo falso, determinístico e sem rede. É o padrão da demo: dá para rodar o repositório sem chave.
 * Regras simples por palavra-chave. Não tenta ser inteligente, só previsível.
 */
export class ModeloFake implements ModeloIA {
  constructor(
    readonly nome: string,
    private readonly falharQuando?: RegExp,
  ) {}

  async extrairTarefa(conteudo: ConteudoProcessado): Promise<unknown> {
    if (this.falharQuando?.test(conteudo.texto)) {
      throw new Error(`${this.nome}: falha simulada`);
    }
    const texto = conteudo.texto;
    const primeiraLinha = (texto.split('\n')[0] ?? texto).trim();
    return {
      titulo: resumir(primeiraLinha, 80),
      local: detectarLocal(texto),
      prioridade: detectarPrioridade(texto),
      descricao: `${texto}\n\n(Aviso de ${conteudo.autor}, via ${conteudo.tipo}.)`,
    };
  }
}

const LOCAIS: [RegExp, string][] = [
  [/c[âa]mara fria/i, 'Câmara fria'],
  [/embalagem|embalar/i, 'Linha de embalagem'],
  [/forno/i, 'Forno'],
  [/caldeira/i, 'Casa de caldeiras'],
  [/recebimento|doca/i, 'Recebimento'],
  [/mistura|misturador/i, 'Misturadores'],
];

function detectarLocal(texto: string): string {
  return LOCAIS.find(([re]) => re.test(texto))?.[1] ?? 'Não informado';
}

function detectarPrioridade(texto: string): Prioridade {
  if (/vazamento de (g[áa]s|amônia|amonia)|fogo|inc[êe]ndio|acidente/i.test(texto)) return 'urgente';
  if (/parou|parada|quebr|sem energia|temperatura (alta|acima)/i.test(texto)) return 'alta';
  if (/barulho|ru[íi]do|desgaste|folga|goteira/i.test(texto)) return 'media';
  return 'baixa';
}

function resumir(texto: string, max: number): string {
  return texto.length <= max ? texto : `${texto.slice(0, max - 1).trimEnd()}…`;
}

// ---- Mídia simulada: a "transcrição" e a "descrição" vêm de uma tabela, indexada pela URL ----

export class TranscritorFake implements Transcritor {
  constructor(private readonly textos: Record<string, string>) {}

  async transcrever(url: string): Promise<string> {
    const texto = this.textos[url];
    if (texto === undefined) throw new Error(`áudio sem transcrição simulada: ${url}`);
    return texto;
  }
}

export class VisaoFake implements Visao {
  constructor(private readonly descricoes: Record<string, string>) {}

  async descrever(imagem: string): Promise<string> {
    const texto = this.descricoes[imagem];
    if (texto === undefined) throw new Error(`imagem sem descrição simulada: ${imagem}`);
    return texto;
  }
}

/** Finge extrair quadros: devolve `<video>#quadro1..N`, que a VisaoFake sabe descrever. */
export class ExtratorQuadrosFake implements ExtratorQuadros {
  async extrair(video: string, quantidade: number): Promise<string[]> {
    return Array.from({ length: quantidade }, (_, i) => `${video}#quadro${i + 1}`);
  }
}
