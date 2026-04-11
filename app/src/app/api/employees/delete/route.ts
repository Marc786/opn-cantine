import { NextRequest, NextResponse } from 'next/server';
import { EmployeeApplicationService } from '@/lib/application/services/employee.application.service';
import { employeeRepository } from '@/lib/infrastructure/repositories/employee.repository.mongo';
import { verifyAdminRequest, unauthorizedResponse } from '@/lib/infrastructure/auth/admin-token';

const service = new EmployeeApplicationService(employeeRepository);

export async function DELETE(request: NextRequest) {
  if (!verifyAdminRequest(request)) return unauthorizedResponse();

  const body = await request.json();
  const { employeeNumber } = body;

  if (!employeeNumber) {
    return NextResponse.json(
      { error: 'employeeNumber is required' },
      { status: 400 }
    );
  }

  const deleted = await service.delete(employeeNumber);

  if (!deleted) {
    return NextResponse.json(
      { error: 'Employee not found' },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true });
}
