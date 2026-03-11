import { EmployeeEntity } from '@/lib/domain/entities/employee.entity';
import { IEmployeeRepository } from '@/lib/domain/ports/employee.repository.port';

export class EmployeeApplicationService {
  constructor(private readonly employeeRepository: IEmployeeRepository) {}

  async lookup(employeeNumber: string) {
    return this.employeeRepository.findByEmployeeNumber(employeeNumber);
  }

  async create(employeeNumber: string, fullName: string) {
    const existing =
      await this.employeeRepository.findByEmployeeNumber(employeeNumber);
    if (existing) {
      throw new Error('Employee already exists');
    }
    const employee = EmployeeEntity.create(employeeNumber, fullName);
    return this.employeeRepository.save(employee);
  }

  async addToTab(employeeNumber: string, amount: number) {
    const employee =
      await this.employeeRepository.findByEmployeeNumber(employeeNumber);
    if (!employee) {
      throw new Error('Employee not found');
    }
    return this.employeeRepository.updateTab(
      employeeNumber,
      employee.tab + amount
    );
  }

  async resetTab(employeeNumber: string) {
    return this.employeeRepository.updateTab(employeeNumber, 0);
  }

  async getAll() {
    return this.employeeRepository.findAll();
  }

  async delete(employeeNumber: string) {
    return this.employeeRepository.delete(employeeNumber);
  }
}
