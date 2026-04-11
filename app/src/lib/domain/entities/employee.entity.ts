export interface Employee {
  employeeNumber: string;
  fullName: string;
  tab: number;
}

export class EmployeeEntity implements Employee {
  constructor(
    public readonly employeeNumber: string,
    public readonly fullName: string,
    public tab: number
  ) {
    this.validate();
  }

  private validate(): void {
    if (!this.employeeNumber || this.employeeNumber.trim().length === 0) {
      throw new Error('Card number is required');
    }

    if (!this.fullName || this.fullName.trim().length === 0) {
      throw new Error('Full name is required');
    }
  }

  static create(employeeNumber: string, fullName: string): EmployeeEntity {
    return new EmployeeEntity(employeeNumber.trim(), fullName.trim(), 0);
  }
}
