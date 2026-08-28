import { Employee } from '../entities/employee.entity';

/** Result of an exactly-once tab charge; `alreadyApplied` marks a replay. */
export interface TabChargeOutcome {
  employee: Employee;
  alreadyApplied: boolean;
}

export interface IEmployeeRepository {
  findByCardNumber(cardNumber: string): Promise<Employee | null>;
  searchByEmployeeNumber(query: string): Promise<Employee[]>;
  save(employee: Employee): Promise<Employee>;
  updateTab(cardNumber: string, tab: number): Promise<Employee | null>;
  /** Charges the tab exactly once for a given `saleId`, even across retries. */
  applyTabChargeOnce(
    cardNumber: string,
    amount: number,
    saleId: string
  ): Promise<TabChargeOutcome | null>;
  findAll(): Promise<Employee[]>;
  delete(cardNumber: string): Promise<boolean>;
  updateEmployeeNumber(cardNumber: string, newEmployeeNumber: string): Promise<Employee | null>;
}
