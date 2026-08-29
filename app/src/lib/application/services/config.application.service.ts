import { AppConfig } from '@/lib/domain/entities/config.entity';
import { IConfigRepository } from '@/lib/domain/ports/config.repository.port';

export class ConfigApplicationService {
  constructor(private readonly configRepository: IConfigRepository) {}

  async getConfig(): Promise<AppConfig> {
    return this.configRepository.get();
  }

  async setConfig(data: Partial<AppConfig>): Promise<AppConfig> {
    return this.configRepository.set(data);
  }
}
