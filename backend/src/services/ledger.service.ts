import { Prisma } from "@prisma/client";
import type { TransactionType, TransactionStatus, WalletKind } from "../constants/schemaEnums.js";
import { prisma } from "../lib/prisma.js";
import { newReference } from "../utils/refs.js";
import { Decimal } from "@prisma/client/runtime/library";

export class InsufficientFundsError extends Error {
  constructor() {
    super("INSUFFICIENT_FUNDS");
    this.name = "InsufficientFundsError";
  }
}

function d(n: string | number | Decimal): Decimal {
  return n instanceof Decimal ? n : new Decimal(n.toString());
}

export async function getOrCreateWallet(
  userId: string,
  kind: WalletKind,
  currencyCode: string,
) {
  return prisma.walletAccount.upsert({
    where: {
      userId_kind_currencyCode: { userId, kind, currencyCode },
    },
    create: { userId, kind, currencyCode },
    update: {},
  });
}

type LedgerOp = {
  userId: string;
  kind: WalletKind;
  currencyCode: string;
  amount: Decimal;
  type: string;
  referenceType: string;
  referenceId: string;
  metadata?: Prisma.JsonValue;
};

/**
 * Apply a signed amount to available balance and write ledger + transaction row.
 * amount > 0 credit, amount < 0 debit.
 * Use inside an existing interactive transaction when composing with other writes.
 */
export async function applyBalanceChangeTx(
  db: Prisma.TransactionClient,
  op: LedgerOp,
  txType: TransactionType,
  txStatus: TransactionStatus = "SUCCESS",
  options?: { transactionReferenceId?: string },
): Promise<void> {
  const { userId, kind, currencyCode, amount, type, referenceType, referenceId, metadata } = op;
  const account = await db.walletAccount.findUnique({
    where: { userId_kind_currencyCode: { userId, kind, currencyCode } },
  });
  if (!account) {
    if (amount.lessThan(0)) throw new InsufficientFundsError();
    await db.walletAccount.create({
      data: {
        userId,
        kind,
        currencyCode,
        balance: amount,
        lockedBalance: new Decimal(0),
      },
    });
    const created = await db.walletAccount.findUniqueOrThrow({
      where: { userId_kind_currencyCode: { userId, kind, currencyCode } },
    });
    await db.ledgerEntry.create({
      data: {
        accountId: created.id,
        userId,
        amount,
        balanceAfter: amount,
        type,
        referenceType,
        referenceId,
        metadata: metadata ?? undefined,
      },
    });
    await db.transaction.create({
      data: {
        referenceId: options?.transactionReferenceId ?? newReference("TX"),
        userId,
        type: txType,
        status: txStatus,
        amount: amount.abs(),
        currency: currencyCode,
        metadata: {
          direction: amount.greaterThan(0) ? "in" : "out",
          ledgerType: type,
          referenceType,
          referenceId,
        } as Prisma.InputJsonValue,
      },
    });
    return;
  }

  const next = account.balance.add(amount);
  if (next.lessThan(0)) throw new InsufficientFundsError();

  await db.walletAccount.update({
    where: { id: account.id },
    data: { balance: next },
  });
  await db.ledgerEntry.create({
    data: {
      accountId: account.id,
      userId,
      amount,
      balanceAfter: next,
      type,
      referenceType,
      referenceId,
      metadata: metadata ?? undefined,
    },
  });
  await db.transaction.create({
    data: {
      referenceId: options?.transactionReferenceId ?? newReference("TX"),
      userId,
      type: txType,
      status: txStatus,
      amount: amount.abs(),
      currency: currencyCode,
      metadata: {
        direction: amount.greaterThan(0) ? "in" : "out",
        ledgerType: type,
        referenceType,
        referenceId,
      } as Prisma.InputJsonValue,
    },
  });
}

export async function applyBalanceChange(
  op: LedgerOp,
  txType: TransactionType,
  txStatus: TransactionStatus = "SUCCESS",
  options?: { transactionReferenceId?: string },
): Promise<void> {
  await prisma.$transaction(async (db) => {
    await applyBalanceChangeTx(db, op, txType, txStatus, options);
  });
}

type WalletRow = { id: string; balance: Decimal; lockedBalance: Decimal };

/**
 * Row-locked wallet read (PostgreSQL `FOR UPDATE`) — use inside an existing transaction.
 */
async function lockWalletRow(
  db: Prisma.TransactionClient,
  userId: string,
  kind: WalletKind,
  currencyCode: string,
): Promise<WalletRow | null> {
  const rows = await db.$queryRaw<WalletRow[]>(Prisma.sql`
    SELECT id, balance, "lockedBalance"
    FROM "WalletAccount"
    WHERE "userId" = ${userId}::uuid
      AND kind = ${kind}::"WalletKind"
      AND "currencyCode" = ${currencyCode}
    FOR UPDATE
  `);
  return rows[0] ?? null;
}

export async function moveToLockedTx(
  db: Prisma.TransactionClient,
  userId: string,
  kind: WalletKind,
  currencyCode: string,
  amount: Decimal,
  referenceType: string,
  referenceId: string,
): Promise<void> {
  const account = await lockWalletRow(db, userId, kind, currencyCode);
  if (!account || account.balance.lessThan(amount)) throw new InsufficientFundsError();

  const balanceNext = account.balance.sub(amount);
  const lockedNext = account.lockedBalance.add(amount);

  await db.walletAccount.update({
    where: { id: account.id },
    data: {
      balance: balanceNext,
      lockedBalance: lockedNext,
    },
  });
  await db.ledgerEntry.create({
    data: {
      accountId: account.id,
      userId,
      amount: amount.neg(),
      balanceAfter: balanceNext,
      type: "LOCK_ESCROW",
      referenceType,
      referenceId,
    },
  });
  await db.transaction.create({
    data: {
      referenceId: newReference("TX"),
      userId,
      type: "P2P_ESCROW_LOCK",
      status: "SUCCESS",
      amount: amount.abs(),
      currency: currencyCode,
      metadata: {
        ledgerType: "LOCK_ESCROW",
        referenceType,
        referenceId,
      } as Prisma.InputJsonValue,
    },
  });
}

export async function moveToLocked(
  userId: string,
  kind: WalletKind,
  currencyCode: string,
  amount: Decimal,
  referenceType: string,
  referenceId: string,
): Promise<void> {
  await prisma.$transaction(async (db) => {
    await moveToLockedTx(db, userId, kind, currencyCode, amount, referenceType, referenceId);
  });
}

export async function releaseLockedToBuyerTx(
  db: Prisma.TransactionClient,
  sellerId: string,
  buyerId: string,
  kind: WalletKind,
  currencyCode: string,
  amount: Decimal,
  referenceType: string,
  referenceId: string,
): Promise<void> {
  const seller = await lockWalletRow(db, sellerId, kind, currencyCode);
  if (!seller || seller.lockedBalance.lessThan(amount)) {
    throw new Error("ESCROW_MISMATCH");
  }
  await db.walletAccount.update({
    where: { id: seller.id },
    data: { lockedBalance: seller.lockedBalance.sub(amount) },
  });
  await db.transaction.create({
    data: {
      referenceId: newReference("TX"),
      userId: sellerId,
      type: "P2P_ESCROW_RELEASE",
      status: "SUCCESS",
      amount: amount.abs(),
      currency: currencyCode,
      metadata: {
        direction: "escrow_release",
        peer: buyerId,
        referenceType,
        referenceId,
      } as Prisma.InputJsonValue,
    },
  });

  const buyer = await lockWalletRow(db, buyerId, kind, currencyCode);
  if (!buyer) {
    await db.walletAccount.create({
      data: {
        userId: buyerId,
        kind,
        currencyCode,
        balance: amount,
        lockedBalance: new Decimal(0),
      },
    });
    const b = await db.walletAccount.findUniqueOrThrow({
      where: { userId_kind_currencyCode: { userId: buyerId, kind, currencyCode } },
    });
    await db.ledgerEntry.create({
      data: {
        accountId: b.id,
        userId: buyerId,
        amount,
        balanceAfter: amount,
        type: "P2P_RELEASE",
        referenceType,
        referenceId,
      },
    });
  } else {
    const nb = buyer.balance.add(amount);
    await db.walletAccount.update({
      where: { id: buyer.id },
      data: { balance: nb },
    });
    await db.ledgerEntry.create({
      data: {
        accountId: buyer.id,
        userId: buyerId,
        amount,
        balanceAfter: nb,
        type: "P2P_RELEASE",
        referenceType,
        referenceId,
      },
    });
  }
  await db.transaction.create({
    data: {
      referenceId: newReference("TX"),
      userId: buyerId,
      type: "P2P_ESCROW_RELEASE",
      status: "SUCCESS",
      amount: amount.abs(),
      currency: currencyCode,
      metadata: {
        direction: "in",
        peer: sellerId,
        referenceType,
        referenceId,
      } as Prisma.InputJsonValue,
    },
  });
}

export async function releaseLockedToBuyer(
  sellerId: string,
  buyerId: string,
  kind: WalletKind,
  currencyCode: string,
  amount: Decimal,
  referenceType: string,
  referenceId: string,
): Promise<void> {
  await prisma.$transaction(async (db) => {
    await releaseLockedToBuyerTx(db, sellerId, buyerId, kind, currencyCode, amount, referenceType, referenceId);
  });
}

export async function refundLockedToSellerTx(
  db: Prisma.TransactionClient,
  sellerId: string,
  kind: WalletKind,
  currencyCode: string,
  amount: Decimal,
  referenceType: string,
  referenceId: string,
): Promise<void> {
  const seller = await lockWalletRow(db, sellerId, kind, currencyCode);
  if (!seller || seller.lockedBalance.lessThan(amount)) throw new Error("ESCROW_MISMATCH");
  const nb = seller.balance.add(amount);
  await db.walletAccount.update({
    where: { id: seller.id },
    data: {
      balance: nb,
      lockedBalance: seller.lockedBalance.sub(amount),
    },
  });
  await db.ledgerEntry.create({
    data: {
      accountId: seller.id,
      userId: sellerId,
      amount,
      balanceAfter: nb,
      type: "P2P_REFUND",
      referenceType,
      referenceId,
    },
  });
  await db.transaction.create({
    data: {
      referenceId: newReference("TX"),
      userId: sellerId,
      type: "P2P_REFUND",
      status: "SUCCESS",
      amount: amount.abs(),
      currency: currencyCode,
      metadata: {
        ledgerType: "P2P_REFUND",
        referenceType,
        referenceId,
      } as Prisma.InputJsonValue,
    },
  });
}

export async function refundLockedToSeller(
  sellerId: string,
  kind: WalletKind,
  currencyCode: string,
  amount: Decimal,
  referenceType: string,
  referenceId: string,
): Promise<void> {
  await prisma.$transaction(async (db) => {
    await refundLockedToSellerTx(db, sellerId, kind, currencyCode, amount, referenceType, referenceId);
  });
}

export async function transferInternalAtomic(input: {
  fromUserId: string;
  toUserId: string;
  kind: WalletKind;
  currencyCode: string;
  amount: Decimal;
  referenceId: string;
  txTypeOut: TransactionType;
  txTypeIn: TransactionType;
}): Promise<void> {
  const { fromUserId, toUserId, kind, currencyCode, amount, referenceId, txTypeOut, txTypeIn } =
    input;
  await prisma.$transaction(async (db) => {
    const fromAcc = await db.walletAccount.findUnique({
      where: { userId_kind_currencyCode: { userId: fromUserId, kind, currencyCode } },
    });
    if (!fromAcc || fromAcc.balance.lessThan(amount)) throw new InsufficientFundsError();

    let toAcc = await db.walletAccount.findUnique({
      where: { userId_kind_currencyCode: { userId: toUserId, kind, currencyCode } },
    });
    if (!toAcc) {
      toAcc = await db.walletAccount.create({
        data: {
          userId: toUserId,
          kind,
          currencyCode,
          balance: new Decimal(0),
          lockedBalance: new Decimal(0),
        },
      });
    }

    const fromNext = fromAcc.balance.sub(amount);
    const toNext = toAcc.balance.add(amount);

    await db.walletAccount.update({
      where: { id: fromAcc.id },
      data: { balance: fromNext },
    });
    await db.walletAccount.update({
      where: { id: toAcc.id },
      data: { balance: toNext },
    });

    await db.ledgerEntry.create({
      data: {
        accountId: fromAcc.id,
        userId: fromUserId,
        amount: amount.neg(),
        balanceAfter: fromNext,
        type: "INTERNAL_OUT",
        referenceType: "InternalTransfer",
        referenceId,
      },
    });
    await db.ledgerEntry.create({
      data: {
        accountId: toAcc.id,
        userId: toUserId,
        amount,
        balanceAfter: toNext,
        type: "INTERNAL_IN",
        referenceType: "InternalTransfer",
        referenceId,
      },
    });

    await db.transaction.createMany({
      data: [
        {
          referenceId: newReference("TX"),
          userId: fromUserId,
          type: txTypeOut,
          status: "SUCCESS",
          amount,
          currency: currencyCode,
          metadata: {
            peer: toUserId,
            referenceId,
          } as Prisma.InputJsonValue,
        },
        {
          referenceId: newReference("TX"),
          userId: toUserId,
          type: txTypeIn,
          status: "SUCCESS",
          amount,
          currency: currencyCode,
          metadata: {
            peer: fromUserId,
            referenceId,
          } as Prisma.InputJsonValue,
        },
      ],
    });
  });
}

export { d };
