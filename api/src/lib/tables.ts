import { TableClient, TableEntityResult, odata } from "@azure/data-tables";
import { randomUUID } from "node:crypto";
import { Bill, BillInput, BillPatch } from "../shared/types";

const BILLS_PARTITION = "bills";
const CREDENTIALS_PARTITION = "credentials";
const PAYEES_PARTITION = "payees";

function connectionString(): string {
  const conn = process.env.AZURE_STORAGE_CONNECTION_STRING;
  if (!conn) throw new Error("AZURE_STORAGE_CONNECTION_STRING is not set");
  return conn;
}

export const billsTable = TableClient.fromConnectionString(connectionString(), "Bills");
export const credentialsTable = TableClient.fromConnectionString(connectionString(), "Credentials");
export const payeesTable = TableClient.fromConnectionString(connectionString(), "Payees");

let tablesReady: Promise<void> | null = null;

export function ensureTablesExist(): Promise<void> {
  if (!tablesReady) {
    tablesReady = Promise.all([
      billsTable.createTable().catch(ignoreConflict),
      credentialsTable.createTable().catch(ignoreConflict),
      payeesTable.createTable().catch(ignoreConflict),
    ]).then(() => undefined);
  }
  return tablesReady;
}

function payeeRowKey(name: string): string {
  // Table Storage row keys can't contain / \ # ? — strip anything outside a safe set and
  // lowercase so "Amex" and "amex" dedupe to the same row.
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 200) || "payee";
}

export async function listPayees(): Promise<string[]> {
  await ensureTablesExist();
  const results: string[] = [];
  const iter = payeesTable.listEntities<{ name: string }>({
    queryOptions: { filter: odata`PartitionKey eq ${PAYEES_PARTITION}` },
  });
  for await (const entity of iter) {
    results.push(entity.name);
  }
  return results.sort((a, b) => a.localeCompare(b));
}

export async function ensurePayeeKnown(name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) return;
  await ensureTablesExist();
  try {
    await payeesTable.createEntity({
      partitionKey: PAYEES_PARTITION,
      rowKey: payeeRowKey(trimmed),
      name: trimmed,
    });
  } catch (err) {
    if ((err as { statusCode?: number })?.statusCode !== 409) throw err;
  }
}

function ignoreConflict(err: unknown) {
  const status = (err as { statusCode?: number })?.statusCode;
  if (status !== 409) throw err;
}

interface BillEntity extends Record<string, unknown> {
  partitionKey: string;
  rowKey: string;
  payee: string;
  amount?: number;
  dueDate: string;
  paidDate?: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

function toBill(entity: TableEntityResult<BillEntity>): Bill {
  return {
    id: entity.rowKey,
    payee: entity.payee,
    amount: entity.amount ?? null,
    dueDate: entity.dueDate,
    paidDate: entity.paidDate ?? null,
    notes: entity.notes ?? "",
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
  };
}

export async function listBills(): Promise<Bill[]> {
  await ensureTablesExist();
  const results: Bill[] = [];
  const iter = billsTable.listEntities<BillEntity>({
    queryOptions: { filter: odata`PartitionKey eq ${BILLS_PARTITION}` },
  });
  for await (const entity of iter) {
    results.push(toBill(entity));
  }
  return results;
}

export async function createBill(input: BillInput): Promise<Bill> {
  await ensureTablesExist();
  const now = new Date().toISOString();
  const entity: BillEntity = {
    partitionKey: BILLS_PARTITION,
    rowKey: randomUUID(),
    payee: input.payee,
    dueDate: input.dueDate,
    notes: input.notes ?? "",
    createdAt: now,
    updatedAt: now,
  };
  if (input.amount !== null && input.amount !== undefined) entity.amount = input.amount;
  if (input.paidDate) entity.paidDate = input.paidDate;
  await billsTable.createEntity(entity);
  await ensurePayeeKnown(input.payee);
  return toBill(entity as TableEntityResult<BillEntity>);
}

export async function updateBill(id: string, patch: BillPatch): Promise<Bill> {
  await ensureTablesExist();
  const existing = await billsTable.getEntity<BillEntity>(BILLS_PARTITION, id);
  const merged: BillEntity = {
    partitionKey: BILLS_PARTITION,
    rowKey: id,
    payee: patch.payee ?? existing.payee,
    dueDate: patch.dueDate ?? existing.dueDate,
    notes: patch.notes ?? existing.notes ?? "",
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };
  const amount = "amount" in patch ? patch.amount : existing.amount ?? null;
  if (amount !== null && amount !== undefined) merged.amount = amount;

  const paidDate = "paidDate" in patch ? patch.paidDate : existing.paidDate ?? null;
  if (paidDate) merged.paidDate = paidDate;

  await billsTable.updateEntity(merged, "Replace");
  if (patch.payee) await ensurePayeeKnown(patch.payee);
  return toBill(merged as TableEntityResult<BillEntity>);
}

export async function deleteBill(id: string): Promise<void> {
  await ensureTablesExist();
  await billsTable.deleteEntity(BILLS_PARTITION, id);
}

export interface CredentialRecord {
  credentialId: string;
  publicKey: string;
  counter: number;
  transports?: string[];
  deviceLabel: string;
  createdAt: string;
}

interface CredentialEntity extends Record<string, unknown> {
  partitionKey: string;
  rowKey: string;
  publicKey: string;
  counter: number;
  transports?: string;
  deviceLabel: string;
  createdAt: string;
}

function toCredential(entity: TableEntityResult<CredentialEntity>): CredentialRecord {
  return {
    credentialId: entity.rowKey,
    publicKey: entity.publicKey,
    counter: entity.counter,
    transports: entity.transports ? JSON.parse(entity.transports) : undefined,
    deviceLabel: entity.deviceLabel,
    createdAt: entity.createdAt,
  };
}

export async function listCredentials(): Promise<CredentialRecord[]> {
  await ensureTablesExist();
  const results: CredentialRecord[] = [];
  const iter = credentialsTable.listEntities<CredentialEntity>({
    queryOptions: { filter: odata`PartitionKey eq ${CREDENTIALS_PARTITION}` },
  });
  for await (const entity of iter) {
    results.push(toCredential(entity));
  }
  return results;
}

export async function getCredential(credentialId: string): Promise<CredentialRecord | null> {
  await ensureTablesExist();
  try {
    const entity = await credentialsTable.getEntity<CredentialEntity>(CREDENTIALS_PARTITION, credentialId);
    return toCredential(entity);
  } catch (err) {
    if ((err as { statusCode?: number })?.statusCode === 404) return null;
    throw err;
  }
}

export async function createCredential(record: CredentialRecord): Promise<void> {
  await ensureTablesExist();
  const entity: CredentialEntity = {
    partitionKey: CREDENTIALS_PARTITION,
    rowKey: record.credentialId,
    publicKey: record.publicKey,
    counter: record.counter,
    deviceLabel: record.deviceLabel,
    createdAt: record.createdAt,
  };
  if (record.transports?.length) entity.transports = JSON.stringify(record.transports);
  await credentialsTable.createEntity(entity);
}

export async function updateCredentialCounter(credentialId: string, counter: number): Promise<void> {
  await ensureTablesExist();
  await credentialsTable.updateEntity(
    { partitionKey: CREDENTIALS_PARTITION, rowKey: credentialId, counter },
    "Merge"
  );
}
