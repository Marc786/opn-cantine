import { EmployeeEntity } from '@/lib/domain/entities/employee.entity';
import { IEmployeeRepository } from '@/lib/domain/ports/employee.repository.port';

export class EmployeeApplicationService {
  constructor(private readonly employeeRepository: IEmployeeRepository) {}

  async lookup(cardNumber: string) {
    return this.employeeRepository.findByCardNumber(cardNumber);
  }

  async search(query: string) {
    return this.employeeRepository.searchByEmployeeNumber(query);
  }

  async create(cardNumber: string, employeeNumber: string, initialTab: number = 0) {
    const existing =
      await this.employeeRepository.findByCardNumber(cardNumber);
    if (existing) {
      throw new Error('Employee already exists');
    }
    const employee = EmployeeEntity.create(cardNumber, employeeNumber, initialTab);
    return this.employeeRepository.save(employee);
  }

  async resetTab(cardNumber: string) {
    return this.employeeRepository.updateTab(cardNumber, 0);
  }

  async getAll() {
    return this.employeeRepository.findAll();
  }

  async delete(cardNumber: string) {
    return this.employeeRepository.delete(cardNumber);
  }

  async updateEmployeeNumber(cardNumber: string, newEmployeeNumber: string) {
    return this.employeeRepository.updateEmployeeNumber(cardNumber, newEmployeeNumber);
  }
}
