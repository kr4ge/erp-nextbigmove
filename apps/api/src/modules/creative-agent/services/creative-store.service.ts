import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../../common/prisma/prisma.service";
import { CREATIVE_AGENT_PERMISSIONS } from "../creative-agent.constants";
import type { CreativeActor } from "../types/creative-actor.type";
import { deriveCreativeStorePrefixCandidate } from "../utils/creative-store-prefix";
import { CreativeAccessService } from "./creative-access.service";

const PREFIX_RESERVATION_ATTEMPTS = 32;

@Injectable()
export class CreativeStoreService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CreativeAccessService,
  ) {}

  async list(actor: CreativeActor) {
    const context = await this.access.resolve(actor);
    this.access.require(
      context,
      CREATIVE_AGENT_PERMISSIONS.READ,
      CREATIVE_AGENT_PERMISSIONS.READ_ALL,
      CREATIVE_AGENT_PERMISSIONS.ENROLL,
      CREATIVE_AGENT_PERMISSIONS.STORES_MANAGE,
    );

    const stores = await this.prisma.posStore.findMany({
      where: {
        tenantId: context.tenantId,
        status: "ACTIVE",
        OR: [{ enabled: true }, { enabled: null }],
      },
      select: {
        id: true,
        shopId: true,
        shopName: true,
        shopAvatarUrl: true,
        status: true,
        enabled: true,
        creativeStoreConfig: {
          select: {
            id: true,
            codePrefix: true,
            active: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
      orderBy: { shopName: "asc" },
    });

    const configuredStoreIds = stores
      .map((store) => store.creativeStoreConfig?.id)
      .filter((id): id is string => Boolean(id));
    const codeCounters =
      configuredStoreIds.length > 0
        ? await this.prisma.creative.groupBy({
            by: ["storeConfigId"],
            where: {
              tenantId: context.tenantId,
              storeConfigId: { in: configuredStoreIds },
            },
            _max: { codeNumber: true },
          })
        : [];
    const existingConfigs = await this.prisma.creativeStoreConfig.findMany({
      where: { tenantId: context.tenantId },
      select: { codePrefix: true },
    });
    const latestCodeNumberByConfig = new Map<string, number>(
      codeCounters.map(
        (counter) =>
          [counter.storeConfigId, counter._max.codeNumber ?? 0] as const,
      ),
    );
    const reservedPrefixes = new Set(
      existingConfigs.map((config) => config.codePrefix),
    );

    return stores.map((store) => {
      const config = store.creativeStoreConfig;
      let codePrefix = config?.codePrefix;
      if (!codePrefix) {
        for (
          let attempt = 0;
          attempt < PREFIX_RESERVATION_ATTEMPTS;
          attempt += 1
        ) {
          const candidate = deriveCreativeStorePrefixCandidate(
            store.shopName,
            store.id,
            attempt,
          );
          if (!reservedPrefixes.has(candidate)) {
            codePrefix = candidate;
            reservedPrefixes.add(candidate);
            break;
          }
        }
      }
      if (!codePrefix) {
        throw new ConflictException(
          `Could not preview an automatic code prefix for ${store.shopName}`,
        );
      }

      const nextCodeNumber = config
        ? (latestCodeNumberByConfig.get(config.id) ?? 0) + 1
        : 1;

      return {
        id: store.id,
        shopId: store.shopId,
        name: store.shopName,
        avatarUrl: store.shopAvatarUrl,
        status: store.status,
        enabled: store.enabled !== false,
        registry: config,
        nextCode: `${codePrefix}-V${String(nextCodeNumber).padStart(4, "0")}`,
      };
    });
  }

  async getOrCreateActiveConfig(tenantId: string, storeId: string) {
    const store = await this.prisma.posStore.findFirst({
      where: {
        id: storeId,
        tenantId,
        status: "ACTIVE",
        OR: [{ enabled: true }, { enabled: null }],
      },
      select: {
        id: true,
        shopId: true,
        shopName: true,
        creativeStoreConfig: true,
      },
    });
    if (!store) throw new NotFoundException("Active POS store not found");
    if (store.creativeStoreConfig) {
      if (store.creativeStoreConfig.active) return store.creativeStoreConfig;
      return this.prisma.creativeStoreConfig.update({
        where: { id: store.creativeStoreConfig.id },
        data: { active: true },
      });
    }

    for (let attempt = 0; attempt < PREFIX_RESERVATION_ATTEMPTS; attempt += 1) {
      const codePrefix = deriveCreativeStorePrefixCandidate(
        store.shopName,
        store.id,
        attempt,
      );
      try {
        return await this.prisma.creativeStoreConfig.create({
          data: {
            tenantId,
            storeId: store.id,
            storeNameSnapshot: store.shopName,
            shopIdSnapshot: store.shopId,
            codePrefix,
            active: true,
          },
        });
      } catch (error) {
        if (
          !(error instanceof Prisma.PrismaClientKnownRequestError) ||
          error.code !== "P2002"
        )
          throw error;
        const concurrentConfig =
          await this.prisma.creativeStoreConfig.findUnique({
            where: { storeId },
          });
        if (concurrentConfig) return concurrentConfig;
      }
    }
    throw new ConflictException(
      "Could not reserve an automatic code prefix for this store",
    );
  }
}
