import type {
  ConteudoProcessado,
  ExtratorQuadros,
  MensagemEntrada,
  Transcritor,
  Visao,
} from './tipos.js';

export interface Processadores {
  transcritor: Transcritor;
  visao: Visao;
  extratorQuadros: ExtratorQuadros;
  /** Quantos quadros do vídeo são lidos. Padrão: 3. */
  quadrosPorVideo?: number;
}

/** Roteia a mensagem pelo tipo e devolve só texto para a IA. */
export async function processar(
  msg: MensagemEntrada,
  p: Processadores,
): Promise<ConteudoProcessado> {
  const cabecalho = { mensagemId: msg.id, autor: msg.autor, tipo: msg.tipo };

  switch (msg.tipo) {
    case 'texto':
      return { ...cabecalho, texto: msg.conteudo };

    case 'audio': {
      const transcricao = await p.transcritor.transcrever(msg.url);
      return { ...cabecalho, texto: juntar(msg.legenda, `Transcrição do áudio: ${transcricao}`) };
    }

    case 'imagem': {
      const descricao = await p.visao.descrever(msg.url);
      return { ...cabecalho, texto: juntar(msg.legenda, `Descrição da imagem: ${descricao}`) };
    }

    case 'video': {
      const quadros = await p.extratorQuadros.extrair(msg.url, p.quadrosPorVideo ?? 3);
      if (quadros.length === 0) throw new Error('nenhum quadro extraído do vídeo');
      const descricoes: string[] = [];
      for (const [i, quadro] of quadros.entries()) {
        descricoes.push(`Quadro ${i + 1}: ${await p.visao.descrever(quadro)}`);
      }
      return { ...cabecalho, texto: juntar(msg.legenda, ...descricoes) };
    }
  }
}

function juntar(...partes: (string | undefined)[]): string {
  return partes.filter((p): p is string => !!p && p.trim() !== '').join('\n');
}
