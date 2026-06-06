import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  NotificationDomain,
  NotificationSystem,
  Prisma,
  WmsPurchasingBatchStatus,
  WmsProductProfileStatus,
  WmsPurchasingRequestType,
  WmsPurchasingSourceType,
  WmsWarehouseStatus,
} from '@prisma/client';
import { ClsService } from 'nestjs-cls';
import { PrismaService } from '../../common/prisma/prisma.service';
import { MediaAssetsService, type UploadedImageFile } from '../../common/services/media-assets.service';
import { NotificationStateService } from '../../common/services/notification-state.service';
import { WorkflowExecutionGateway } from '../workflows/gateways/workflow-execution.gateway';
import {
  CreateWmsPurchasingBatchDto,
  type CreateWmsPurchasingBatchLineInput,
} from './dto/create-wms-purchasing-batch.dto';
import { GetWmsPurchasingOverviewDto } from './dto/get-wms-purchasing-overview.dto';
import { GetWmsPurchasingProductOptionsDto } from './dto/get-wms-purchasing-product-options.dto';
import { MarkWmsSelfBuyShipmentDto } from './dto/mark-wms-self-buy-shipment.dto';
import { RespondWmsPurchasingRevisionDto } from './dto/respond-wms-purchasing-revision.dto';
import { SubmitWmsPurchasingPaymentProofDto } from './dto/submit-wms-purchasing-payment-proof.dto';
import { UpdateWmsPurchasingLineDto } from './dto/update-wms-purchasing-line.dto';
import { UpdateWmsPurchasingStatusDto } from './dto/update-wms-purchasing-status.dto';

const REQUEST_TYPE_ORDER: WmsPurchasingRequestType[] = [
  WmsPurchasingRequestType.PROCUREMENT,
  WmsPurchasingRequestType.SELF_BUY,
];

const STATUS_ORDER: WmsPurchasingBatchStatus[] = [
  WmsPurchasingBatchStatus.UNDER_REVIEW,
  WmsPurchasingBatchStatus.REVISION,
  WmsPurchasingBatchStatus.AWAITING_PRODUCTS,
  WmsPurchasingBatchStatus.SHIPPED,
  WmsPurchasingBatchStatus.RECEIVING_EXCEPTION,
  WmsPurchasingBatchStatus.PENDING_PAYMENT,
  WmsPurchasingBatchStatus.PAYMENT_REVIEW,
  WmsPurchasingBatchStatus.RECEIVING_READY,
  WmsPurchasingBatchStatus.RECEIVING,
  WmsPurchasingBatchStatus.STOCKED,
  WmsPurchasingBatchStatus.REJECTED,
  WmsPurchasingBatchStatus.CANCELED,
];

const PROCUREMENT_STATUS_TRANSITIONS: Record<
  WmsPurchasingBatchStatus,
  readonly WmsPurchasingBatchStatus[]
> = {
  [WmsPurchasingBatchStatus.UNDER_REVIEW]: [
    WmsPurchasingBatchStatus.PENDING_PAYMENT,
    WmsPurchasingBatchStatus.CANCELED,
  ],
  [WmsPurchasingBatchStatus.REVISION]: [
    WmsPurchasingBatchStatus.PENDING_PAYMENT,
    WmsPurchasingBatchStatus.REJECTED,
    WmsPurchasingBatchStatus.CANCELED,
  ],
  [WmsPurchasingBatchStatus.AWAITING_PRODUCTS]: [],
  [WmsPurchasingBatchStatus.SHIPPED]: [],
  [WmsPurchasingBatchStatus.RECEIVING_EXCEPTION]: [],
  [WmsPurchasingBatchStatus.PENDING_PAYMENT]: [],
  [WmsPurchasingBatchStatus.PAYMENT_REVIEW]: [
    WmsPurchasingBatchStatus.PENDING_PAYMENT,
    WmsPurchasingBatchStatus.RECEIVING_READY,
    WmsPurchasingBatchStatus.REJECTED,
    WmsPurchasingBatchStatus.CANCELED,
  ],
  [WmsPurchasingBatchStatus.RECEIVING_READY]: [],
  [WmsPurchasingBatchStatus.RECEIVING]: [
    WmsPurchasingBatchStatus.STOCKED,
    WmsPurchasingBatchStatus.CANCELED,
  ],
  [WmsPurchasingBatchStatus.STOCKED]: [],
  [WmsPurchasingBatchStatus.REJECTED]: [],
  [WmsPurchasingBatchStatus.CANCELED]: [],
};

const SELF_BUY_STATUS_TRANSITIONS: Record<
  WmsPurchasingBatchStatus,
  readonly WmsPurchasingBatchStatus[]
> = {
  [WmsPurchasingBatchStatus.UNDER_REVIEW]: [
    WmsPurchasingBatchStatus.AWAITING_PRODUCTS,
    WmsPurchasingBatchStatus.CANCELED,
  ],
  [WmsPurchasingBatchStatus.REVISION]: [
    WmsPurchasingBatchStatus.AWAITING_PRODUCTS,
    WmsPurchasingBatchStatus.REJECTED,
    WmsPurchasingBatchStatus.CANCELED,
  ],
  [WmsPurchasingBatchStatus.AWAITING_PRODUCTS]: [],
  [WmsPurchasingBatchStatus.SHIPPED]: [
    WmsPurchasingBatchStatus.RECEIVING_EXCEPTION,
    WmsPurchasingBatchStatus.CANCELED,
  ],
  [WmsPurchasingBatchStatus.RECEIVING_EXCEPTION]: [
    WmsPurchasingBatchStatus.AWAITING_PRODUCTS,
    WmsPurchasingBatchStatus.CANCELED,
  ],
  [WmsPurchasingBatchStatus.PENDING_PAYMENT]: [],
  [WmsPurchasingBatchStatus.PAYMENT_REVIEW]: [],
  [WmsPurchasingBatchStatus.RECEIVING_READY]: [],
  [WmsPurchasingBatchStatus.RECEIVING]: [
    WmsPurchasingBatchStatus.STOCKED,
    WmsPurchasingBatchStatus.RECEIVING_EXCEPTION,
    WmsPurchasingBatchStatus.CANCELED,
  ],
  [WmsPurchasingBatchStatus.STOCKED]: [],
  [WmsPurchasingBatchStatus.REJECTED]: [],
  [WmsPurchasingBatchStatus.CANCELED]: [],
};

type PurchasingBatchListRecord = Prisma.WmsPurchasingBatchGetPayload<{
  include: {
    store: {
      select: {
        id: true;
        name: true;
        shopName: true;
      };
    };
    lines: {
      select: {
        requestedQuantity: true;
        approvedQuantity: true;
        receivedQuantity: true;
      };
    };
  };
}>;

type PurchasingBatchDetailRecord = Prisma.WmsPurchasingBatchGetPayload<{
  include: {
    store: {
      select: {
        id: true;
        name: true;
        shopName: true;
      };
    };
    lines: {
      orderBy: {
        lineNo: 'asc';
      };
      include: {
        resolvedPosProduct: {
          select: {
            id: true;
            name: true;
            customId: true;
            productSnapshot: true;
          };
        };
        resolvedProfile: {
          select: {
            id: true;
            status: true;
            isSerialized: true;
          };
        };
      };
    };
    events: {
      orderBy: {
        createdAt: 'desc';
      };
      include: {
        actor: {
          select: {
            id: true;
            firstName: true;
            lastName: true;
            email: true;
          };
        };
      };
    };
    paymentProofSubmittedBy: {
      select: {
        id: true;
        firstName: true;
        lastName: true;
        email: true;
      };
    };
    paymentProofAsset: {
      select: {
        id: true;
        objectKey: true;
      };
    };
  };
}>;

type InvoiceBankDetailsRecord = {
  id: string;
  code: string;
  name: string;
  billingCompanyName: string | null;
  billingAddress: string | null;
  bankName: string | null;
  bankAccountName: string | null;
  bankAccountNumber: string | null;
  bankAccountType: string | null;
  bankBranch: string | null;
  paymentInstructions: string | null;
};

@Injectable()
export class WmsPurchasingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cls: ClsService,
    private readonly mediaAssetsService: MediaAssetsService,
    private readonly notificationStateService: NotificationStateService,
    private readonly workflowExecutionGateway: WorkflowExecutionGateway,
  ) {}

  async getOverview(query: GetWmsPurchasingOverviewDto) {
    const scope = await this.resolveTenantScope(query.tenantId);
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(5, query.pageSize ?? 10));

    if (!scope.activeTenantId) {
      return {
        tenantReady: false,
        summary: {
          batches: 0,
          procurement: 0,
          selfBuy: 0,
          readyForReceiving: 0,
          underReview: 0,
        },
        filters: {
          tenants: scope.tenants,
          stores: [],
          requestTypes: REQUEST_TYPE_ORDER.map((type) => ({
            value: type,
            label: this.formatRequestTypeLabel(type),
            batchCount: 0,
          })),
          statuses: STATUS_ORDER.map((status) => ({
            value: status,
            label: this.formatStatusLabel(status),
            batchCount: 0,
          })),
          activeTenantId: null,
          activeStoreId: null,
          activeRequestType: null,
          activeStatus: null,
        },
        pagination: {
          page,
          pageSize,
          total: 0,
          totalPages: 1,
        },
        batches: [],
      };
    }

    const stores = await this.prisma.posStore.findMany({
      where: { tenantId: scope.activeTenantId },
      select: {
        id: true,
        name: true,
        shopName: true,
        _count: {
          select: {
            wmsPurchasingBatches: true,
          },
        },
      },
      orderBy: [{ name: 'asc' }],
    });

    const activeStoreId =
      query.storeId && stores.some((store) => store.id === query.storeId)
        ? query.storeId
        : null;

    const normalizedSearch = this.cleanOptionalText(query.search);
    const storeBatchFilter: Prisma.WmsPurchasingBatchWhereInput = activeStoreId
      ? {
          OR: [
            { storeId: activeStoreId },
            {
              lines: {
                some: {
                  storeId: activeStoreId,
                },
              },
            },
          ],
        }
      : {};

    const summaryAnd: Prisma.WmsPurchasingBatchWhereInput[] = [];
    if (activeStoreId) {
      summaryAnd.push(storeBatchFilter);
    }
    if (normalizedSearch) {
      summaryAnd.push({
        OR: [
          { sourceRequestId: { contains: normalizedSearch, mode: 'insensitive' } },
          { requestTitle: { contains: normalizedSearch, mode: 'insensitive' } },
          { invoiceNumber: { contains: normalizedSearch, mode: 'insensitive' } },
          { store: { name: { contains: normalizedSearch, mode: 'insensitive' } } },
          { store: { shopName: { contains: normalizedSearch, mode: 'insensitive' } } },
          {
            lines: {
              some: {
                OR: [
                  { requestedProductName: { contains: normalizedSearch, mode: 'insensitive' } },
                  { productId: { contains: normalizedSearch, mode: 'insensitive' } },
                  { variationId: { contains: normalizedSearch, mode: 'insensitive' } },
                ],
              },
            },
          },
        ],
      });
    }

    const summaryWhere: Prisma.WmsPurchasingBatchWhereInput = {
      tenantId: scope.activeTenantId,
      ...(query.requestType ? { requestType: query.requestType } : {}),
      ...(summaryAnd.length ? { AND: summaryAnd } : {}),
    };

    const listWhere: Prisma.WmsPurchasingBatchWhereInput = {
      ...summaryWhere,
      ...(query.status ? { status: query.status } : {}),
    };

    const [summaryCounts, listTotal, batches, typeCounts, statusCounts] = await Promise.all([
      this.computeSummaryCounts(summaryWhere),
      this.prisma.wmsPurchasingBatch.count({ where: listWhere }),
      this.prisma.wmsPurchasingBatch.findMany({
        where: listWhere,
        include: {
          store: {
            select: {
              id: true,
              name: true,
              shopName: true,
            },
          },
          lines: {
            select: {
              requestedQuantity: true,
              approvedQuantity: true,
              receivedQuantity: true,
            },
          },
        },
        orderBy: [{ updatedAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.wmsPurchasingBatch.groupBy({
        by: ['requestType'],
        where: {
          tenantId: scope.activeTenantId,
          ...storeBatchFilter,
        },
        _count: {
          _all: true,
        },
      }),
      this.prisma.wmsPurchasingBatch.groupBy({
        by: ['status'],
        where: {
          tenantId: scope.activeTenantId,
          ...storeBatchFilter,
        },
        _count: {
          _all: true,
        },
      }),
    ]);

    const totalPages = Math.max(1, Math.ceil(listTotal / pageSize));
    const typeCountMap = new Map(typeCounts.map((row) => [row.requestType, row._count._all]));
    const statusCountMap = new Map(statusCounts.map((row) => [row.status, row._count._all]));

    return {
      tenantReady: true,
      summary: summaryCounts,
      filters: {
        tenants: scope.tenants,
        stores: stores.map((store) => ({
          id: store.id,
          label: store.shopName || store.name,
          batchCount: store._count.wmsPurchasingBatches,
        })),
        requestTypes: REQUEST_TYPE_ORDER.map((type) => ({
          value: type,
          label: this.formatRequestTypeLabel(type),
          batchCount: typeCountMap.get(type) ?? 0,
        })),
        statuses: STATUS_ORDER.map((status) => ({
          value: status,
          label: this.formatStatusLabel(status),
          batchCount: statusCountMap.get(status) ?? 0,
        })),
        activeTenantId: scope.activeTenantId,
        activeStoreId,
        activeRequestType: query.requestType ?? null,
        activeStatus: query.status ?? null,
      },
      pagination: {
        page,
        pageSize,
        total: listTotal,
        totalPages,
      },
      batches: batches.map((batch) => this.mapBatchListRow(batch)),
    };
  }

  async getUnreadNotificationCount(system: NotificationSystem, requestedTenantId?: string) {
    const scope = await this.resolveTenantScope(requestedTenantId);
    if (!scope.activeTenantId) {
      return { count: 0 };
    }

    return {
      count: await this.notificationStateService.getUnreadCount({
        tenantId: scope.activeTenantId,
        system,
        domain: NotificationDomain.PURCHASING,
      }),
    };
  }

  async getProductOptions(query: GetWmsPurchasingProductOptionsDto) {
    const scope = await this.resolveTenantScope(query.tenantId);
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(50, Math.max(5, query.pageSize ?? 10));

    if (!scope.activeTenantId) {
      return {
        tenantReady: false,
        filters: {
          tenants: scope.tenants,
          stores: [],
          activeTenantId: null,
          activeStoreId: null,
        },
        pagination: {
          page,
          pageSize,
          total: 0,
          totalPages: 1,
        },
        products: [],
      };
    }

    const stores = await this.prisma.posStore.findMany({
      where: { tenantId: scope.activeTenantId },
      select: {
        id: true,
        name: true,
        shopName: true,
      },
      orderBy: [{ name: 'asc' }],
    });

    const activeStoreId =
      query.storeId && stores.some((store) => store.id === query.storeId)
        ? query.storeId
        : null;
    const normalizedSearch = this.cleanOptionalText(query.search);

    const where: Prisma.WmsProductProfileWhereInput = {
      tenantId: scope.activeTenantId,
      status: {
        in: [WmsProductProfileStatus.DEFAULT, WmsProductProfileStatus.READY],
      },
      ...(activeStoreId ? { storeId: activeStoreId } : {}),
      ...(normalizedSearch
        ? {
            OR: [
              { productId: { contains: normalizedSearch, mode: 'insensitive' } },
              { variationId: { contains: normalizedSearch, mode: 'insensitive' } },
              {
                posProduct: {
                  OR: [
                    { name: { contains: normalizedSearch, mode: 'insensitive' } },
                    { customId: { contains: normalizedSearch, mode: 'insensitive' } },
                  ],
                },
              },
            ],
          }
        : {}),
    };

    const profileCandidates = await this.prisma.wmsProductProfile.findMany({
      where,
      include: {
        posProduct: {
          select: {
            id: true,
            productId: true,
            variationId: true,
            customId: true,
            name: true,
            productSnapshot: true,
            retailPrice: true,
            store: {
              select: {
                id: true,
                name: true,
                shopName: true,
              },
            },
          },
        },
      },
      orderBy: [{ updatedAt: 'desc' }],
    });

    const profiles = profileCandidates.filter(
      (profile) =>
        this.isStockableVariation(profile.posProduct.productId, profile.posProduct.variationId)
        && this.isStockableVariation(profile.productId, profile.variationId),
    );
    const total = profiles.length;
    const paginatedProfiles = profiles.slice((page - 1) * pageSize, page * pageSize);

    return {
      tenantReady: true,
      filters: {
        tenants: scope.tenants,
        stores: stores.map((store) => ({
          id: store.id,
          label: store.shopName || store.name,
        })),
        activeTenantId: scope.activeTenantId,
        activeStoreId,
      },
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
      products: paginatedProfiles.map((profile) => {
        const snapshot = profile.posProduct.productSnapshot as
          | {
              display_id?: string | null;
              product?: {
                display_id?: string | null;
              } | null;
            }
          | null;

        const variationDisplayId =
          typeof snapshot?.display_id === 'string'
            ? snapshot.display_id
            : typeof snapshot?.product?.display_id === 'string'
              ? snapshot.product.display_id
              : null;

        return {
          profileId: profile.id,
          posProductId: profile.posProduct.id,
          status: profile.status,
          isSerialized: profile.isSerialized,
          productId: profile.productId,
          variationId: profile.variationId,
          variationDisplayId,
          productCustomId: profile.posProduct.customId,
          name: profile.posProduct.name,
          retailPrice: this.toNumber(profile.posProduct.retailPrice),
          inhouseUnitCost: this.toNumber(profile.inhouseUnitCost),
          supplierUnitCost: this.toNumber(profile.supplierUnitCost),
          store: {
            id: profile.posProduct.store.id,
            name: profile.posProduct.store.shopName || profile.posProduct.store.name,
          },
        };
      }),
    };
  }

  async getBatchById(id: string, requestedTenantId?: string) {
    const scope = await this.resolveTenantScope(requestedTenantId);
    if (!scope.activeTenantId) {
      throw new ForbiddenException('Tenant context is required');
    }

    const batch = await this.prisma.wmsPurchasingBatch.findUnique({
      where: { id },
      include: {
        store: {
          select: {
            id: true,
            name: true,
            shopName: true,
          },
        },
        lines: {
          orderBy: { lineNo: 'asc' },
          include: {
            resolvedPosProduct: {
              select: {
                id: true,
                name: true,
                customId: true,
                productSnapshot: true,
              },
            },
            resolvedProfile: {
              select: {
                id: true,
                status: true,
                isSerialized: true,
              },
            },
          },
        },
        events: {
          orderBy: { createdAt: 'desc' },
          include: {
            actor: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
        paymentProofSubmittedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        paymentProofAsset: {
          select: {
            id: true,
            objectKey: true,
          },
        },
      },
    });

    if (!batch) {
      throw new NotFoundException('Purchasing batch was not found');
    }

    this.assertBatchTenantScope(batch.tenantId, scope.activeTenantId);
    const invoiceBankDetails = await this.resolveInvoiceBankDetails();

    return {
      batch: await this.mapBatchDetail(batch, invoiceBankDetails),
    };
  }

  async markBatchNotificationsRead(
    id: string,
    system: NotificationSystem,
    requestedTenantId?: string,
  ) {
    const scope = await this.resolveTenantScope(requestedTenantId);
    if (!scope.activeTenantId) {
      throw new ForbiddenException('Tenant context is required');
    }

    const actorId = (this.cls.get('userId') as string | undefined) ?? null;
    const batch = await this.prisma.wmsPurchasingBatch.findUnique({
      where: { id },
      select: {
        id: true,
        tenantId: true,
        status: true,
        sourceStatus: true,
      },
    });

    if (!batch) {
      throw new NotFoundException('Purchasing batch was not found');
    }

    this.assertBatchTenantScope(batch.tenantId, scope.activeTenantId);

    const updatedCount = await this.notificationStateService.markEntityRead({
      tenantId: batch.tenantId,
      system,
      domain: NotificationDomain.PURCHASING,
      entityType: this.notificationStateService.getPurchasingEntityType(),
      entityId: batch.id,
      readByUserId: actorId,
    });

    if (updatedCount > 0) {
      this.emitStockRequestUpdate({
        tenantId: batch.tenantId,
        batchId: batch.id,
        status: batch.status,
        sourceStatus: batch.sourceStatus ?? null,
        eventType: 'NOTIFICATION_READ',
      });
    }

    return {
      success: true,
    };
  }

  async uploadPartnerPaymentProofImage(
    file: UploadedImageFile | undefined,
    requestedTenantId?: string,
  ) {
    const scope = await this.resolveTenantScope(requestedTenantId);
    if (!scope.activeTenantId) {
      throw new ForbiddenException('Tenant context is required');
    }

    return this.mediaAssetsService.uploadPaymentProofImage(file, scope.activeTenantId);
  }

  async createBatch(body: CreateWmsPurchasingBatchDto, requestedTenantId?: string) {
    const scope = await this.resolveTenantScope(requestedTenantId);
    if (!scope.activeTenantId) {
      throw new ForbiddenException('Tenant context is required');
    }

    if (!body.lines.length) {
      throw new BadRequestException('At least one purchasing line is required');
    }

    const actorId = (this.cls.get('userId') as string | undefined) ?? null;

    await this.validateStore(scope.activeTenantId, body.storeId);

    const status = body.status ?? WmsPurchasingBatchStatus.UNDER_REVIEW;
    const sourceType = body.sourceType ?? WmsPurchasingSourceType.ERP_REQUEST;
    const sourceRequestId = this.cleanOptionalText(body.sourceRequestId);

    if (sourceRequestId) {
      const existing = await this.prisma.wmsPurchasingBatch.findUnique({
        where: {
          tenantId_sourceType_sourceRequestId: {
            tenantId: scope.activeTenantId,
            sourceType,
            sourceRequestId,
          },
        },
        select: {
          id: true,
        },
      });

      if (existing) {
        return this.getBatchById(existing.id, scope.activeTenantId);
      }
    }

    const lineData = await this.normalizeCreateLines({
      tenantId: scope.activeTenantId,
      storeId: body.storeId,
      requestType: body.requestType,
      lines: body.lines,
    });

    if (this.requiresOperationalReadinessValidation(body.requestType, status)) {
      this.validateReadyForReceiving({
        requestType: body.requestType,
        lines: lineData,
        invoiceNumber: body.invoiceNumber,
        paymentVerifiedAt: body.paymentVerifiedAt,
      });
    }

    const now = new Date();
    const paymentProofAsset = await this.resolvePaymentProofAsset(
      body.paymentProofAssetId,
      scope.activeTenantId,
    );
    const paymentProofImageUrl = this.cleanOptionalText(body.paymentProofImageUrl);
    const hasPaymentProof = Boolean(paymentProofAsset || paymentProofImageUrl);
    let createdId = '';
    await this.prisma.$transaction(async (tx) => {
      const created = await tx.wmsPurchasingBatch.create({
        data: {
          tenantId: scope.activeTenantId!,
          storeId: body.storeId,
          requestType: body.requestType,
          status,
          sourceType,
          sourceRequestId,
          sourceRequestType: body.sourceRequestType ?? null,
          sourceStatus: this.cleanOptionalText(body.sourceStatus),
          sourceSnapshot: this.toJsonValue(body.sourceSnapshot),
          requestTitle: this.cleanOptionalText(body.requestTitle),
          partnerNotes: this.cleanOptionalText(body.partnerNotes),
          wmsNotes: this.cleanOptionalText(body.wmsNotes),
          invoiceNumber: this.cleanOptionalText(body.invoiceNumber),
          invoiceAmount: this.numberOrNull(body.invoiceAmount),
          paymentProofImageUrl: paymentProofAsset ? null : paymentProofImageUrl,
          paymentProofAssetId: paymentProofAsset?.id ?? null,
          paymentSubmittedAt: this.parseOptionalDate(body.paymentSubmittedAt),
          paymentProofSubmittedAt: hasPaymentProof
            ? this.parseOptionalDate(body.paymentSubmittedAt) ?? now
            : null,
          paymentProofSubmittedById: hasPaymentProof
            ? actorId
            : null,
          paymentVerifiedAt: this.parseOptionalDate(body.paymentVerifiedAt),
          readyForReceivingAt: this.isReadyForReceivingQueueStatus(status) ? now : null,
          submittedById: actorId,
          reviewedById:
            status === WmsPurchasingBatchStatus.REVISION
            || status === WmsPurchasingBatchStatus.AWAITING_PRODUCTS
            || status === WmsPurchasingBatchStatus.PENDING_PAYMENT
            || status === WmsPurchasingBatchStatus.PAYMENT_REVIEW
            || status === WmsPurchasingBatchStatus.RECEIVING_EXCEPTION
            || status === WmsPurchasingBatchStatus.RECEIVING_READY
            || status === WmsPurchasingBatchStatus.RECEIVING
            || status === WmsPurchasingBatchStatus.STOCKED
              ? actorId
              : null,
          approvedById:
            status === WmsPurchasingBatchStatus.AWAITING_PRODUCTS
            || status === WmsPurchasingBatchStatus.PENDING_PAYMENT
            || status === WmsPurchasingBatchStatus.PAYMENT_REVIEW
            || status === WmsPurchasingBatchStatus.RECEIVING_READY
            || status === WmsPurchasingBatchStatus.RECEIVING
            || status === WmsPurchasingBatchStatus.STOCKED
              ? actorId
              : null,
          createdById: actorId,
          updatedById: actorId,
          lines: {
            createMany: {
              data: lineData.map((line) => ({
                ...line,
                createdById: actorId,
                updatedById: actorId,
              })),
            },
          },
        },
        select: { id: true },
      });

      const event = await tx.wmsPurchasingEvent.create({
        data: {
          batchId: created.id,
          tenantId: scope.activeTenantId!,
          eventType: 'STATUS_CHANGED',
          toStatus: status,
          message: 'Purchasing batch created',
          actorId,
        },
      });

      await this.syncPurchasingNotificationEvent(tx, event);
      createdId = created.id;
    });

    this.emitStockRequestUpdate({
      tenantId: scope.activeTenantId,
      batchId: createdId,
      status,
      sourceStatus: this.cleanOptionalText(body.sourceStatus) ?? null,
      eventType: 'STATUS_CHANGED',
    });

    return this.getBatchById(createdId, scope.activeTenantId);
  }

  async submitPartnerPaymentProof(
    id: string,
    body: SubmitWmsPurchasingPaymentProofDto,
    requestedTenantId?: string,
  ) {
    const scope = await this.resolveTenantScope(requestedTenantId);
    if (!scope.activeTenantId) {
      throw new ForbiddenException('Tenant context is required');
    }

    const actorId = (this.cls.get('userId') as string | undefined) ?? null;
    const batch = await this.prisma.wmsPurchasingBatch.findUnique({
      where: { id },
      select: {
        id: true,
        tenantId: true,
        status: true,
        requestType: true,
      },
    });

    if (!batch) {
      throw new NotFoundException('Purchasing batch was not found');
    }

    this.assertBatchTenantScope(batch.tenantId, scope.activeTenantId);

    if (
      batch.status === WmsPurchasingBatchStatus.REJECTED
      || batch.status === WmsPurchasingBatchStatus.CANCELED
      || batch.status === WmsPurchasingBatchStatus.STOCKED
    ) {
      throw new BadRequestException('Cannot submit payment proof for a closed purchasing batch');
    }

    if (batch.requestType === WmsPurchasingRequestType.SELF_BUY) {
      throw new BadRequestException('Self-buy requests do not require payment proof');
    }

    if (batch.status !== WmsPurchasingBatchStatus.PENDING_PAYMENT) {
      throw new BadRequestException('Payment proof can only be submitted while payment is pending');
    }

    const paymentProofAsset = await this.resolvePaymentProofAsset(
      body.paymentProofAssetId,
      scope.activeTenantId,
    );
    const paymentProofImageUrl = this.cleanOptionalText(body.paymentProofImageUrl);
    if (!paymentProofAsset && !paymentProofImageUrl) {
      throw new BadRequestException('Uploaded payment proof image is required');
    }

    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.wmsPurchasingBatch.update({
        where: { id: batch.id },
        data: {
          status: WmsPurchasingBatchStatus.PAYMENT_REVIEW,
          paymentProofImageUrl: paymentProofAsset ? null : paymentProofImageUrl,
          paymentProofAssetId: paymentProofAsset?.id ?? null,
          paymentSubmittedAt: now,
          paymentProofSubmittedAt: now,
          paymentProofSubmittedById: actorId,
          sourceStatus: 'PAYMENT_REVIEW',
          updatedById: actorId,
        },
      });

      const event = await tx.wmsPurchasingEvent.create({
        data: {
          batchId: batch.id,
          tenantId: batch.tenantId,
          eventType: 'PAYMENT_PROOF_SUBMITTED',
          fromStatus: batch.status,
          toStatus: WmsPurchasingBatchStatus.PAYMENT_REVIEW,
          message: this.cleanOptionalText(body.message) ?? 'Partner submitted payment proof',
          actorId,
          payload: {
            paymentProofImageUrl: paymentProofImageUrl ?? null,
            paymentProofAssetId: paymentProofAsset?.id ?? null,
          },
        },
      });

      await this.syncPurchasingNotificationEvent(tx, event);
    });

    this.emitStockRequestUpdate({
      tenantId: batch.tenantId,
      batchId: batch.id,
      status: WmsPurchasingBatchStatus.PAYMENT_REVIEW,
      sourceStatus: 'PAYMENT_REVIEW',
      eventType: 'PAYMENT_PROOF_SUBMITTED',
    });

    return this.getBatchById(batch.id, scope.activeTenantId);
  }

  async respondToRevision(
    id: string,
    body: RespondWmsPurchasingRevisionDto,
    requestedTenantId?: string,
  ) {
    const scope = await this.resolveTenantScope(requestedTenantId);
    if (!scope.activeTenantId) {
      throw new ForbiddenException('Tenant context is required');
    }

    const batch = await this.prisma.wmsPurchasingBatch.findUnique({
      where: { id },
      select: {
        id: true,
        tenantId: true,
        requestType: true,
        status: true,
      },
    });

    if (!batch) {
      throw new NotFoundException('Purchasing batch was not found');
    }

    this.assertBatchTenantScope(batch.tenantId, scope.activeTenantId);

    if (batch.status !== WmsPurchasingBatchStatus.REVISION) {
      throw new BadRequestException('Only revised requests can be accepted or rejected by the partner');
    }

    return this.updateStatus(
      id,
      {
        status:
          body.decision === 'ACCEPT'
            ? (
              batch.requestType === WmsPurchasingRequestType.SELF_BUY
                ? WmsPurchasingBatchStatus.AWAITING_PRODUCTS
                : WmsPurchasingBatchStatus.PENDING_PAYMENT
            )
            : WmsPurchasingBatchStatus.REJECTED,
        message:
          this.cleanOptionalText(body.message)
          ?? (
            body.decision === 'ACCEPT'
              ? 'Partner accepted the revised request'
              : 'Partner rejected the revised request'
          ),
        sourceStatus:
          body.decision === 'ACCEPT'
            ? (
              batch.requestType === WmsPurchasingRequestType.SELF_BUY
                ? 'AWAITING_PRODUCTS'
                : 'REVISION_ACCEPTED'
            )
            : 'REVISION_REJECTED',
      },
      scope.activeTenantId,
      { bypassRevisionAcceptanceGuard: true },
    );
  }

  async markSelfBuyShipment(
    id: string,
    body: MarkWmsSelfBuyShipmentDto,
    requestedTenantId?: string,
  ) {
    const scope = await this.resolveTenantScope(requestedTenantId);
    if (!scope.activeTenantId) {
      throw new ForbiddenException('Tenant context is required');
    }

    const actorId = (this.cls.get('userId') as string | undefined) ?? null;
    const batch = await this.prisma.wmsPurchasingBatch.findUnique({
      where: { id },
      select: {
        id: true,
        tenantId: true,
        requestType: true,
        status: true,
      },
    });

    if (!batch) {
      throw new NotFoundException('Purchasing batch was not found');
    }

    this.assertBatchTenantScope(batch.tenantId, scope.activeTenantId);

    if (batch.requestType !== WmsPurchasingRequestType.SELF_BUY) {
      throw new BadRequestException('Only self-buy requests can be marked as shipped');
    }

    if (
      batch.status !== WmsPurchasingBatchStatus.AWAITING_PRODUCTS
      && batch.status !== WmsPurchasingBatchStatus.RECEIVING_EXCEPTION
    ) {
      throw new BadRequestException('Self-buy shipment can only be marked after WMS approval or exception follow-up');
    }

    const shipmentReference = this.cleanOptionalText(body.shipmentReference);
    const message =
      this.cleanOptionalText(body.message)
      ?? (
        batch.status === WmsPurchasingBatchStatus.RECEIVING_EXCEPTION
          ? 'Partner confirmed a replacement shipment to warehouse'
          : 'Partner marked products as shipped to warehouse'
      );
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.wmsPurchasingBatch.update({
        where: { id: batch.id },
        data: {
          status: WmsPurchasingBatchStatus.SHIPPED,
          sourceStatus: 'SHIPPED',
          readyForReceivingAt: now,
          updatedById: actorId,
        },
      });

      const event = await tx.wmsPurchasingEvent.create({
        data: {
          batchId: batch.id,
          tenantId: batch.tenantId,
          eventType: 'SELF_BUY_SHIPPED',
          fromStatus: batch.status,
          toStatus: WmsPurchasingBatchStatus.SHIPPED,
          message,
          actorId,
          payload: shipmentReference
            ? {
                shipmentReference,
              }
            : undefined,
        },
      });

      await this.syncPurchasingNotificationEvent(tx, event);
    });

    this.emitStockRequestUpdate({
      tenantId: batch.tenantId,
      batchId: batch.id,
      status: WmsPurchasingBatchStatus.SHIPPED,
      sourceStatus: 'SHIPPED',
      eventType: 'SELF_BUY_SHIPPED',
    });

    return this.getBatchById(batch.id, scope.activeTenantId);
  }

  async updateStatus(
    id: string,
    body: UpdateWmsPurchasingStatusDto,
    requestedTenantId?: string,
    options?: {
      bypassRevisionAcceptanceGuard?: boolean;
    },
  ) {
    const scope = await this.resolveTenantScope(requestedTenantId);
    if (!scope.activeTenantId) {
      throw new ForbiddenException('Tenant context is required');
    }

    const actorId = (this.cls.get('userId') as string | undefined) ?? null;
    const current = await this.prisma.wmsPurchasingBatch.findUnique({
      where: { id },
      include: {
        paymentProofAsset: {
          select: {
            id: true,
          },
        },
        lines: {
          select: {
            lineNo: true,
            sourceSnapshot: true,
            requestedQuantity: true,
            approvedQuantity: true,
            partnerUnitCost: true,
            supplierUnitCost: true,
            needsProfiling: true,
            resolvedProfileId: true,
          },
        },
      },
    });

    if (!current) {
      throw new NotFoundException('Purchasing batch was not found');
    }

    this.assertBatchTenantScope(current.tenantId, scope.activeTenantId);

    if (body.status !== current.status) {
      const allowed = this.getAllowedStatusTransitions(current.requestType, current.status);
      if (!allowed.includes(body.status)) {
        throw new BadRequestException(
          `Cannot move purchasing batch from ${current.status} to ${body.status}`,
        );
      }
    }

    const now = new Date();
    const shouldAutoIssueInvoice =
      body.status === WmsPurchasingBatchStatus.PENDING_PAYMENT
      && current.requestType === WmsPurchasingRequestType.PROCUREMENT;

    const providedInvoiceNumber = this.cleanOptionalText(body.invoiceNumber);
    const effectiveInvoiceNumber =
      providedInvoiceNumber
      ?? current.invoiceNumber
      ?? (shouldAutoIssueInvoice ? this.generateInvoiceNumber() : null);

    const providedInvoiceAmount =
      body.invoiceAmount === undefined ? undefined : this.numberOrNull(body.invoiceAmount);
    const effectiveInvoiceAmountRaw =
      providedInvoiceAmount
      ?? this.toNumber(current.invoiceAmount)
      ?? (shouldAutoIssueInvoice ? this.computeInvoiceAmountFromLines(current.lines) : null);
    const effectiveInvoiceAmount =
      effectiveInvoiceAmountRaw === null || effectiveInvoiceAmountRaw === undefined
        ? null
        : Number(effectiveInvoiceAmountRaw);

    const providedPaymentProofImageUrl = this.cleanOptionalText(body.paymentProofImageUrl);
    const providedPaymentProofAsset = await this.resolvePaymentProofAsset(
      body.paymentProofAssetId,
      scope.activeTenantId,
    );
    const effectivePaymentProofAssetId =
      body.paymentProofAssetId !== undefined
        ? (providedPaymentProofAsset?.id ?? null)
        : (current.paymentProofAsset?.id ?? null);
    const effectivePaymentProofImageUrl =
      body.paymentProofImageUrl !== undefined
        ? providedPaymentProofImageUrl
        : current.paymentProofImageUrl;
    const hasEffectivePaymentProof = Boolean(effectivePaymentProofAssetId || effectivePaymentProofImageUrl);
    const shouldSyncAcceptedLineProfileCosts =
      body.status !== current.status
      && current.requestType === WmsPurchasingRequestType.PROCUREMENT
      && body.status === WmsPurchasingBatchStatus.PENDING_PAYMENT;

    const effectivePaymentSubmittedAt =
      body.paymentSubmittedAt === undefined
        ? current.paymentSubmittedAt
        : this.parseOptionalDate(body.paymentSubmittedAt);

    const effectivePaymentVerifiedAt =
      this.parseOptionalDate(body.paymentVerifiedAt)
      ?? (
        body.status === WmsPurchasingBatchStatus.RECEIVING_READY
        && hasEffectivePaymentProof
          ? now
          : current.paymentVerifiedAt
      );

    if (
      body.status === WmsPurchasingBatchStatus.PENDING_PAYMENT
      && current.status === WmsPurchasingBatchStatus.UNDER_REVIEW
      && this.hasCommercialRevisionChanges(current.lines)
    ) {
      throw new BadRequestException(
        'Requests with revised quantity or pricing must be sent back to the partner as a revision',
      );
    }

    if (
      body.status === WmsPurchasingBatchStatus.PENDING_PAYMENT
      && current.requestType === WmsPurchasingRequestType.PROCUREMENT
      && current.status === WmsPurchasingBatchStatus.REVISION
      && !options?.bypassRevisionAcceptanceGuard
    ) {
      throw new BadRequestException(
        'Revision requests must be accepted by the partner before payment can be requested',
      );
    }

    if (this.requiresOperationalReadinessValidation(current.requestType, body.status)) {
      this.validateReadyForReceiving({
        requestType: current.requestType,
        lines: current.lines,
        invoiceNumber: effectiveInvoiceNumber,
        paymentVerifiedAt: effectivePaymentVerifiedAt,
      });
    }

    const nextSourceStatus =
      this.cleanOptionalText(body.sourceStatus)
      ?? (
        body.status === WmsPurchasingBatchStatus.REVISION
          ? 'REVISION_REQUESTED'
          : body.status === WmsPurchasingBatchStatus.AWAITING_PRODUCTS
            ? 'AWAITING_PRODUCTS'
            : body.status === WmsPurchasingBatchStatus.SHIPPED
              ? 'SHIPPED'
              : body.status === WmsPurchasingBatchStatus.RECEIVING_EXCEPTION
                ? 'RECEIVING_EXCEPTION'
          : body.status === WmsPurchasingBatchStatus.PENDING_PAYMENT
            ? 'PENDING_PAYMENT'
            : body.status === WmsPurchasingBatchStatus.PAYMENT_REVIEW
              ? 'PAYMENT_REVIEW'
              : body.status === WmsPurchasingBatchStatus.RECEIVING_READY
                ? 'RECEIVING_READY'
                : body.status === WmsPurchasingBatchStatus.RECEIVING
                  ? 'RECEIVING'
                  : body.status === WmsPurchasingBatchStatus.STOCKED
                    ? 'STOCKED'
                    : body.status === WmsPurchasingBatchStatus.REJECTED
                      ? 'REJECTED'
                      : body.status === WmsPurchasingBatchStatus.CANCELED
                        ? 'CANCELED'
                        : null
      );

    await this.prisma.$transaction(async (tx) => {
      await tx.wmsPurchasingBatch.update({
        where: { id: current.id },
        data: {
          status: body.status,
          wmsNotes: this.cleanOptionalText(body.wmsNotes) ?? undefined,
          invoiceNumber:
            body.invoiceNumber !== undefined || shouldAutoIssueInvoice
              ? effectiveInvoiceNumber
              : undefined,
          invoiceAmount:
            body.invoiceAmount !== undefined || shouldAutoIssueInvoice
              ? effectiveInvoiceAmount
              : undefined,
          paymentSubmittedAt:
            body.paymentSubmittedAt !== undefined ? effectivePaymentSubmittedAt : undefined,
          paymentProofAssetId:
            body.paymentProofAssetId !== undefined ? effectivePaymentProofAssetId : undefined,
          paymentProofImageUrl:
            body.paymentProofImageUrl !== undefined || body.paymentProofAssetId !== undefined
              ? (effectivePaymentProofAssetId ? null : effectivePaymentProofImageUrl)
              : undefined,
          paymentProofSubmittedAt:
            body.paymentProofImageUrl !== undefined || body.paymentProofAssetId !== undefined
              ? hasEffectivePaymentProof
                ? now
                : null
              : undefined,
          paymentProofSubmittedById:
            body.paymentProofImageUrl !== undefined || body.paymentProofAssetId !== undefined
              ? hasEffectivePaymentProof
                ? actorId
                : null
              : undefined,
          paymentVerifiedAt:
            body.paymentVerifiedAt !== undefined
            || (
              body.status === WmsPurchasingBatchStatus.RECEIVING_READY
              && hasEffectivePaymentProof
            )
              ? effectivePaymentVerifiedAt
              : undefined,
          sourceStatus: nextSourceStatus ?? undefined,
          readyForReceivingAt: this.resolveReadyForReceivingAt(
            current.readyForReceivingAt,
            body.status,
            now,
          ),
          reviewedById:
            body.status === WmsPurchasingBatchStatus.REVISION
            || body.status === WmsPurchasingBatchStatus.AWAITING_PRODUCTS
            || body.status === WmsPurchasingBatchStatus.RECEIVING_EXCEPTION
            || body.status === WmsPurchasingBatchStatus.PENDING_PAYMENT
            || body.status === WmsPurchasingBatchStatus.PAYMENT_REVIEW
            || body.status === WmsPurchasingBatchStatus.RECEIVING_READY
            || body.status === WmsPurchasingBatchStatus.RECEIVING
            || body.status === WmsPurchasingBatchStatus.STOCKED
              ? actorId
              : undefined,
          approvedById:
            body.status === WmsPurchasingBatchStatus.AWAITING_PRODUCTS
            || body.status === WmsPurchasingBatchStatus.PENDING_PAYMENT
            || body.status === WmsPurchasingBatchStatus.PAYMENT_REVIEW
            || body.status === WmsPurchasingBatchStatus.RECEIVING_READY
            || body.status === WmsPurchasingBatchStatus.RECEIVING
            || body.status === WmsPurchasingBatchStatus.STOCKED
              ? actorId
              : undefined,
          updatedById: actorId,
        },
      });

      const productProfileCostsSynced = shouldSyncAcceptedLineProfileCosts
        ? await this.syncAcceptedLineProfileCosts(tx, current.lines)
        : false;

      const event = await tx.wmsPurchasingEvent.create({
        data: {
          batchId: current.id,
          tenantId: current.tenantId,
          eventType:
            body.status === current.status ? 'BATCH_UPDATED' : 'STATUS_CHANGED',
          fromStatus: current.status,
          toStatus: body.status,
          message: this.cleanOptionalText(body.message),
          actorId,
          payload: {
            invoiceNumber: effectiveInvoiceNumber,
            invoiceAmount: effectiveInvoiceAmount,
            paymentSubmittedAt: body.paymentSubmittedAt ?? null,
            paymentProofImageUrl: effectivePaymentProofImageUrl,
            paymentProofAssetId: effectivePaymentProofAssetId,
            paymentVerifiedAt: effectivePaymentVerifiedAt,
            sourceStatus: nextSourceStatus,
            productProfileCostsSynced,
          },
        },
      });

      await this.syncPurchasingNotificationEvent(tx, event);
    });

    this.emitStockRequestUpdate({
      tenantId: current.tenantId,
      batchId: current.id,
      status: body.status,
      sourceStatus: nextSourceStatus ?? null,
      eventType: body.status === current.status ? 'BATCH_UPDATED' : 'STATUS_CHANGED',
    });

    return this.getBatchById(id, scope.activeTenantId);
  }

  async updateLine(
    batchId: string,
    lineId: string,
    body: UpdateWmsPurchasingLineDto,
    requestedTenantId?: string,
  ) {
    const scope = await this.resolveTenantScope(requestedTenantId);
    if (!scope.activeTenantId) {
      throw new ForbiddenException('Tenant context is required');
    }

    const actorId = (this.cls.get('userId') as string | undefined) ?? null;
    const line = await this.prisma.wmsPurchasingBatchLine.findUnique({
      where: { id: lineId },
      include: {
        batch: {
          select: {
            id: true,
            tenantId: true,
            storeId: true,
            requestType: true,
            status: true,
          },
        },
      },
    });

    if (!line || line.batchId !== batchId) {
      throw new NotFoundException('Purchasing line was not found');
    }

    this.assertBatchTenantScope(line.batch.tenantId, scope.activeTenantId);
    await this.validateResolutionTargets(
      line.batch.tenantId,
      line.batch.storeId,
      body.resolvedPosProductId,
      body.resolvedProfileId,
    );

    const approvedQuantity =
      body.approvedQuantity !== undefined ? body.approvedQuantity : line.approvedQuantity;
    const receivedQuantity =
      body.receivedQuantity !== undefined ? body.receivedQuantity : line.receivedQuantity;
    const maxReceivable = approvedQuantity ?? line.requestedQuantity;
    const currentEffectiveApprovedQuantity = line.approvedQuantity ?? line.requestedQuantity;
    const nextEffectiveApprovedQuantity = approvedQuantity ?? line.requestedQuantity;
    const nextPartnerUnitCost =
      body.partnerUnitCost === undefined
        ? this.toNumber(line.partnerUnitCost)
        : this.numberOrNull(body.partnerUnitCost);
    const nextSupplierUnitCost =
      line.batch.requestType === WmsPurchasingRequestType.SELF_BUY
        ? null
        : body.supplierUnitCost === undefined
          ? this.toNumber(line.supplierUnitCost)
          : this.numberOrNull(body.supplierUnitCost);
    const nextResolvedProfileId =
      body.resolvedProfileId === undefined ? line.resolvedProfileId : body.resolvedProfileId || null;
    const shouldSyncLineProfileCosts =
      Boolean(nextResolvedProfileId)
      && (
        body.supplierUnitCost !== undefined
        || body.partnerUnitCost !== undefined
        || body.resolvedProfileId !== undefined
      )
      && line.batch.requestType === WmsPurchasingRequestType.PROCUREMENT
      && line.batch.status !== WmsPurchasingBatchStatus.UNDER_REVIEW
      && line.batch.status !== WmsPurchasingBatchStatus.REVISION;
    const didChangeCommercialTerms =
      nextEffectiveApprovedQuantity !== currentEffectiveApprovedQuantity
      || nextPartnerUnitCost !== this.toNumber(line.partnerUnitCost)
      || nextSupplierUnitCost !== this.toNumber(line.supplierUnitCost);
    const shouldAutoRequestRevision =
      line.batch.status === WmsPurchasingBatchStatus.UNDER_REVIEW && didChangeCommercialTerms;

    if (approvedQuantity !== null && approvedQuantity !== undefined) {
      if (approvedQuantity > line.requestedQuantity) {
        throw new BadRequestException('Approved quantity cannot exceed requested quantity');
      }
    }

    if (receivedQuantity > maxReceivable) {
      throw new BadRequestException('Received quantity cannot exceed approved quantity');
    }

    const baseSnapshot = this.readLineSnapshot(line.sourceSnapshot);
    const originalPartnerUnitCost =
      baseSnapshot.originalPartnerUnitCost ?? this.toNumber(line.partnerUnitCost);
    const originalSupplierUnitCost =
      baseSnapshot.originalSupplierUnitCost ?? this.toNumber(line.supplierUnitCost);
    const nextSourceSnapshot = {
      ...baseSnapshot.raw,
      originalPartnerUnitCost,
      originalSupplierUnitCost,
      originalApprovedQuantity:
        baseSnapshot.originalApprovedQuantity ?? currentEffectiveApprovedQuantity,
    };

    await this.prisma.$transaction(async (tx) => {
      await tx.wmsPurchasingBatchLine.update({
        where: { id: line.id },
        data: {
          sourceSnapshot: nextSourceSnapshot as Prisma.InputJsonValue,
          approvedQuantity:
            body.approvedQuantity === undefined ? undefined : body.approvedQuantity,
          receivedQuantity:
            body.receivedQuantity === undefined ? undefined : body.receivedQuantity,
          partnerUnitCost:
            body.partnerUnitCost === undefined
              ? undefined
              : this.numberOrNull(body.partnerUnitCost),
          supplierUnitCost:
            line.batch.requestType === WmsPurchasingRequestType.SELF_BUY
              ? null
              : body.supplierUnitCost === undefined
              ? undefined
              : this.numberOrNull(body.supplierUnitCost),
          needsProfiling:
            body.needsProfiling === undefined
              ? body.resolvedProfileId
                ? false
                : undefined
              : body.needsProfiling,
          resolvedPosProductId:
            body.resolvedPosProductId === undefined
              ? undefined
              : body.resolvedPosProductId || null,
          resolvedProfileId:
            body.resolvedProfileId === undefined ? undefined : body.resolvedProfileId || null,
          notes: this.cleanOptionalText(body.notes) ?? undefined,
          updatedById: actorId,
        },
      });

      if (shouldSyncLineProfileCosts && nextResolvedProfileId) {
        await tx.wmsProductProfile.update({
          where: { id: nextResolvedProfileId },
          data: {
            ...(nextSupplierUnitCost !== null ? { supplierUnitCost: nextSupplierUnitCost } : {}),
            ...(nextPartnerUnitCost !== null ? { inhouseUnitCost: nextPartnerUnitCost } : {}),
          },
        });
      }

      await tx.wmsPurchasingBatch.update({
        where: { id: line.batchId },
        data: {
          status: shouldAutoRequestRevision ? WmsPurchasingBatchStatus.REVISION : undefined,
          sourceStatus: shouldAutoRequestRevision ? 'REVISION_REQUESTED' : undefined,
          reviewedById: shouldAutoRequestRevision ? actorId : undefined,
          updatedById: actorId,
        },
      });

      if (shouldAutoRequestRevision) {
        const event = await tx.wmsPurchasingEvent.create({
          data: {
            batchId: line.batchId,
            tenantId: line.batch.tenantId,
            eventType: 'STATUS_CHANGED',
            fromStatus: line.batch.status,
            toStatus: WmsPurchasingBatchStatus.REVISION,
            message: 'Revised quantity or pricing was sent back to the partner',
            actorId,
            payload: {
              trigger: 'LINE_UPDATE',
              lineId: line.id,
            },
          },
        });

        await this.syncPurchasingNotificationEvent(tx, event);
      }

      await tx.wmsPurchasingEvent.create({
        data: {
          batchId: line.batchId,
          tenantId: line.batch.tenantId,
          eventType: 'LINE_UPDATED',
          message: `Updated line ${line.lineNo}`,
          actorId,
          payload: {
            lineId: line.id,
            before: {
              approvedQuantity: line.approvedQuantity,
              partnerUnitCost: this.toNumber(line.partnerUnitCost),
              supplierUnitCost: this.toNumber(line.supplierUnitCost),
            },
            after: {
              approvedQuantity,
              partnerUnitCost: nextPartnerUnitCost,
              supplierUnitCost: nextSupplierUnitCost,
            },
            productProfileCostSynced: shouldSyncLineProfileCosts,
            autoRequestedRevision: shouldAutoRequestRevision,
          },
        },
      });
    });

    this.emitStockRequestUpdate({
      tenantId: line.batch.tenantId,
      batchId: line.batchId,
      status: shouldAutoRequestRevision ? WmsPurchasingBatchStatus.REVISION : line.batch.status,
      sourceStatus: shouldAutoRequestRevision ? 'REVISION_REQUESTED' : null,
      eventType: shouldAutoRequestRevision ? 'STATUS_CHANGED' : 'LINE_UPDATED',
    });

    return this.getBatchById(batchId, scope.activeTenantId);
  }

  private async syncAcceptedLineProfileCosts(
    client: Prisma.TransactionClient,
    lines: Array<{
      resolvedProfileId: string | null;
      partnerUnitCost: Prisma.Decimal | number | null;
      supplierUnitCost: Prisma.Decimal | number | null;
    }>,
  ) {
    const costsByProfileId = new Map<string, {
      inhouseUnitCost?: number;
      supplierUnitCost?: number;
    }>();

    lines.forEach((line) => {
      if (!line.resolvedProfileId) {
        return;
      }

      const partnerUnitCost = this.toNumber(line.partnerUnitCost);
      const supplierUnitCost = this.toNumber(line.supplierUnitCost);
      if (partnerUnitCost === null && supplierUnitCost === null) {
        return;
      }

      costsByProfileId.set(line.resolvedProfileId, {
        ...(partnerUnitCost !== null ? { inhouseUnitCost: partnerUnitCost } : {}),
        ...(supplierUnitCost !== null ? { supplierUnitCost } : {}),
      });
    });

    for (const [profileId, costs] of costsByProfileId) {
      await client.wmsProductProfile.update({
        where: { id: profileId },
        data: costs,
      });
    }

    return costsByProfileId.size > 0;
  }

  private emitStockRequestUpdate(params: {
    tenantId: string;
    batchId: string;
    status: WmsPurchasingBatchStatus;
    sourceStatus: string | null;
    eventType: string;
  }) {
    this.workflowExecutionGateway.emitTenantEvent(
      params.tenantId,
      null,
      'stock-requests:updated',
      {
        tenantId: params.tenantId,
        batchId: params.batchId,
        status: params.status,
        sourceStatus: params.sourceStatus,
        eventType: params.eventType,
        updatedAt: new Date().toISOString(),
      },
    );
  }

  private async syncPurchasingNotificationEvent(
    client: Prisma.TransactionClient,
    event: {
      id: string;
      tenantId: string;
      batchId: string;
      eventType: string;
      fromStatus: WmsPurchasingBatchStatus | null;
      toStatus: WmsPurchasingBatchStatus | null;
      message: string | null;
      payload: Prisma.JsonValue | null;
    },
  ) {
    await this.notificationStateService.syncPurchasingBatchEvent(client, {
      tenantId: event.tenantId,
      batchId: event.batchId,
      sourceEventId: event.id,
      sourceEventType: event.eventType,
      fromStatus: event.fromStatus,
      toStatus: event.toStatus,
      context: {
        message: event.message,
        payload: event.payload,
      },
    });
  }

  private async computeSummaryCounts(where: Prisma.WmsPurchasingBatchWhereInput) {
    const [batches, procurement, selfBuy, readyForReceiving, underReview] = await Promise.all([
      this.prisma.wmsPurchasingBatch.count({ where }),
      this.prisma.wmsPurchasingBatch.count({
        where: {
          ...where,
          requestType: WmsPurchasingRequestType.PROCUREMENT,
        },
      }),
      this.prisma.wmsPurchasingBatch.count({
        where: {
          ...where,
          requestType: WmsPurchasingRequestType.SELF_BUY,
        },
      }),
      this.prisma.wmsPurchasingBatch.count({
        where: {
          ...where,
          status: {
            in: [
              WmsPurchasingBatchStatus.RECEIVING_READY,
              WmsPurchasingBatchStatus.SHIPPED,
            ],
          },
        },
      }),
      this.prisma.wmsPurchasingBatch.count({
        where: {
          ...where,
          status: {
            in: [
              WmsPurchasingBatchStatus.UNDER_REVIEW,
              WmsPurchasingBatchStatus.REVISION,
              WmsPurchasingBatchStatus.PAYMENT_REVIEW,
              WmsPurchasingBatchStatus.RECEIVING_EXCEPTION,
            ],
          },
        },
      }),
    ]);

    return {
      batches,
      procurement,
      selfBuy,
      readyForReceiving,
      underReview,
    };
  }

  private mapBatchListRow(batch: PurchasingBatchListRecord) {
    const aggregate = this.aggregateLineTotals(batch.lines);

    return {
      id: batch.id,
      requestType: batch.requestType,
      status: batch.status,
      sourceType: batch.sourceType,
      sourceRequestId: batch.sourceRequestId,
      sourceStatus: batch.sourceStatus,
      requestTitle: batch.requestTitle,
      store: {
        id: batch.store.id,
        name: batch.store.shopName || batch.store.name,
      },
      lineCount: batch.lines.length,
      requestedQuantity: aggregate.requestedQuantity,
      approvedQuantity: aggregate.approvedQuantity,
      receivedQuantity: aggregate.receivedQuantity,
      invoiceNumber: batch.invoiceNumber,
      invoiceAmount: this.toNumber(batch.invoiceAmount),
      paymentProofImageUrl: batch.paymentProofImageUrl,
      paymentSubmittedAt: batch.paymentSubmittedAt,
      paymentProofSubmittedAt: batch.paymentProofSubmittedAt,
      paymentVerifiedAt: batch.paymentVerifiedAt,
      readyForReceivingAt: batch.readyForReceivingAt,
      createdAt: batch.createdAt,
      updatedAt: batch.updatedAt,
    };
  }

  private async mapBatchDetail(
    batch: PurchasingBatchDetailRecord,
    invoiceBankDetails: InvoiceBankDetailsRecord | null,
  ) {
    const listRow = {
      ...this.mapBatchListRow(batch),
      paymentProofImageUrl:
        await this.mediaAssetsService.createSignedAssetUrl(batch.paymentProofAsset)
        ?? batch.paymentProofImageUrl,
    };

    return {
      ...listRow,
      sourceRequestType: batch.sourceRequestType,
      sourceSnapshot: batch.sourceSnapshot,
      partnerNotes: batch.partnerNotes,
      wmsNotes: batch.wmsNotes,
      invoice: {
        number: listRow.invoiceNumber,
        amount: listRow.invoiceAmount,
        bankDetails: invoiceBankDetails
          ? {
              warehouseId: invoiceBankDetails.id,
              warehouseCode: invoiceBankDetails.code,
              warehouseName: invoiceBankDetails.name,
              billingCompanyName: invoiceBankDetails.billingCompanyName,
              billingAddress: invoiceBankDetails.billingAddress,
              bankName: invoiceBankDetails.bankName,
              bankAccountName: invoiceBankDetails.bankAccountName,
              bankAccountNumber: invoiceBankDetails.bankAccountNumber,
              bankAccountType: invoiceBankDetails.bankAccountType,
              bankBranch: invoiceBankDetails.bankBranch,
              paymentInstructions: invoiceBankDetails.paymentInstructions,
            }
          : null,
      },
      paymentProofSubmittedBy: batch.paymentProofSubmittedBy
        ? {
            id: batch.paymentProofSubmittedBy.id,
            name: this.formatUserName(
              batch.paymentProofSubmittedBy.firstName,
              batch.paymentProofSubmittedBy.lastName,
            ),
            email: batch.paymentProofSubmittedBy.email,
          }
        : null,
      lines: batch.lines.map((line) => ({
        id: line.id,
        lineNo: line.lineNo,
        sourceItemId: line.sourceItemId,
        sourceSnapshot: line.sourceSnapshot,
        productId: line.productId,
        variationId: line.variationId,
        requestedProductName: line.requestedProductName,
        uom: line.uom,
        requestedQuantity: line.requestedQuantity,
        approvedQuantity: line.approvedQuantity,
        receivedQuantity: line.receivedQuantity,
        partnerUnitCost: this.toNumber(line.partnerUnitCost),
        supplierUnitCost: this.toNumber(line.supplierUnitCost),
        needsProfiling: line.needsProfiling,
        resolvedPosProduct: line.resolvedPosProduct
          ? {
              id: line.resolvedPosProduct.id,
              name: line.resolvedPosProduct.name,
              customId: line.resolvedPosProduct.customId,
            }
          : null,
        resolvedProfile: line.resolvedProfile
          ? {
              id: line.resolvedProfile.id,
              status: line.resolvedProfile.status,
              isSerialized: line.resolvedProfile.isSerialized,
            }
          : null,
        notes: line.notes,
        createdAt: line.createdAt,
        updatedAt: line.updatedAt,
      })),
      events: batch.events.map((event) => ({
        id: event.id,
        eventType: event.eventType,
        fromStatus: event.fromStatus,
        toStatus: event.toStatus,
        message: event.message,
        payload: event.payload,
        actor: event.actor
          ? {
              id: event.actor.id,
              name: this.formatUserName(event.actor.firstName, event.actor.lastName),
              email: event.actor.email,
            }
          : null,
        createdAt: event.createdAt,
      })),
    };
  }

  private async resolvePaymentProofAsset(assetId: string | null | undefined, tenantId: string) {
    const normalized = this.cleanOptionalText(assetId);
    if (!normalized) {
      return null;
    }

    return this.mediaAssetsService.assertTenantOwnedPaymentProofAsset(normalized, tenantId);
  }

  private async resolveInvoiceBankDetails(): Promise<InvoiceBankDetailsRecord | null> {
    return this.prisma.wmsWarehouse.findFirst({
      where: {
        status: WmsWarehouseStatus.ACTIVE,
      },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        code: true,
        name: true,
        billingCompanyName: true,
        billingAddress: true,
        bankName: true,
        bankAccountName: true,
        bankAccountNumber: true,
        bankAccountType: true,
        bankBranch: true,
        paymentInstructions: true,
      },
    });
  }

  private generateInvoiceNumber() {
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const suffix = Math.random().toString(36).slice(2, 7).toUpperCase();
    return `INV-${stamp}-${suffix}`;
  }

  private computeInvoiceAmountFromLines(
    lines: Array<{
      requestedQuantity: number;
      approvedQuantity: number | null;
      partnerUnitCost: Prisma.Decimal | number | null;
    }>,
  ) {
    const amount = lines.reduce((sum, line) => {
      const quantity = line.approvedQuantity ?? line.requestedQuantity;
      const unitCost =
        typeof line.partnerUnitCost === 'number'
          ? line.partnerUnitCost
          : line.partnerUnitCost
            ? Number(line.partnerUnitCost)
            : 0;

      return sum + quantity * unitCost;
    }, 0);

    return amount > 0 ? amount : null;
  }

  private aggregateLineTotals(
    lines: Array<{
      requestedQuantity: number;
      approvedQuantity: number | null;
      receivedQuantity: number;
    }>,
  ) {
    return lines.reduce<{
      requestedQuantity: number;
      approvedQuantity: number;
      receivedQuantity: number;
    }>(
      (acc, line) => {
        acc.requestedQuantity += line.requestedQuantity;
        acc.approvedQuantity += line.approvedQuantity ?? line.requestedQuantity;
        acc.receivedQuantity += line.receivedQuantity;
        return acc;
      },
      {
        requestedQuantity: 0,
        approvedQuantity: 0,
        receivedQuantity: 0,
      },
    );
  }

  private async normalizeCreateLines(input: {
    tenantId: string;
    storeId: string;
    requestType: WmsPurchasingRequestType;
    lines: CreateWmsPurchasingBatchLineInput[];
  }) {
    const usedLineNos = new Set<number>();
    const normalized: Array<{
      tenantId: string;
      storeId: string;
      lineNo: number;
      sourceItemId: string | null;
      sourceSnapshot: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined;
      productId: string | null;
      variationId: string | null;
      requestedProductName: string | null;
      uom: string | null;
      requestedQuantity: number;
      approvedQuantity: number | null;
      partnerUnitCost: number | null;
      supplierUnitCost: number | null;
      needsProfiling: boolean;
      resolvedPosProductId: string | null;
      resolvedProfileId: string | null;
      notes: string | null;
    }> = [];

    for (let index = 0; index < input.lines.length; index += 1) {
      const line = input.lines[index];
      const lineNo = line.lineNo ?? index + 1;
      const lineStoreId = line.storeId ?? input.storeId;

      if (usedLineNos.has(lineNo)) {
        throw new BadRequestException(`Duplicate line number detected: ${lineNo}`);
      }
      usedLineNos.add(lineNo);

      if (line.approvedQuantity !== undefined && line.approvedQuantity > line.requestedQuantity) {
        throw new BadRequestException(
          `Line ${lineNo}: approved quantity cannot exceed requested quantity`,
        );
      }

      const resolutionTargets = await this.validateResolutionTargets(
        input.tenantId,
        lineStoreId,
        line.resolvedPosProductId,
        line.resolvedProfileId,
      );

      const requestedVariationId = this.cleanOptionalText(line.variationId);
      const resolvedVariationId =
        resolutionTargets.profile?.variationId
        ?? resolutionTargets.posProduct?.variationId
        ?? null;
      const canonicalVariationId = requestedVariationId ?? resolvedVariationId;

      if (!canonicalVariationId) {
        throw new BadRequestException(
          `Line ${lineNo}: this product is not stockable because it is missing a variation ID`,
        );
      }

      if (line.productId && this.isLegacyVariationMapping(line.productId, canonicalVariationId)) {
        throw new BadRequestException(
          `Line ${lineNo}: this product still uses a legacy variation mapping. Sync this product first.`,
        );
      }

      if (requestedVariationId && resolvedVariationId && requestedVariationId !== resolvedVariationId) {
        throw new BadRequestException(
          `Line ${lineNo}: variation ID does not match the selected stockable product`,
        );
      }

      if (line.productId && canonicalVariationId === line.productId) {
        const canonicalVariationProducts = await this.prisma.posProduct.findMany({
          where: {
            storeId: lineStoreId,
            productId: line.productId,
            variationId: {
              not: null,
            },
          },
          select: {
            variationId: true,
          },
        });
        const canonicalVariationProduct = canonicalVariationProducts.find(
          (product) => this.isStockableVariation(line.productId!, product.variationId),
        );

        if (
          canonicalVariationProduct?.variationId
          && canonicalVariationProduct.variationId !== line.productId
        ) {
          throw new BadRequestException(
            `Line ${lineNo}: request must use variation ID ${canonicalVariationProduct.variationId}, not product ID ${line.productId}`,
          );
        }
      }

      if (lineStoreId !== input.storeId) {
        await this.validateStore(input.tenantId, lineStoreId);
      }

      const partnerUnitCost = this.numberOrNull(line.partnerUnitCost);
      const supplierUnitCost =
        input.requestType === WmsPurchasingRequestType.SELF_BUY
          ? null
          : this.numberOrNull(line.supplierUnitCost);

      if (
        input.requestType === WmsPurchasingRequestType.SELF_BUY
        && (partnerUnitCost === null || partnerUnitCost <= 0)
      ) {
        throw new BadRequestException(
          `Line ${lineNo}: self-buy actual unit COGS is required`,
        );
      }

      normalized.push({
        tenantId: input.tenantId,
        storeId: lineStoreId,
        lineNo,
        sourceItemId: this.cleanOptionalText(line.sourceItemId),
        sourceSnapshot: this.toJsonValue({
          ...(line.sourceSnapshot ?? {}),
          storeId: lineStoreId,
          originalPartnerUnitCost: partnerUnitCost,
          originalSupplierUnitCost: supplierUnitCost,
          originalApprovedQuantity: line.approvedQuantity ?? line.requestedQuantity,
        }),
        productId: this.cleanOptionalText(line.productId),
        variationId: canonicalVariationId,
        requestedProductName: this.cleanOptionalText(line.requestedProductName),
        uom: this.cleanOptionalText(line.uom),
        requestedQuantity: line.requestedQuantity,
        approvedQuantity: line.approvedQuantity ?? null,
        partnerUnitCost,
        supplierUnitCost,
        needsProfiling:
          line.needsProfiling ?? (input.requestType === WmsPurchasingRequestType.SELF_BUY && !line.resolvedProfileId),
        resolvedPosProductId: line.resolvedPosProductId ?? null,
        resolvedProfileId: line.resolvedProfileId ?? null,
        notes: this.cleanOptionalText(line.notes),
      });
    }

    return normalized;
  }

  private hasCommercialRevisionChanges(
    lines: Array<{
      sourceSnapshot?: Prisma.JsonValue | null;
      requestedQuantity: number;
      approvedQuantity: number | null;
      partnerUnitCost: Prisma.Decimal | number | null;
      supplierUnitCost?: Prisma.Decimal | number | null;
    }>,
  ) {
    return lines.some((line) => {
      const snapshot = this.readLineSnapshot(line.sourceSnapshot);
      const originalPartnerUnitCost =
        snapshot.originalPartnerUnitCost ?? this.toNumber(line.partnerUnitCost);
      const originalSupplierUnitCost =
        snapshot.originalSupplierUnitCost ?? this.toNumber(line.supplierUnitCost ?? null);
      const originalApprovedQuantity =
        snapshot.originalApprovedQuantity ?? line.requestedQuantity;

      return (
        (line.approvedQuantity ?? line.requestedQuantity) !== originalApprovedQuantity
        || this.toNumber(line.partnerUnitCost) !== originalPartnerUnitCost
        || this.toNumber(line.supplierUnitCost ?? null) !== originalSupplierUnitCost
      );
    });
  }

  private readLineSnapshot(sourceSnapshot: Prisma.JsonValue | null | undefined) {
    const raw =
      sourceSnapshot && typeof sourceSnapshot === 'object' && !Array.isArray(sourceSnapshot)
        ? (sourceSnapshot as Record<string, unknown>)
        : {};

    const asNumber = (value: unknown) =>
      typeof value === 'number' && Number.isFinite(value) ? value : null;

    return {
      raw,
      originalPartnerUnitCost: asNumber(raw.originalPartnerUnitCost),
      originalSupplierUnitCost: asNumber(raw.originalSupplierUnitCost),
      originalApprovedQuantity: asNumber(raw.originalApprovedQuantity),
    };
  }

  private validateReadyForReceiving(input: {
    requestType: WmsPurchasingRequestType;
    lines: Array<{
      lineNo: number;
      requestedQuantity: number;
      approvedQuantity: number | null;
      partnerUnitCost?: Prisma.Decimal | number | null;
      needsProfiling: boolean;
      resolvedProfileId: string | null;
    }>;
    invoiceNumber?: string | null;
    paymentVerifiedAt?: Date | string | null;
  }) {
    if (!input.lines.length) {
      throw new BadRequestException('Cannot mark ready for receiving without line items');
    }

    input.lines.forEach((line) => {
      const approved = line.approvedQuantity ?? line.requestedQuantity;
      if (approved <= 0) {
        throw new BadRequestException(
          `Line ${line.lineNo}: approved quantity must be greater than zero`,
        );
      }
    });

    if (input.requestType === WmsPurchasingRequestType.SELF_BUY) {
      const unresolved = input.lines.find(
        (line) => line.needsProfiling || !line.resolvedProfileId,
      );
      if (unresolved) {
        throw new BadRequestException(
          `Line ${unresolved.lineNo}: self-buy requests must resolve product profiling before receiving handoff`,
        );
      }

      const missingUnitCost = input.lines.find((line) => {
        const partnerUnitCost = this.toNumber(line.partnerUnitCost ?? null);
        return partnerUnitCost === null || partnerUnitCost <= 0;
      });
      if (missingUnitCost) {
        throw new BadRequestException(
          `Line ${missingUnitCost.lineNo}: self-buy actual unit COGS is required`,
        );
      }
    }

    if (input.requestType === WmsPurchasingRequestType.PROCUREMENT) {
      const hasInvoice = Boolean(this.cleanOptionalText(input.invoiceNumber ?? null));
      const hasPaymentVerification = Boolean(input.paymentVerifiedAt);
      if (!hasInvoice || !hasPaymentVerification) {
        throw new BadRequestException(
          'Procurement requests require invoice number and verified payment before receiving handoff',
        );
      }
    }
  }

  private getAllowedStatusTransitions(
    requestType: WmsPurchasingRequestType,
    status: WmsPurchasingBatchStatus,
  ) {
    return requestType === WmsPurchasingRequestType.SELF_BUY
      ? SELF_BUY_STATUS_TRANSITIONS[status]
      : PROCUREMENT_STATUS_TRANSITIONS[status];
  }

  private requiresOperationalReadinessValidation(
    requestType: WmsPurchasingRequestType,
    status: WmsPurchasingBatchStatus,
  ) {
    return (
      (
        requestType === WmsPurchasingRequestType.PROCUREMENT
        && status === WmsPurchasingBatchStatus.RECEIVING_READY
      )
      || (
        requestType === WmsPurchasingRequestType.SELF_BUY
        && status === WmsPurchasingBatchStatus.AWAITING_PRODUCTS
      )
    );
  }

  private isReadyForReceivingQueueStatus(status: WmsPurchasingBatchStatus) {
    return (
      status === WmsPurchasingBatchStatus.RECEIVING_READY
      || status === WmsPurchasingBatchStatus.SHIPPED
    );
  }

  private resolveReadyForReceivingAt(
    currentValue: Date | null,
    nextStatus: WmsPurchasingBatchStatus,
    now: Date,
  ) {
    if (this.isReadyForReceivingQueueStatus(nextStatus)) {
      return now;
    }

    if (
      nextStatus === WmsPurchasingBatchStatus.AWAITING_PRODUCTS
      || nextStatus === WmsPurchasingBatchStatus.RECEIVING_EXCEPTION
      || nextStatus === WmsPurchasingBatchStatus.PENDING_PAYMENT
      || nextStatus === WmsPurchasingBatchStatus.PAYMENT_REVIEW
      || nextStatus === WmsPurchasingBatchStatus.REVISION
      || nextStatus === WmsPurchasingBatchStatus.REJECTED
      || nextStatus === WmsPurchasingBatchStatus.CANCELED
    ) {
      return null;
    }

    return currentValue ?? undefined;
  }

  private async validateStore(tenantId: string, storeId: string) {
    const store = await this.prisma.posStore.findFirst({
      where: {
        id: storeId,
        tenantId,
      },
      select: { id: true },
    });

    if (!store) {
      throw new BadRequestException('Selected store is outside tenant scope');
    }
  }

  private async validateResolutionTargets(
    tenantId: string,
    storeId: string,
    resolvedPosProductId?: string,
    resolvedProfileId?: string,
  ) {
    let resolvedPosProduct:
      | {
          id: string;
          productId: string;
          variationId: string | null;
        }
      | null = null;

    if (resolvedPosProductId) {
      const posProduct = await this.prisma.posProduct.findFirst({
        where: {
          id: resolvedPosProductId,
          storeId,
          store: {
            tenantId,
          },
        },
        select: {
          id: true,
          productId: true,
          variationId: true,
        },
      });

      if (!posProduct) {
        throw new BadRequestException('Resolved POS product is outside tenant/store scope');
      }

      if (!this.isStockableVariation(posProduct.productId, posProduct.variationId)) {
        throw new BadRequestException(
          this.getStockabilityReason(posProduct.productId, posProduct.variationId),
        );
      }

      resolvedPosProduct = posProduct;
    }

    let resolvedProfile:
      | {
          id: string;
          posProductId: string;
          variationId: string;
          posProduct: {
            productId: string;
            variationId: string | null;
          };
        }
      | null = null;

    if (resolvedProfileId) {
      const profile = await this.prisma.wmsProductProfile.findFirst({
        where: {
          id: resolvedProfileId,
          tenantId,
          storeId,
        },
        select: {
          id: true,
          posProductId: true,
          variationId: true,
          posProduct: {
            select: {
              productId: true,
              variationId: true,
            },
          },
        },
      });

      if (!profile) {
        throw new BadRequestException('Resolved product profile is outside tenant/store scope');
      }

      if (resolvedPosProductId && profile.posProductId !== resolvedPosProductId) {
        throw new BadRequestException(
          'Resolved product profile does not match the selected POS product',
        );
      }

      if (!this.isStockableVariation(profile.posProduct.productId, profile.posProduct.variationId)) {
        throw new BadRequestException(
          this.getStockabilityReason(profile.posProduct.productId, profile.posProduct.variationId),
        );
      }

      if (!this.isStockableVariation(profile.posProduct.productId, profile.variationId)) {
        throw new BadRequestException(
          'Resolved product profile still uses a legacy variation mapping. Sync this product first.',
        );
      }

      resolvedProfile = profile;
    }

    return {
      posProduct: resolvedPosProduct,
      profile: resolvedProfile,
    };
  }

  private assertBatchTenantScope(batchTenantId: string, activeTenantId: string) {
    if (batchTenantId !== activeTenantId) {
      throw new ForbiddenException('Selected purchasing batch is outside your WMS scope');
    }
  }

  private async resolveTenantScope(requestedTenantId?: string) {
    const clsTenantId = this.cls.get('tenantId') as string | undefined;
    const userRole = this.cls.get('userRole') as string | undefined;
    const isPlatformUser = userRole === 'SUPER_ADMIN';
    const hasGlobalWmsAccess = this.cls.get('wmsGlobalAccess') === true;

    if (isPlatformUser || hasGlobalWmsAccess) {
      const tenants = await this.prisma.tenant.findMany({
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
        },
        orderBy: [{ name: 'asc' }],
      });

      const activeTenantId =
        requestedTenantId && tenants.some((tenant) => tenant.id === requestedTenantId)
          ? requestedTenantId
          : clsTenantId && tenants.some((tenant) => tenant.id === clsTenantId)
            ? clsTenantId
          : tenants[0]?.id ?? null;

      return {
        activeTenantId,
        tenants: tenants.map((tenant) => ({
          id: tenant.id,
          label: tenant.name,
          slug: tenant.slug,
          status: tenant.status,
        })),
      };
    }

    if (!clsTenantId) {
      return {
        activeTenantId: null,
        tenants: [],
      };
    }

    if (requestedTenantId && requestedTenantId !== clsTenantId) {
      throw new ForbiddenException('Selected tenant is outside your WMS scope');
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: clsTenantId },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
      },
    });

    return {
      activeTenantId: clsTenantId,
      tenants: tenant
        ? [
            {
              id: tenant.id,
              label: tenant.name,
              slug: tenant.slug,
              status: tenant.status,
            },
          ]
        : [],
    };
  }

  private toNumber(value: Prisma.Decimal | number | null | undefined) {
    if (value === null || value === undefined) {
      return null;
    }

    return Number(value);
  }

  private isLegacyVariationMapping(productId: string, variationId: string | null | undefined) {
    return Boolean(variationId) && variationId === productId;
  }

  private isStockableVariation(productId: string, variationId: string | null | undefined) {
    return Boolean(variationId) && !this.isLegacyVariationMapping(productId, variationId);
  }

  private getStockabilityReason(productId: string, variationId: string | null | undefined) {
    if (!variationId) {
      return 'Resolved POS product is not stockable because it is missing a variation ID';
    }

    if (this.isLegacyVariationMapping(productId, variationId)) {
      return 'Resolved POS product still uses a legacy variation mapping. Sync this product first.';
    }

    return 'Resolved POS product is not stockable';
  }

  private numberOrNull(value: number | null | undefined) {
    if (value === null || value === undefined) {
      return null;
    }

    return Number(value);
  }

  private parseOptionalDate(value: string | null | undefined) {
    const normalized = this.cleanOptionalText(value);
    if (!normalized) {
      return null;
    }

    const parsed = new Date(normalized);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(`Invalid date value: ${value}`);
    }

    return parsed;
  }

  private cleanOptionalText(value: string | null | undefined) {
    const cleaned = value?.trim();
    return cleaned ? cleaned : null;
  }

  private toJsonValue(value: Record<string, unknown> | undefined) {
    if (!value) {
      return undefined;
    }

    return value as Prisma.InputJsonValue;
  }

  private formatRequestTypeLabel(value: WmsPurchasingRequestType) {
    return value === WmsPurchasingRequestType.SELF_BUY ? 'Self-buy' : 'Procurement';
  }

  private formatStatusLabel(status: WmsPurchasingBatchStatus) {
    return status
      .split('_')
      .map((part) => part[0] + part.slice(1).toLowerCase())
      .join(' ');
  }

  private formatUserName(firstName: string | null, lastName: string | null) {
    const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();
    return fullName || 'Unknown user';
  }
}
