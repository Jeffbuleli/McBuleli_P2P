import { customAlphabet } from "nanoid";

const nanoid = customAlphabet("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ", 18);

export function newReference(prefix: string): string {
  return `${prefix}_${nanoid()}`;
}
