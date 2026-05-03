import { Decimal } from "@prisma/client/runtime/library";
import { prisma } from "../lib/prisma.js";
import { TransactionType, WalletKind } from "../constants/schemaEnums.js";
import { getOrCreateWallet, transferInternalAtomic } from "./ledger.service.js";
import { newReference } from "../utils/refs.js";

export async function getBalances(userId: string) {
  return prisma.walletAccount.findMany({ where: { userId } });
}

export async function internalTransfer(
  fromUserId: string,
  toIdentifier: string,
  amountStr: string,
  currencyCode: string,
  kind: WalletKind,
) {
  const amount = new Decimal(amountStr);
  if (amount.lessThanOrEqualTo(0)) throw new Error("INVALID_AMOUNT");

  const toUser = await prisma.user.findFirst({
    where: {
      OR: [{ email: toIdentifier.toLowerCase() }, { username: toIdentifier.toLowerCase() }],
    },
  });
  if (!toUser) throw new Error("USER_NOT_FOUND");
  if (toUser.id === fromUserId) throw new Error("SELF_TRANSFER");
  if (toUser.isFrozen || toUser.isBlacklisted) throw new Error("TARGET_BLOCKED");

  const ref = newReference("TRF");
  await getOrCreateWallet(fromUserId, kind, currencyCode);
  await getOrCreateWallet(toUser.id, kind, currencyCode);

  await transferInternalAtomic({
    fromUserId,
    toUserId: toUser.id,
    kind,
    currencyCode,
    amount,
    referenceId: ref,
    txTypeOut: TransactionType.INTERNAL_TRANSFER_OUT,
    txTypeIn: TransactionType.INTERNAL_TRANSFER_IN,
  });

  return prisma.internalTransfer.create({
    data: {
      referenceId: ref,
      fromUserId,
      toUserId: toUser.id,
      amount,
      currency: `${kind}:${currencyCode}`,
    },
  });
}
