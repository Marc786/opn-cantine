import { NextResponse } from 'next/server';
import { EmployeeApplicationService } from '@/lib/application/services/employee.application.service';
import { employeeRepository } from '@/lib/infrastructure/repositories/employee.repository.mongo';

const service = new EmployeeApplicationService(employeeRepository);

export async function GET() {
  const employees = await service.getAll();
  return NextResponse.json(employees);
}
