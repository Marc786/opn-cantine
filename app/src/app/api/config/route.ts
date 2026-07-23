import { NextRequest, NextResponse } from 'next/server';
import { ConfigApplicationService } from '@/lib/application/services/config.application.service';
import { configRepository } from '@/lib/infrastructure/repositories/config.repository.mongo';
import { verifyAdminRequest, unauthorizedResponse } from '@/lib/infrastructure/auth/admin-token';
import { WeatherTheme } from '@/lib/domain/entities/config.entity';

const VALID_THEMES: WeatherTheme[] = ['default', 'sunny', 'rainy', 'snow', 'storm', 'sunset'];

const service = new ConfigApplicationService(configRepository);

export async function GET() {
  try {
    const config = await service.getConfig();
    return NextResponse.json(config);
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  if (!verifyAdminRequest(request)) return unauthorizedResponse();

  try {
    const body = await request.json();
    const { theme } = body;

    if (theme !== undefined && !VALID_THEMES.includes(theme)) {
      return NextResponse.json({ error: 'Invalid theme value' }, { status: 400 });
    }

    const config = await service.setConfig({ theme });
    return NextResponse.json(config);
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}
