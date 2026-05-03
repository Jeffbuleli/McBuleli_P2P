import type { ChainNetwork } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { prisma } from "../../lib/prisma.js";
import { TransactionType, WalletKind } from "../../constants/schemaEnums.js";
import {
  applyBalanceChangeTx,
  finalizeLockedWithdrawalTx,
  InsufficientFundsError,
  moveToLockedTx,
  refundLockedToSellerTx,
} from "../ledger.service.js";
import { env } from "../../config/env.js";
import { newReference } from "../../utils/refs.js";
import { validateDestinationAddress } from "./address-validate.js";
import {
  CRYPTO_MIN_NET_USDT,
  cryptoServiceFeeUsdt,
  requirePlatformFeeTreasuryUserId,
} from "./crypto-fees.js";

export async function requestCryptoWithdrawal(input: {
  userId: string;
  network: ChainNetwork;
  toAddress: string;
  amountStr: string;
}) {
  const { userId, network, toAddress, amountStr } = input;
  const addr = toAddress.trim();
  if (!validateDestinationAddress(network, addr)) throw new Error("INVALID_ADDRESS");

  const net = new Decimal(amountStr);
  if (net.lessThanOrEqualTo(0)) throw new Error("INVALID_AMOUNT");
  if (net.lessThan(CRYPTO_MIN_NET_USDT)) throw new Error("BELOW_MIN_WITHDRAW");

  const fee = cryptoServiceFeeUsdt();
  const totalLocked = net.add(fee);

  const referenceId = newReference("CW");

  try {
    const withdrawal = await prisma.$transaction(async (tx) => {
      const row = await tx.cryptoOnchainWithdrawal.create({
        data: {
          referenceId,
          userId,
          asset: "USDT",
          network,
          toAddress: addr,
          amount: net,
          feeAmount: fee,
          status: "PENDING",
        },
      });

      await moveToLockedTx(
        tx,
        userId,
        WalletKind.CRYPTO,
        "USDT",
        totalLocked,
        "CryptoOnchainWithdrawal",
        row.id,
        {
          ledgerType: "LOCK_CRYPTO_WITHDRAW",
          transactionType: TransactionType.WITHDRAW_CRYPTO,
          transactionStatus: "PENDING",
          transactionReferenceId: referenceId,
        },
      );

      return row;
    });

    if (env().CRYPTO_WITHDRAW_CEX_MOCK) {
      await finalizeWithdrawSuccess(withdrawal.id, `mock_${withdrawal.id.replace(/-/g, "").slice(0, 18)}`, "MOCK");
    }

    return prisma.cryptoOnchainWithdrawal.findUniqueOrThrow({
      where: { id: withdrawal.id },
    });
  } catch (e: unknown) {
    if (e instanceof InsufficientFundsError) throw new Error("INSUFFICIENT_FUNDS");
    throw e;
  }
}

async function finalizeWithdrawSuccess(withdrawalId: string, txid: string, cexOrderId?: string) {
  const w = await prisma.cryptoOnchainWithdrawal.findUnique({ where: { id: withdrawalId } });
  if (!w || w.status !== "PENDING") return;

  const totalConsumed = w.amount.add(w.feeAmount);
  const treasuryUserId = requirePlatformFeeTreasuryUserId();

  await prisma.$transaction(async (tx) => {
    await finalizeLockedWithdrawalTx(
      tx,
      w.userId,
      WalletKind.CRYPTO,
      "USDT",
      totalConsumed,
      "CryptoOnchainWithdrawal",
      w.id,
      w.referenceId,
    );

    await applyBalanceChangeTx(
      tx,
      {
        userId: treasuryUserId,
        kind: WalletKind.CRYPTO,
        currencyCode: "USDT",
        amount: w.feeAmount,
        type: "CRYPTO_WITHDRAW_FEE",
        referenceType: "CryptoOnchainWithdrawal",
        referenceId: w.id,
        metadata: {
          txid,
          network: w.network,
          sourceUserId: w.userId,
          netOut: w.amount.toString(),
        },
      },
      TransactionType.ADJUSTMENT,
      "SUCCESS",
      { transactionReferenceId: `CWFEE_${w.id}` },
    );

    await tx.cryptoOnchainWithdrawal.update({
      where: { id: w.id },
      data: {
        status: "SUCCESS",
        txid,
        cexOrderId: cexOrderId ?? null,
      },
    });

    await tx.usedOnchainTxid.create({
      data: {
        network: w.network,
        txid,
        withdrawalId: w.id,
      },
    });
  });
}

export async function failCryptoWithdrawal(withdrawalId: string, reason: string) {
  const w = await prisma.cryptoOnchainWithdrawal.findUnique({ where: { id: withdrawalId } });
  if (!w || w.status !== "PENDING") return;

  const refundAmt = w.amount.add(w.feeAmount);

  await prisma.$transaction(async (tx) => {
    await refundLockedToSellerTx(
      tx,
      w.userId,
      WalletKind.CRYPTO,
      "USDT",
      refundAmt,
      "CryptoOnchainWithdrawal",
      w.id,
    );
    await tx.transaction.updateMany({
      where: { referenceId: w.referenceId, userId: w.userId },
      data: {
        status: "FAILED",
        metadata: { failureReason: reason } as object,
      },
    });
    await tx.cryptoOnchainWithdrawal.update({
      where: { id: w.id },
      data: { status: "FAILED", failureReason: reason },
    });
  });
}
