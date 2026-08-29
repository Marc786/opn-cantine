import { AppConfig } from '../entities/config.entity';

export interface IConfigRepository {
  get(): Promise<AppConfig>;
  set(config: Partial<AppConfig>): Promise<AppConfig>;
}
