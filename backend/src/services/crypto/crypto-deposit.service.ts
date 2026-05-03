import type { ChainNetwork, CryptoAsset } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { prisma } from "../../lib/prisma.js";
import { TransactionType, WalletKind } from "../../constants/schemaEnums.js";
import { applyBalanceChangeTx } from "../ledger.service.js";
import { custodialDepositAddress } from "./chain-config.js";
import {
  CRYPTO_MIN_NET_USDT,
  cryptoServiceFeeUsdt,
  requirePlatformFeeTreasuryUserId,
} from "./crypto-fees.js";
import { normalizeTxIdForStore, verifyUsdtIncomingPayment } from "./onchain-verify.js";

const DEFAULT_MIN = CRYPTO_MIN_NET_USDT;

function currencyCodeForAsset(asset: CryptoAsset): string {
  return asset === "BTC" ? "BTC" : "USDT";
}

export async function createDepositIntent(input: {
  userId: string;
  asset: CryptoAsset;
  network: ChainNetwork;
  acceptedRisk: boolean;
}) {
  const { userId, asset, network, acceptedRisk } = input;
  if (!acceptedRisk) throw new Error("RISK_NOT_ACCEPTED");
  if (asset !== "USDT") throw new Error("ASSET_NOT_SUPPORTED");

  const platformAddress = custodialDepositAddress(asset, network);
  if (!platformAddress) throw new Error("CRYPTO_DEPOSIT_NOT_CONFIGURED");

  const minAmount = DEFAULT_MIN;
  const fee = cryptoServiceFeeUsdt();
  const minSendOnChain = minAmount.add(fee);
  const confirmationsRequired =
    network === "ERC20" ? 12 : network === "BEP20" ? 15 : 19;

  const intent = await prisma.cryptoDepositIntent.create({
    data: {
      userId,
      asset,
      network,
      platformAddress,
      memoTag: null,
      minAmount,
      serviceFeeUsdt: fee,
      confirmationsRequired,
      riskWarningAcceptedAt: new Date(),
      status: "AWAITING_TX",
    },
  });

  return {
    intent,
    display: {
      minCreditToAccount: minAmount.toString(),
      serviceFeeUsdt: fee.toString(),
      minSendOnChain: minSendOnChain.toString(),
      feeExampleCredit: "100",
      feeExampleSend: new Decimal("100").add(fee).toString(),
      confirmationsRequired,
      memoTag: null as string | null,
    },
  };
}

export async function markDepositSent(userId: string, intentId: string) {
  const intent = await prisma.cryptoDepositIntent.findFirst({
    where: { id: intentId, userId },
  });
  if (!intent) throw new Error("INTENT_NOT_FOUND");
  if (intent.status !== "AWAITING_TX") throw new Error("INVALID_STATE");

  await prisma.cryptoDepositIntent.update({
    where: { id: intent.id },
    data: { userMarkedSentAt: new Date() },
  });
  return { ok: true };
}

export async function submitDepositTxid(userId: string, intentId: string, txidRaw: string) {
  const txidIn = txidRaw.trim();
  if (!txidIn) throw new Error("TXID_REQUIRED");

  const intent = await prisma.cryptoDepositIntent.findFirst({
    where: { id: intentId, userId },
  });
  if (!intent) throw new Error("INTENT_NOT_FOUND");
  if (intent.status === "CONFIRMED") {
    return { status: intent.status, intent };
  }
  if (intent.status === "FAILED") throw new Error("INTENT_FAILED");

  const canonical = normalizeTxIdForStore(intent.network, txidIn);

  const clash = await prisma.usedOnchainTxid.findFirst({
    where: { network: intent.network, txid: canonical },
  });
  if (clash && clash.depositIntentId && clash.depositIntentId !== intent.id) {
    throw new Error("TXID_REUSED");
  }

  await prisma.cryptoDepositIntent.update({
    where: { id: intent.id },
    data: {
      txid: canonical,
      status: "PENDING_VALIDATION",
      failureReason: null,
    },
  });

  const minOnChain = intent.minAmount.add(intent.serviceFeeUsdt);

  const verified = await verifyUsdtIncomingPayment({
    network: intent.network,
    txidRaw: txidIn,
    platformAddress: intent.platformAddress,
    minAmount: minOnChain,
    memoExpected: intent.memoTag,
  });

  const explorerSnapshot = verified.ok ? verified.raw : verified.raw ?? { failure: verified };

  if (!verified.ok) {
    if (verified.code === "NOT_FOUND") {
      await prisma.cryptoDepositIntent.update({
        where: { id: intent.id },
        data: {
          status: "PENDING_VALIDATION",
          explorerValidationJson: explorerSnapshot as object,
          failureReason: "AWAITING_CHAIN_CONFIRMATION",
        },
      });
      return {
        status: "PENDING_VALIDATION" as const,
        reason: "NOT_FOUND_ON_CHAIN",
      };
    }

    const fatal =
      verified.code === "WRONG_RECIPIENT" ||
      verified.code === "WRONG_ASSET" ||
      verified.code === "MEMO_MISMATCH" ||
      verified.code === "AMOUNT_BELOW_MIN";

    if (fatal) {
      const reason =
        verified.code === "WRONG_RECIPIENT"
          ? "WRONG_ADDRESS_OR_ASSET"
          : verified.code === "MEMO_MISMATCH"
            ? "MEMO_MISMATCH"
            : verified.code === "AMOUNT_BELOW_MIN"
              ? "BELOW_MINIMUM"
              : "VALIDATION_FAILED";

      await prisma.cryptoDepositIntent.update({
        where: { id: intent.id },
        data: {
          status: "FAILED",
          failureReason: reason,
          explorerValidationJson: explorerSnapshot as object,
        },
      });
      return { status: "FAILED" as const, reason };
    }

    await prisma.cryptoDepositIntent.update({
      where: { id: intent.id },
      data: {
        status: "PENDING_VALIDATION",
        explorerValidationJson: explorerSnapshot as object,
        failureReason: verified.code,
      },
    });
    return { status: "PENDING_VALIDATION" as const, reason: verified.code };
  }

  const confRequired = intent.confirmationsRequired;
  if (verified.confirmations < confRequired) {
    await prisma.cryptoDepositIntent.update({
      where: { id: intent.id },
      data: {
        status: "PENDING_VALIDATION",
        explorerValidationJson: explorerSnapshot as object,
        failureReason: "INSUFFICIENT_CONFIRMATIONS",
      },
    });
    return {
      status: "PENDING_VALIDATION" as const,
      reason: "INSUFFICIENT_CONFIRMATIONS",
      confirmations: verified.confirmations,
      required: confRequired,
    };
  }

  const fee = intent.serviceFeeUsdt;
  const netToUser = verified.amount.sub(fee);
  if (netToUser.lessThan(intent.minAmount)) {
    await prisma.cryptoDepositIntent.update({
      where: { id: intent.id },
      data: {
        status: "FAILED",
        failureReason: "BELOW_MINIMUM_AFTER_FEE",
        explorerValidationJson: explorerSnapshot as object,
      },
    });
    return { status: "FAILED" as const, reason: "BELOW_MINIMUM_AFTER_FEE" };
  }

  const treasuryUserId = requirePlatformFeeTreasuryUserId();
  const currencyCode = currencyCodeForAsset(intent.asset);

  await prisma.$transaction(async (tx) => {
    await applyBalanceChangeTx(
      tx,
      {
        userId,
        kind: WalletKind.CRYPTO,
        currencyCode,
        amount: netToUser,
        type: "DEPOSIT_CRYPTO_ONCHAIN",
        referenceType: "CryptoDepositIntent",
        referenceId: intent.id,
        metadata: {
          txid: canonical,
          network: intent.network,
          grossOnChain: verified.amount.toString(),
          serviceFee: fee.toString(),
          netCredit: netToUser.toString(),
        },
      },
      TransactionType.DEPOSIT_CRYPTO,
      "SUCCESS",
      { transactionReferenceId: `DEP_${intent.id}` },
    );

    await applyBalanceChangeTx(
      tx,
      {
        userId: treasuryUserId,
        kind: WalletKind.CRYPTO,
        currencyCode,
        amount: fee,
        type: "CRYPTO_SERVICE_FEE",
        referenceType: "CryptoDepositIntent",
        referenceId: intent.id,
        metadata: {
          txid: canonical,
          network: intent.network,
          sourceUserId: userId,
        },
      },
      TransactionType.ADJUSTMENT,
      "SUCCESS",
      { transactionReferenceId: `DEPFEE_${intent.id}` },
    );

    await tx.usedOnchainTxid.create({
      data: {
        network: intent.network,
        txid: canonical,
        depositIntentId: intent.id,
      },
    });

    await tx.cryptoDepositIntent.update({
      where: { id: intent.id },
      data: {
        status: "CONFIRMED",
        amountCredited: netToUser,
        explorerValidationJson: explorerSnapshot as object,
        failureReason: null,
      },
    });
  });

  const updated = await prisma.cryptoDepositIntent.findUniqueOrThrow({
    where: { id: intent.id },
  });
  return { status: "CONFIRMED" as const, intent: updated };
}

export async function getDepositIntent(userId: string, intentId: string) {
  const intent = await prisma.cryptoDepositIntent.findFirst({
    where: { id: intentId, userId },
  });
  if (!intent) throw new Error("INTENT_NOT_FOUND");
  return intent;
}

/** Re-run explorer validation for pending intents (polling). */
export async function refreshDepositTx(userId: string, intentId: string) {
  const intent = await prisma.cryptoDepositIntent.findFirst({
    where: { id: intentId, userId },
  });
  if (!intent) throw new Error("INTENT_NOT_FOUND");
  if (!intent.txid) throw new Error("TXID_MISSING");
  if (intent.status === "CONFIRMED" || intent.status === "FAILED") {
    return { status: intent.status, intent };
  }
  return submitDepositTxid(userId, intentId, intent.txid);
}
