import { NextRequest, NextResponse } from 'next/server';
import { EmployeeApplicationService } from '@/lib/application/services/employee.application.service';
import { employeeRepository } from '@/lib/infrastructure/repositories/employee.repository.mongo';

const service = new EmployeeApplicationService(employeeRepository);

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { employeeNumber, amount } = body;

  if (!employeeNumber || typeof amount !== 'number' || amount === 0) {
    return NextResponse.json(
      { error: 'employeeNumber and a non-zero amount are required' },
      { status: 400 }
    );
  }

  try {
    const employee = await service.addToTab(employeeNumber, amount);
    return NextResponse.json(employee);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 404 });
  }
}

export async function DELETE(request: NextRequest) {
  const body = await request.json();
  const { employeeNumber } = body;

  if (!employeeNumber) {
    return NextResponse.json(
      { error: 'employeeNumber is required' },
      { status: 400 }
    );
  }

  const employee = await service.resetTab(employeeNumber);

  if (!employee) {
    return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
  }

  return NextResponse.json(employee);
}
