import { Employee } from '../entities/employee.entity';

export interface IEmployeeRepository {
  findByEmployeeNumber(employeeNumber: string): Promise<Employee | null>;
  searchByName(query: string): Promise<Employee[]>;
  save(employee: Employee): Promise<Employee>;
  updateTab(employeeNumber: string, tab: number): Promise<Employee | null>;
  findAll(): Promise<Employee[]>;
  delete(employeeNumber: string): Promise<boolean>;
}
