import { execFile } from 'node:child_process';
import { mkdtemp, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import type { ExtratorQuadros } from '../tipos.js';

const executarPadrao = promisify(execFile);
type Executar = (comando: string, args: string[]) => Promise<unknown>;

/**
 * Extrai um quadro a cada 2 segundos, até `quantidade`, com o ffmpeg instalado na máquina.
 * Os arquivos ficam numa pasta temporária do sistema.
 */
export class ExtratorQuadrosFfmpeg implements ExtratorQuadros {
  constructor(private readonly executar: Executar = executarPadrao) {}

  async extrair(video: string, quantidade: number): Promise<string[]> {
    const pasta = await mkdtemp(join(tmpdir(), 'quadros-'));
    const saida = join(pasta, 'quadro-%02d.jpg');
    await this.executar('ffmpeg', [
      '-hide_banner',
      '-loglevel', 'error',
      '-i', video,
      '-vf', 'fps=1/2',
      '-frames:v', String(quantidade),
      saida,
    ]);
    // Vídeo curto gera menos quadros que o pedido: vale o que existe de fato na pasta.
    const gerados = (await readdir(pasta)).filter((f) => f.endsWith('.jpg')).sort();
    return gerados.map((f) => join(pasta, f));
  }
}
