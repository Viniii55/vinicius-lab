const balances = new Map();

export function setBalance(accountId, amount) {
  balances.set(accountId, amount);
}

export function getBalance(accountId) {
  return balances.get(accountId) ?? 0;
}

function readBalance(accountId) {
  return Promise.resolve(balances.get(accountId) ?? 0);
}

function settle() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

export async function debitBalance(accountId, amount) {
  const current = await readBalance(accountId);
  if (current < amount) {
    throw new Error(`insufficient funds for account ${accountId}`);
  }
  await settle();
  const latest = balances.get(accountId) ?? 0;
  balances.set(accountId, latest - amount);
  return latest - amount;
}
