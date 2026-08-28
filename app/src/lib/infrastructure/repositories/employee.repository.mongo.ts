import { Employee } from '@/lib/domain/entities/employee.entity';
import {
  IEmployeeRepository,
  TabChargeOutcome,
} from '@/lib/domain/ports/employee.repository.port';
import { getDb } from '../db/mongo';
import { APPLIED_SALES_HISTORY } from '@/lib/domain/inventory-rules';

interface EmployeeDocument extends Employee {
  /** Sale ids already charged to this tab, for exactly-once retries. */
  appliedSaleIds?: string[];
}

function toEmployee(doc: EmployeeDocument): Employee {
  return {
    cardNumber: doc.cardNumber,
    employeeNumber: doc.employeeNumber,
    tab: doc.tab,
  };
}

export class MongoEmployeeRepository implements IEmployeeRepository {
  private readonly collectionName = 'employees';

  private async collection() {
    const db = await getDb();
    return db.collection<EmployeeDocument>(this.collectionName);
  }

  async findByCardNumber(cardNumber: string): Promise<Employee | null> {
    const col = await this.collection();
    const doc = await col.findOne({ cardNumber });
    return doc ? toEmployee(doc) : null;
  }

  async searchByEmployeeNumber(query: string): Promise<Employee[]> {
    const col = await this.collection();
    const docs = await col
      .find({ employeeNumber: { $regex: query, $options: 'i' } })
      .toArray();
    return docs.map(toEmployee);
  }

  async save(employee: Employee): Promise<Employee> {
    const col = await this.collection();
    await col.insertOne({ ...employee });
    return employee;
  }

  async updateTab(
    cardNumber: string,
    tab: number
  ): Promise<Employee | null> {
    const col = await this.collection();
    const result = await col.findOneAndUpdate(
      { cardNumber },
      { $set: { tab } },
      { returnDocument: 'after' }
    );
    return result ? toEmployee(result) : null;
  }

  async applyTabChargeOnce(
    cardNumber: string,
    amount: number,
    saleId: string
  ): Promise<TabChargeOutcome | null> {
    const col = await this.collection();

    // Atomic conditional `$inc`: guard and increment commit together, so
    // concurrent saves cannot lose an update and a retry cannot double-charge.
    const charged = await col.findOneAndUpdate(
      { cardNumber, appliedSaleIds: { $ne: saleId } },
      {
        $inc: { tab: amount },
        $push: {
          appliedSaleIds: { $each: [saleId], $slice: -APPLIED_SALES_HISTORY },
        },
      },
      { returnDocument: 'after' }
    );

    if (charged) {
      return { employee: toEmployee(charged), alreadyApplied: false };
    }

    const existing = await col.findOne({ cardNumber });
    if (!existing) return null;

    return { employee: toEmployee(existing), alreadyApplied: true };
  }

  async findAll(): Promise<Employee[]> {
    const col = await this.collection();
    const docs = await col.find().toArray();
    return docs.map(toEmployee);
  }

  async delete(cardNumber: string): Promise<boolean> {
    const col = await this.collection();
    const result = await col.deleteOne({ cardNumber });
    return result.deletedCount === 1;
  }

  async updateEmployeeNumber(cardNumber: string, newEmployeeNumber: string): Promise<Employee | null> {
    const col = await this.collection();
    const conflict = await col.findOne({ employeeNumber: newEmployeeNumber, cardNumber: { $ne: cardNumber } });
    if (conflict) throw new Error('Employee number already in use');
    const result = await col.findOneAndUpdate(
      { cardNumber },
      { $set: { employeeNumber: newEmployeeNumber } },
      { returnDocument: 'after' }
    );
    return result ? toEmployee(result) : null;
  }
}

export const employeeRepository = new MongoEmployeeRepository();
