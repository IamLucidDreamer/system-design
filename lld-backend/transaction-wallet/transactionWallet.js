const TRANSACTION_STATUS = Object.freeze({
  PENDING:     'PENDING',
  SUCCESS:     'SUCCESS',
  FAILED:      'FAILED',
  ROLLED_BACK: 'ROLLED_BACK',
});

const ERROR_CODE = Object.freeze({
  WALLET_NOT_FOUND:      'WALLET_NOT_FOUND',
  WALLET_ALREADY_EXISTS: 'WALLET_ALREADY_EXISTS',
  INSUFFICIENT_FUNDS:    'INSUFFICIENT_FUNDS',
  INVALID_AMOUNT:        'INVALID_AMOUNT',
  SELF_TRANSFER:         'SELF_TRANSFER',
  DUPLICATE_TRANSACTION: 'DUPLICATE_TRANSACTION',
});

class WalletError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'WalletError';
    this.code = code;
  }
}

class Mutex {
  #locked = false;
  #queue  = [];

  acquire() {
    return new Promise((resolve) => {
      const tryAcquire = () => {
        if (!this.#locked) {
          this.#locked = true;
          resolve(() => this.#release());
        } else {
          this.#queue.push(tryAcquire);
        }
      };
      tryAcquire();
    });
  }

  #release() {
    this.#locked = false;
    const next = this.#queue.shift();
    if (next) next();
  }
}


class Transaction {
  #id;
  #senderWalletId;
  #receiverWalletId;
  #amount;
  #status;
  #createdAt;
  #idempotencyKey;

  constructor({ id, senderWalletId, receiverWalletId, amount, idempotencyKey = null }) {
    this.#id              = id;
    this.#senderWalletId  = senderWalletId;
    this.#receiverWalletId = receiverWalletId;
    this.#amount          = amount;
    this.#status          = TRANSACTION_STATUS.PENDING;
    this.#createdAt       = new Date();
    this.#idempotencyKey  = idempotencyKey;
  }

  get id()             { return this.#id; }
  get status()         { return this.#status; }
  get idempotencyKey() { return this.#idempotencyKey; }

  _markSuccess()    { this.#status = TRANSACTION_STATUS.SUCCESS; }
  _markFailed()     { this.#status = TRANSACTION_STATUS.FAILED; }
  _markRolledBack() { this.#status = TRANSACTION_STATUS.ROLLED_BACK; }

  toJSON() {
    return {
      id:               this.#id,
      senderWalletId:   this.#senderWalletId,
      receiverWalletId: this.#receiverWalletId,
      amount:           this.#amount,
      status:           this.#status,
      createdAt:        this.#createdAt,
    };
  }
}

class Wallet {
  #id;
  #userId;
  #balance;
  #mutex;

  constructor(id, userId, initialBalance) {
    if (initialBalance < 0) {
      throw new WalletError(ERROR_CODE.INVALID_AMOUNT, 'Initial balance cannot be negative');
    }
    this.#id      = id;
    this.#userId  = userId;
    this.#balance = initialBalance;
    this.#mutex   = new Mutex();
  }

  get id()      { return this.#id; }
  get userId()  { return this.#userId; }
  get balance() { return this.#balance; }
  get mutex()   { return this.#mutex; }

  _debit(amount)  { this.#balance -= amount; }
  _credit(amount) { this.#balance += amount; }

  toJSON() {
    return { id: this.#id, userId: this.#userId, balance: this.#balance };
  }
}

class P2PTransactionService {
  #wallets          = new Map(); 
  #userWalletIndex  = new Map(); 
  #transactions     = new Map(); 
  #idempotencyIndex = new Map(); 
  #txCounter        = 0;
  #walletCounter    = 0;
  createWallet(userId, initialBalance = 0) {
    if (this.#userWalletIndex.has(userId)) {
      throw new WalletError(ERROR_CODE.WALLET_ALREADY_EXISTS, `User ${userId} already has a wallet`);
    }
    const walletId = `W-${++this.#walletCounter}`;
    const wallet   = new Wallet(walletId, userId, initialBalance);
    this.#wallets.set(walletId, wallet);
    this.#userWalletIndex.set(userId, walletId);
    return wallet.toJSON();
  }

  getWallet(userId) {
    return this.#resolveWallet(userId).toJSON();
  }

  getTransactionHistory(userId) {
    const walletId = this.#userWalletIndex.get(userId);
    if (!walletId) throw new WalletError(ERROR_CODE.WALLET_NOT_FOUND, `No wallet for user: ${userId}`);

    return [...this.#transactions.values()]
      .filter(tx => {
        const d = tx.toJSON();
        return d.senderWalletId === walletId || d.receiverWalletId === walletId;
      })
      .map(tx => tx.toJSON());
  }

  async transfer(senderId, receiverId, amount, idempotencyKey = null) {
    this.#validateInputs(senderId, receiverId, amount);

    if (idempotencyKey) {
      const existingId = this.#idempotencyIndex.get(idempotencyKey);
      if (existingId) return this.#transactions.get(existingId).toJSON();
    }

    const sender   = this.#resolveWallet(senderId);
    const receiver = this.#resolveWallet(receiverId);

    const [first, second] = [sender, receiver].sort((a, b) => a.id.localeCompare(b.id));

    const release1 = await first.mutex.acquire();
    const release2 = await second.mutex.acquire();

    const tx = new Transaction({
      id:               `TX-${++this.#txCounter}`,
      senderWalletId:   sender.id,
      receiverWalletId: receiver.id,
      amount,
      idempotencyKey,
    });
    this.#transactions.set(tx.id, tx);

    try {
      if (sender.balance < amount) {
        throw new WalletError(
          ERROR_CODE.INSUFFICIENT_FUNDS,
          `Insufficient funds: available ₹${sender.balance}, requested ₹${amount}`
        );
      }

      sender._debit(amount);

      try {
        receiver._credit(amount);
      } catch (creditErr) {
        sender._credit(amount);
        tx._markRolledBack();
        throw creditErr;
      }

      tx._markSuccess();
      if (idempotencyKey) this.#idempotencyIndex.set(idempotencyKey, tx.id);
      return tx.toJSON();

    } catch (err) {
      if (tx.status === TRANSACTION_STATUS.PENDING) tx._markFailed();
      throw err;
    } finally {
      release2();
      release1();
    }
  }

  #validateInputs(senderId, receiverId, amount) {
    if (senderId === receiverId) {
      throw new WalletError(ERROR_CODE.SELF_TRANSFER, 'Sender and receiver must be different');
    }
    if (typeof amount !== 'number' || !isFinite(amount) || amount <= 0) {
      throw new WalletError(ERROR_CODE.INVALID_AMOUNT, `Amount must be a positive finite number, got: ${amount}`);
    }
  }

  #resolveWallet(userId) {
    const walletId = this.#userWalletIndex.get(userId);
    if (!walletId) throw new WalletError(ERROR_CODE.WALLET_NOT_FOUND, `No wallet found for user: ${userId}`);
    return this.#wallets.get(walletId);
  }
}


// AI generated Tests
// ─────────────────────────────────────────────
//  TEST RUNNER  (async)
// ─────────────────────────────────────────────

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✓  ${name}`);
    passed++;
  } catch (e) {
    console.log(`  ✗  ${name}`);
    console.log(`     → ${e.message}`);
    failed++;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertEqual(actual, expected, label = '') {
  if (actual !== expected) throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

function assertThrows(fn, expectedCode) {
  try { fn(); } catch (e) {
    if (e.code === expectedCode) return;
    throw new Error(`Expected error code ${expectedCode}, got ${e.code}: ${e.message}`);
  }
  throw new Error(`Expected a WalletError(${expectedCode}) but nothing was thrown`);
}

async function assertRejects(fn, expectedCode) {
  try { await fn(); } catch (e) {
    if (e.code === expectedCode) return;
    throw new Error(`Expected error code ${expectedCode}, got ${e.code}: ${e.message}`);
  }
  throw new Error(`Expected a WalletError(${expectedCode}) but nothing was thrown`);
}


// ─────────────────────────────────────────────
//  TESTS
// ─────────────────────────────────────────────

async function runTests() {
  console.log('\n══════════════════════════════════════════');
  console.log('  P2P Transaction Service — Test Suite');
  console.log('══════════════════════════════════════════\n');

  // ── Wallet creation ─────────────────────────────────────────────────

  console.log('── Wallet Creation ──');

  await test('creates wallet with correct balance', () => {
    const svc = new P2PTransactionService();
    const w = svc.createWallet('alice', 5000);
    assertEqual(w.balance, 5000, 'balance');
  });

  await test('rejects duplicate wallet for same user', () => {
    const svc = new P2PTransactionService();
    svc.createWallet('alice', 1000);
    assertThrows(() => svc.createWallet('alice', 500), ERROR_CODE.WALLET_ALREADY_EXISTS);
  });

  await test('rejects negative initial balance', () => {
    const svc = new P2PTransactionService();
    assertThrows(() => svc.createWallet('alice', -100), ERROR_CODE.INVALID_AMOUNT);
  });

  await test('getWallet returns current snapshot', () => {
    const svc = new P2PTransactionService();
    svc.createWallet('alice', 3000);
    assertEqual(svc.getWallet('alice').balance, 3000, 'balance');
  });

  await test('getWallet throws for unknown user', () => {
    const svc = new P2PTransactionService();
    assertThrows(() => svc.getWallet('ghost'), ERROR_CODE.WALLET_NOT_FOUND);
  });

  // ── Input validation ────────────────────────────────────────────────

  console.log('\n── Input Validation ──');

  await test('rejects self-transfer', async () => {
    const svc = new P2PTransactionService();
    svc.createWallet('alice', 5000);
    await assertRejects(() => svc.transfer('alice', 'alice', 100), ERROR_CODE.SELF_TRANSFER);
  });

  await test('rejects zero amount', async () => {
    const svc = new P2PTransactionService();
    svc.createWallet('alice', 5000); svc.createWallet('bob', 500);
    await assertRejects(() => svc.transfer('alice', 'bob', 0), ERROR_CODE.INVALID_AMOUNT);
  });

  await test('rejects negative amount', async () => {
    const svc = new P2PTransactionService();
    svc.createWallet('alice', 5000); svc.createWallet('bob', 500);
    await assertRejects(() => svc.transfer('alice', 'bob', -50), ERROR_CODE.INVALID_AMOUNT);
  });

  await test('rejects non-finite amount', async () => {
    const svc = new P2PTransactionService();
    svc.createWallet('alice', 5000); svc.createWallet('bob', 500);
    await assertRejects(() => svc.transfer('alice', 'bob', Infinity), ERROR_CODE.INVALID_AMOUNT);
  });

  await test('rejects transfer for unknown sender', async () => {
    const svc = new P2PTransactionService();
    svc.createWallet('bob', 500);
    await assertRejects(() => svc.transfer('ghost', 'bob', 100), ERROR_CODE.WALLET_NOT_FOUND);
  });

  await test('rejects transfer for unknown receiver', async () => {
    const svc = new P2PTransactionService();
    svc.createWallet('alice', 5000);
    await assertRejects(() => svc.transfer('alice', 'ghost', 100), ERROR_CODE.WALLET_NOT_FOUND);
  });

  // ── Happy path ──────────────────────────────────────────────────────

  console.log('\n── Happy Path ──');

  await test('transfer updates both balances correctly', async () => {
    const svc = new P2PTransactionService();
    svc.createWallet('alice', 5000); svc.createWallet('bob', 500);
    const tx = await svc.transfer('alice', 'bob', 1000);
    assertEqual(tx.status, TRANSACTION_STATUS.SUCCESS, 'tx status');
    assertEqual(svc.getWallet('alice').balance, 4000, 'sender balance');
    assertEqual(svc.getWallet('bob').balance, 1500, 'receiver balance');
  });

  await test('transfer with exact balance succeeds', async () => {
    const svc = new P2PTransactionService();
    svc.createWallet('alice', 1000); svc.createWallet('bob', 0);
    await svc.transfer('alice', 'bob', 1000);
    assertEqual(svc.getWallet('alice').balance, 0, 'sender drained');
    assertEqual(svc.getWallet('bob').balance, 1000, 'receiver credited');
  });

  await test('transfer fails when balance is insufficient', async () => {
    const svc = new P2PTransactionService();
    svc.createWallet('alice', 200); svc.createWallet('bob', 500);
    await assertRejects(() => svc.transfer('alice', 'bob', 500), ERROR_CODE.INSUFFICIENT_FUNDS);
    // Balances must be untouched
    assertEqual(svc.getWallet('alice').balance, 200, 'sender unchanged');
    assertEqual(svc.getWallet('bob').balance, 500, 'receiver unchanged');
  });

  // ── Transaction history ─────────────────────────────────────────────

  console.log('\n── Transaction History ──');

  await test('history includes transactions as sender and receiver', async () => {
    const svc = new P2PTransactionService();
    svc.createWallet('alice', 5000); svc.createWallet('bob', 1000); svc.createWallet('carol', 500);
    await svc.transfer('alice', 'bob', 500);
    await svc.transfer('carol', 'alice', 200);
    const history = svc.getTransactionHistory('alice');
    assertEqual(history.length, 2, 'history length');
  });

  await test('history is empty for user with no transactions', () => {
    const svc = new P2PTransactionService();
    svc.createWallet('alice', 5000);
    assertEqual(svc.getTransactionHistory('alice').length, 0, 'empty history');
  });

  // ── Idempotency ─────────────────────────────────────────────────────

  console.log('\n── Idempotency ──');

  await test('duplicate idempotency key returns original tx without re-executing', async () => {
    const svc = new P2PTransactionService();
    svc.createWallet('alice', 5000); svc.createWallet('bob', 500);
    const key = 'pay-bob-001';
    const tx1 = await svc.transfer('alice', 'bob', 1000, key);
    const tx2 = await svc.transfer('alice', 'bob', 1000, key);
    assertEqual(tx1.id, tx2.id, 'same transaction returned');
    // Money moved only once
    assertEqual(svc.getWallet('alice').balance, 4000, 'sender debited once');
    assertEqual(svc.getWallet('bob').balance, 1500, 'receiver credited once');
  });

  // ── Concurrency ─────────────────────────────────────────────────────

  console.log('\n── Concurrency ──');

  await test('concurrent transfers on the same sender — only one wins if funds are tight', async () => {
    const svc = new P2PTransactionService();
    svc.createWallet('alice', 1000); svc.createWallet('bob', 0); svc.createWallet('carol', 0);

    const results = await Promise.allSettled([
      svc.transfer('alice', 'bob',   1000), // tries to send everything to bob
      svc.transfer('alice', 'carol', 1000), // tries to send everything to carol simultaneously
    ]);

    const successes = results.filter(r => r.status === 'fulfilled');
    const failures  = results.filter(r => r.status === 'rejected');
    assertEqual(successes.length, 1, 'exactly one transfer succeeds');
    assertEqual(failures.length,  1, 'exactly one transfer fails');
    // Total money in the system must be conserved
    const total = svc.getWallet('alice').balance +
                  svc.getWallet('bob').balance   +
                  svc.getWallet('carol').balance;
    assertEqual(total, 1000, 'money conserved');
  });

  await test('concurrent opposite transfers (A→B and B→A) complete without deadlock', async () => {
    const svc = new P2PTransactionService();
    svc.createWallet('alice', 2000); svc.createWallet('bob', 2000);

    await Promise.all([
      svc.transfer('alice', 'bob', 500),
      svc.transfer('bob', 'alice', 500),
    ]);

    // Net effect should be zero — balances back to 2000 each
    assertEqual(svc.getWallet('alice').balance, 2000, 'alice balance');
    assertEqual(svc.getWallet('bob').balance, 2000, 'bob balance');
  });

  // ── Summary ─────────────────────────────────────────────────────────

  console.log(`\n──────────────────────────────────────────`);
  console.log(`  ${passed} passed  |  ${failed} failed`);
  console.log(`──────────────────────────────────────────\n`);
}

runTests();
