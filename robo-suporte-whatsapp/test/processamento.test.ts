import { describe, expect, it, vi } from 'vitest';
import { processar } from '../src/processamento.js';
import type { Processadores } from '../src/processamento.js';

function espioes() {
  const p = {
    transcritor: { transcrever: vi.fn(async () => 'transcrito') },
    visao: { descrever: vi.fn(async (i: string) => `viu ${i}`) },
    extratorQuadros: {
      extrair: vi.fn(async (_v: string, n: number) =>
        Array.from({ length: n }, (_, i) => `q${i + 1}`),
      ),
    },
  } satisfies Processadores;
  return p;
}

const cab = { id: 'm1', autor: 'op' };

describe('roteamento por tipo', () => {
  it('texto vai direto, sem tocar em nenhum processador', async () => {
    const p = espioes();
    const r = await processar({ ...cab, tipo: 'texto', conteudo: 'oi' }, p);
    expect(r.texto).toBe('oi');
    expect(p.transcritor.transcrever).not.toHaveBeenCalled();
    expect(p.visao.descrever).not.toHaveBeenCalled();
    expect(p.extratorQuadros.extrair).not.toHaveBeenCalled();
  });

  it('áudio passa pelo Transcritor', async () => {
    const p = espioes();
    const r = await processar({ ...cab, tipo: 'audio', url: 'u.ogg' }, p);
    expect(p.transcritor.transcrever).toHaveBeenCalledWith('u.ogg');
    expect(p.visao.descrever).not.toHaveBeenCalled();
    expect(r.texto).toContain('transcrito');
  });

  it('imagem passa pela Visão', async () => {
    const p = espioes();
    const r = await processar({ ...cab, tipo: 'imagem', url: 'f.jpg', legenda: 'olha isso' }, p);
    expect(p.visao.descrever).toHaveBeenCalledWith('f.jpg');
    expect(p.transcritor.transcrever).not.toHaveBeenCalled();
    expect(r.texto).toBe('olha isso\nDescrição da imagem: viu f.jpg');
  });

  it('vídeo extrai quadros e lê cada um com a Visão', async () => {
    const p = espioes();
    const r = await processar({ ...cab, tipo: 'video', url: 'v.mp4' }, p);
    expect(p.extratorQuadros.extrair).toHaveBeenCalledWith('v.mp4', 3);
    expect(p.visao.descrever).toHaveBeenCalledTimes(3);
    expect(r.texto).toContain('Quadro 3: viu q3');
  });

  it('vídeo sem nenhum quadro é erro, não texto vazio', async () => {
    const p = espioes();
    p.extratorQuadros.extrair.mockResolvedValueOnce([]);
    await expect(processar({ ...cab, tipo: 'video', url: 'v.mp4' }, p)).rejects.toThrow(/quadro/);
  });
});
