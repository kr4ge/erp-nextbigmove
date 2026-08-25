import { PrismaClient } from '@prisma/client';
import { ObjectStorageService } from './src/common/services/object-storage.service';
import { MediaAssetsService } from './src/common/services/media-assets.service';
import { CreativeThumbnailService } from './src/modules/creative-agent/services/creative-thumbnail.service';

async function main() {
  const prisma = new PrismaClient();
  const storage = new ObjectStorageService();
  await storage.onModuleInit();
  console.log('storage configured:', storage.isConfigured(), '| bucket:', storage.getBucketName());
  const cls = { get: () => undefined } as never;
  const media = new MediaAssetsService(prisma as never, cls, storage);
  const svc = new CreativeThumbnailService(prisma as never, media);
  const c = await prisma.creative.findFirst({ where: { code: 'AP-V0003' }, select: { id: true, tenantId: true, mediaUrl: true } });
  if (!c) { console.log('not found'); return; }
  await svc.captureForCreative(c.id, c.tenantId, c.mediaUrl);
  const after = await prisma.creative.findUnique({ where: { id: c.id }, select: { thumbnailAssetId: true, thumbnailIsVideo: true } });
  console.log('after capture:', JSON.stringify(after));
  await prisma.$disconnect();
}
main().catch((e) => { console.error('ERR:', e.message); process.exit(1); });
