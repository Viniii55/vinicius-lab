import nodemailer from 'nodemailer';
import type { Alerta } from '../tipos.js';

export interface Transporte {
  sendMail(mensagem: { from: string; to: string; subject: string; text: string }): Promise<unknown>;
}

/** Alerta por e-mail via SMTP. O transporte é injetável (os testes não abrem conexão). */
export class AlertaSmtp implements Alerta {
  constructor(
    private readonly transporte: Transporte,
    private readonly de: string,
    private readonly para: string,
  ) {}

  static criar(o: {
    host: string;
    porta: number;
    usuario?: string;
    senha?: string;
    de: string;
    para: string;
  }): AlertaSmtp {
    const transporte = nodemailer.createTransport({
      host: o.host,
      port: o.porta,
      secure: o.porta === 465,
      ...(o.usuario !== undefined && o.senha !== undefined
        ? { auth: { user: o.usuario, pass: o.senha } }
        : {}),
    });
    return new AlertaSmtp(transporte, o.de, o.para);
  }

  async enviar(aviso: { mensagemId: string; motivo: string }): Promise<void> {
    await this.transporte.sendMail({
      from: this.de,
      to: this.para,
      subject: `[robo-suporte] mensagem ${aviso.mensagemId} não virou tarefa`,
      text: [
        'A mensagem abaixo não pôde virar tarefa e foi guardada. Alguém precisa olhar.',
        '',
        `ID: ${aviso.mensagemId}`,
        `Motivo: ${aviso.motivo}`,
      ].join('\n'),
    });
  }
}
