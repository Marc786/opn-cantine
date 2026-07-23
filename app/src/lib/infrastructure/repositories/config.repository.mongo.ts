import { AppConfig, DEFAULT_CONFIG } from '@/lib/domain/entities/config.entity';
import { IConfigRepository } from '@/lib/domain/ports/config.repository.port';
import { getDb } from '../db/mongo';

const DOC_ID = 'app-config';

export class MongoConfigRepository implements IConfigRepository {
  private readonly collectionName = 'config';

  private async collection() {
    const db = await getDb();
    return db.collection<{ _id: string } & AppConfig>(this.collectionName);
  }

  async get(): Promise<AppConfig> {
    const col = await this.collection();
    const doc = await col.findOne({ _id: DOC_ID } as never);
    if (!doc) return { ...DEFAULT_CONFIG };
    const { _id: _ignored, ...config } = doc;
    return config as AppConfig;
  }

  async set(config: Partial<AppConfig>): Promise<AppConfig> {
    const col = await this.collection();
    await col.updateOne(
      { _id: DOC_ID } as never,
      { $set: config },
      { upsert: true }
    );
    return this.get();
  }
}

export const configRepository = new MongoConfigRepository();
