import { NextRequest, NextResponse } from 'next/server';
import { EmployeeApplicationService } from '@/lib/application/services/employee.application.service';
import { employeeRepository } from '@/lib/infrastructure/repositories/employee.repository.mongo';

const service = new EmployeeApplicationService(employeeRepository);

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q');

  if (!q || q.trim().length === 0) {
    return NextResponse.json({ error: 'Query parameter "q" is required' }, { status: 400 });
  }

  const employees = await service.search(q.trim());
  return NextResponse.json(employees);
}
