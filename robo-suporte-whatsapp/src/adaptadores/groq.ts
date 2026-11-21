import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import type { Transcritor } from '../tipos.js';
import { cabecalhoAutorizacao, exigirOk } from './http.js';
import type { FetchFn } from './http.js';

/** Transcrição com Whisper hospedado na Groq (API compatível com a de transcrição da OpenAI). */
export class TranscritorGroq implements Transcritor {
  private readonly http: FetchFn;

  constructor(
    private readonly o: { chave: string; modelo: string; fetch?: FetchFn },
  ) {
    this.http = o.fetch ?? fetch;
  }

  async transcrever(url: string): Promise<string> {
    const { bytes, nome } = await this.obterAudio(url);
    const form = new FormData();
    form.append('file', new Blob([bytes]), nome);
    form.append('model', this.o.modelo);
    form.append('language', 'pt');
    form.append('response_format', 'json');

    const resposta = await this.http('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { authorization: cabecalhoAutorizacao('Bearer', this.o.chave) },
      body: form,
    });
    const corpo = (await (await exigirOk(resposta, 'groq')).json()) as { text?: string };
    const texto = corpo.text?.trim();
    if (!texto) throw new Error('groq: transcrição vazia');
    return texto;
  }

  private async obterAudio(origem: string): Promise<{ bytes: Uint8Array; nome: string }> {
    if (/^https?:\/\//i.test(origem)) {
      const r = await exigirOk(await this.http(origem), 'download do áudio');
      const nome = basename(new URL(origem).pathname) || 'audio.ogg';
      return { bytes: new Uint8Array(await r.arrayBuffer()), nome };
    }
    return { bytes: await readFile(origem), nome: basename(origem) };
  }
}
