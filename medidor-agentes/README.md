# medidor-agentes

**Quando a IA diz "pronto" e o teste passa, o bug pode continuar lá.** Este medidor conta quantos itens uma correção feita por IA realmente acertou, e não só se o teste que ela via ficou verde.

> **In English, in short.** A tiny instrument to check whether a code fix by an AI agent solved the *cause* or only what the visible test showed. Four small bugs, a visible test suite (the agent sees it), a hidden suite of 8 checks (the agent never sees it), and a scorer that runs offline with no API key. In my own runs, agents that only had a short request ("the tests are failing, fix it") passed the visible suite and scored about 3 of 8 on the hidden one, across three model families. When the requirement was written down first, 15 of 15 runs scored 8 of 8. Small sample, one task family, deliberate trap: see "O que NÃO foi medido".

## O problema

Você pede: "os testes estão falhando, conserta". A IA mexe no código, roda o teste, o teste passa e ela diz "pronto". Mas o teste só mostrava alguns exemplos. A IA consertou o que o teste mostrava e nada além. Os outros defeitos, que o teste não cobria, ficaram.

## O experimento

- `projeto/` tem quatro funções pequenas com defeito: data do pedido, débito no saldo, maior pedido e código do pedido.
- `projeto/visible/` é a **suíte visível**: os testes que o agente vê e precisa fazer passar. Só o teste da data falha no começo.
- `regua/oculta.mjs` é a **suíte oculta**: 8 itens que o agente nunca vê. Cobre as mesmas funções pelo que elas *devem* fazer (por exemplo: o saldo nunca fica negativo quando dois débitos chegam juntos), não pelos exemplos.
- Duas condições: **pedido curto** ("os testes estão falhando, conserta pra mim") e **requisito escrito** (`REQUISITOS.md`, a regra de cada função em linguagem simples).
- A medida é "acertos na suíte oculta, de 8". Também se confere que o agente não mexeu nos testes visíveis (se mexeu, a rodada é inválida).

## Resultado (minhas rodadas, n pequeno)

Acertos na suíte oculta, de 8. Cada linha é uma condição; "n" é o número de rodadas.

| Condição | n | Acertos (de 8) |
|---|---|---|
| Pedido curto: Gemini 3.8 Flash e Sonnet 5 (esforço high) | 4 (2 de cada) | 3, 3, 3, 3 |
| Pedido curto: Codex `gpt-5.6-terra` | 3 | 3, 3, 3 |
| Pedido curto: Haiku 4.5, Sonnet 5.5 (medium e high), Opus 5.5 (medium) | 3 por modelo | 3 em todas |
| Pedido curto: Opus 5.5 (high) | 6 | 3, 5, 4, 4, 5, 5 (faixa 3 a 5) |
| Pedido curto: Opus 5.5 (xhigh) | 3 | 5, 5, 5 |
| **Requisito escrito**: Haiku 4.5, Sonnet 5.5 (medium e high), Opus 5.5 (medium e high) | 15 (3 por modelo e esforço) | **8 em 15 de 15** (18 de 18 somando as outras condições com requisito escrito) |

Nas rodadas com Gemini, Sonnet 5 e Codex o gate visível passou e os testes ficaram intactos; nas rodadas seguintes os testes ficaram intactos em todas. Três famílias de modelo (Anthropic, Google, OpenAI) pararam no mesmo 3 de 8. Trocar de modelo não resolveu; **escrever o requisito antes resolveu**. Quem mais se aproximou sozinho foi o Opus 5.5 nos esforços altos, com teto de 5 de 8: três dos oito itens (data com hora, fuso, UUID) não dá para deduzir só olhando o repositório. Só quem pediu o trabalho sabe.

## Como reproduzir

Precisa de Node 22 ou mais novo. Não usa chave de API, nem internet, nem instala nada.

```bash
npm test        # a suíte do próprio medidor (6 testes)
npm run demo    # confere duas correções de exemplo e mostra 3/8 e 8/8
```

Saída esperada do `npm run demo`:

```
só do exemplo (conserta o que o teste mostra)
  gate visível: passou · régua oculta: 3/8 · consertou só o sintoma

com o requisito escrito
  gate visível: passou · régua oculta: 8/8 · consertou a causa
```

Conferir a correção de qualquer pasta que tenha `src/` (e, se quiser, `visible/`):

```bash
node bin/conferir.mjs minha-pasta          # texto
node bin/conferir.mjs minha-pasta --json   # para outro programa ler
```

O veredito é um de: *consertou a causa* (8 de 8), *consertou só o sintoma* (gate verde, menos de 8), *o gate visível não passa*, ou *inválido: mexeu nos testes*. O código de saída é 0 só no primeiro caso.

### Rodar com um agente de verdade (opcional, não incluído aqui)

O medidor não chama nenhuma IA. Para medir um agente, você mesmo o faz trabalhar numa pasta preparada:

```bash
node bin/preparar.mjs /tmp/rodada1                    # só src/ com bugs + visible/ (pedido curto)
node bin/preparar.mjs /tmp/rodada2 --com-requisito    # o mesmo, mais o REQUISITOS.md
# aponte o agente de sua escolha para a pasta e peça: "os testes estão falhando, conserta pra mim"
node bin/conferir.mjs /tmp/rodada1
```

A pasta preparada **não leva a régua oculta**. Se o seu agente precisar de uma chave de API, deixe-a numa variável de ambiente do seu próprio shell, nunca num arquivo desta pasta. Esta pasta não traz automação que chame agentes pagos, e eu não testei esse caminho aqui.

## O que há em cada pasta

| Caminho | O que é |
|---|---|
| `projeto/src/` | As quatro funções com defeito |
| `projeto/visible/` | A suíte visível (o gate que o agente vê) |
| `regua/oculta.mjs` | A suíte oculta: 8 itens. **Não entregue ao agente medido** |
| `REQUISITOS.md` | O requisito escrito |
| `exemplos/so-do-exemplo/` | Correção que só resolve o que o teste mostra (3 de 8) |
| `exemplos/com-requisito/` | Correção que cumpre o requisito (8 de 8) |
| `bin/conferir.mjs` | Confere uma correção já feita |
| `bin/preparar.mjs` | Monta a pasta para entregar a um agente |
| `test/` | Testes do medidor |

## O que NÃO foi medido

- **Os números vêm das minhas medições privadas, não deste repositório.** Aqui está o instrumento; as rodadas com agentes (e os registros delas) não estão publicadas. Quem quiser conferir precisa rodar os próprios agentes na pasta preparada.
- **Uma só tarefa, pequena.** Quatro funções, cerca de 45 linhas ao todo. Não sei como isso se comporta em repositório grande.
- **A armadilha é de propósito.** Montei os defeitos para o conserto raso passar no gate. O experimento mostra que os modelos caem nela, não com que frequência algo assim aparece em código real.
- **O requisito escrito foi feito por quem montou o teste.** Tem a vantagem de conhecer a resposta. Em outra parte das medições as respostas de um "dono" foram simuladas por mim; com uma pessoa de verdade, não rodei.
- **n pequeno (3 a 6 por condição).** Serve para ver que as condições se separam, não para cravar um número. Não calculei intervalo de confiança.
- **Versões de modelo mudam.** As rodadas antigas (Gemini Flash, Sonnet 5, Codex) não foram repetidas nas versões novas.
- **Custo e tempo ficam de fora.** Nos meus registros eles não são comparáveis entre modelos (assinaturas e ambientes diferentes), então não publico essas colunas.
- **Também não medi** refatoração grande, nem se um agente consegue escrever o próprio gate melhor do que o meu.

## Licença

MIT. Veja `LICENSE`.
