import { NextRequest, NextResponse } from 'next/server';
import { EmployeeApplicationService } from '@/lib/application/services/employee.application.service';
import { employeeRepository } from '@/lib/infrastructure/repositories/employee.repository.mongo';

const service = new EmployeeApplicationService(employeeRepository);

// There is deliberately no POST here. Charging a tab always happens through
// POST /api/sales, so money can never move without a transaction recording it.

export async function DELETE(request: NextRequest) {
  const body = await request.json();
  const { cardNumber } = body;

  if (!cardNumber) {
    return NextResponse.json(
      { error: 'cardNumber is required' },
      { status: 400 }
    );
  }

  const employee = await service.resetTab(cardNumber);

  if (!employee) {
    return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
  }

  return NextResponse.json(employee);
}
