# O que cada função deve fazer

Este é o "requisito escrito". É o que falta no pedido curto "os testes estão falhando, conserta pra mim". Os testes visíveis só mostram exemplos; aqui está a regra por trás deles.

1. **`parseOrderDate` (data do pedido).** Aceita data pura (`2026-01-15`) e também ISO 8601 completo, com hora e fuso: `2026-09-01T12:30:45.000Z` e `2026-09-01T09:30:00-03:00`. O resultado é sempre o instante certo em UTC (o fuso, quando vem, é aplicado).
2. **`debitBalance` (débito no saldo).** O saldo nunca fica negativo, nem quando dois débitos chegam ao mesmo tempo. Se o saldo é 100 e chegam dois débitos de 60, só um é aprovado e o outro falha com `insufficient funds`.
3. **`peakOrderValue` (maior pedido).** Lista vazia devolve `0`, não `-Infinity`. Se todos os pedidos têm total negativo, devolve o maior deles (por exemplo `-20`), sem trocar por `0`.
4. **`isValidOrderId` (código do pedido).** Aceita o formato legado `ORD-` mais 6 ou mais dígitos e também o formato novo, UUID. O legado continua valendo.

Os testes visíveis não podem ser alterados.
