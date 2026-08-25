import type { Collection } from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { closeDb, getDb } from '@/lib/infrastructure/db/mongo';

/**
 * Minimal shapes of the stored documents, declared here so the helpers can use
 * typed collections. `_id` is a string in this app, not an ObjectId, which the
 * driver's default `Document` typing does not assume.
 */
interface ProductDoc {
  _id: string;
  barcodes: string[];
  name: string;
  price: number;
  quantity?: number;
}

interface EmployeeDoc {
  _id?: string;
  cardNumber: string;
  employeeNumber: string;
  tab: number;
}

interface TransactionDoc {
  _id: string;
  inventory?: { productId: string | null; applied: number }[];
}

let server: MongoMemoryServer | null = null;

/**
 * Boots an in-process MongoDB and points the app's connection helper at it.
 *
 * The exactly-once guarantees are enforced by MongoDB update semantics, so
 * these suites run against a real server; hand-written fakes could not prove
 * that the guards actually hold.
 */
export async function startTestDb(dbName: string): Promise<void> {
  server = await MongoMemoryServer.create();
  process.env.MONGODB_URI = server.getUri();
  process.env.MONGODB_DB = dbName;
  await getDb();
}

export async function stopTestDb(): Promise<void> {
  await closeDb();
  if (server) {
    await server.stop();
    server = null;
  }
}

export async function products(): Promise<Collection<ProductDoc>> {
  return (await getDb()).collection<ProductDoc>('products');
}

export async function employees(): Promise<Collection<EmployeeDoc>> {
  return (await getDb()).collection<EmployeeDoc>('employees');
}

export async function transactions(): Promise<Collection<TransactionDoc>> {
  return (await getDb()).collection<TransactionDoc>('transactions');
}

export async function resetCollections(): Promise<void> {
  const db = await getDb();
  await Promise.all(
    ['products', 'employees', 'transactions'].map((name) =>
      db.collection(name).deleteMany({})
    )
  );
}

export interface SeedProduct {
  id: string;
  barcodes: string[];
  name: string;
  price: number;
  quantity: number;
}

export async function seedProduct(product: SeedProduct): Promise<void> {
  const { id, ...rest } = product;
  await (await products()).insertOne({ _id: id, ...rest });
}

export async function seedEmployee(employee: {
  cardNumber: string;
  employeeNumber: string;
  tab?: number;
}): Promise<void> {
  await (await employees()).insertOne({ tab: 0, ...employee });
}

export async function readQuantity(productId: string): Promise<number> {
  const doc = await (await products()).findOne({ _id: productId });
  if (!doc) throw new Error(`no product ${productId}`);
  return doc.quantity ?? 0;
}

export async function readTab(cardNumber: string): Promise<number> {
  const doc = await (await employees()).findOne({ cardNumber });
  if (!doc) throw new Error(`no employee ${cardNumber}`);
  return doc.tab;
}

export async function countTransactions(): Promise<number> {
  return (await transactions()).countDocuments();
}

/** Total units the ledger says left stock, per product id. */
export async function unitsRemovedPerProduct(): Promise<Record<string, number>> {
  const recorded = await (await transactions()).find().toArray();
  const totals: Record<string, number> = {};
  for (const transaction of recorded) {
    for (const line of transaction.inventory ?? []) {
      if (!line.productId) continue;
      totals[line.productId] = (totals[line.productId] ?? 0) + line.applied;
    }
  }
  return totals;
}
