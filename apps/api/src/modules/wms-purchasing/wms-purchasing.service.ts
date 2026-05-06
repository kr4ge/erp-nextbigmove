import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  WmsPurchasingBatchStatus,
  WmsProductProfileStatus,
  WmsPurchasingRequestType,
  WmsPurchasingSourceType,
  WmsWarehouseStatus,
} from '@prisma/client';
import { ClsService } from 'nestjs-cls';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  CreateWmsPurchasingBatchDto,
  type CreateWmsPurchasingBatchLineInput,
} from './dto/create-wms-purchasing-batch.dto';
import { GetWmsPurchasingOverviewDto } from './dto/get-wms-purchasing-overview.dto';
import { GetWmsPurchasingProductOptionsDto } from './dto/get-wms-purchasing-product-options.dto';
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
  WmsPurchasingBatchStatus.PENDING_PAYMENT,
  WmsPurchasingBatchStatus.PAYMENT_REVIEW,
  WmsPurchasingBatchStatus.RECEIVING_READY,
  WmsPurchasingBatchStatus.RECEIVING,
  WmsPurchasingBatchStatus.STOCKED,
  WmsPurchasingBatchStatus.REJECTED,
  WmsPurchasingBatchStatus.CANCELED,
];

const STATUS_TRANSITIONS: Record<WmsPurchasingBatchStatus, readonly WmsPurchasingBatchStatus[]> = {
  [WmsPurchasingBatchStatus.UNDER_REVIEW]: [
    WmsPurchasingBatchStatus.PENDING_PAYMENT,
    WmsPurchasingBatchStatus.CANCELED,
  ],
  [WmsPurchasingBatchStatus.REVISION]: [
    WmsPurchasingBatchStatus.PENDING_PAYMENT,
    WmsPurchasingBatchStatus.REJECTED,
    WmsPurchasingBatchStatus.CANCELED,
  ],
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

    const summaryWhere: Prisma.WmsPurchasingBatchWhereInput = {
      tenantId: scope.activeTenantId,
      ...(activeStoreId ? { storeId: activeStoreId } : {}),
      ...(query.requestType ? { requestType: query.requestType } : {}),
      ...(normalizedSearch
        ? {
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
          }
        : {}),
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
          ...(activeStoreId ? { storeId: activeStoreId } : {}),
        },
        _count: {
          _all: true,
        },
      }),
      this.prisma.wmsPurchasingBatch.groupBy({
        by: ['status'],
        where: {
          tenantId: scope.activeTenantId,
          ...(activeStoreId ? { storeId: activeStoreId } : {}),
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

    const [total, profiles] = await Promise.all([
      this.prisma.wmsProductProfile.count({ where }),
      this.prisma.wmsProductProfile.findMany({
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
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

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
      products: profiles.map((profile) => {
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
      },
    });

    if (!batch) {
      throw new NotFoundException('Purchasing batch was not found');
    }

    this.assertBatchTenantScope(batch.tenantId, scope.activeTenantId);
    const invoiceBankDetails = await this.resolveInvoiceBankDetails();

    return {
      batch: this.mapBatchDetail(batch, invoiceBankDetails),
    };
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
    await this.validateTeam(scope.activeTenantId, body.teamId);

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

    if (status === WmsPurchasingBatchStatus.RECEIVING_READY) {
      this.validateReadyForReceiving({
        requestType: body.requestType,
        lines: lineData,
        invoiceNumber: body.invoiceNumber,
        paymentVerifiedAt: body.paymentVerifiedAt,
      });
    }

    const now = new Date();
    const created = await this.prisma.wmsPurchasingBatch.create({
      data: {
        tenantId: scope.activeTenantId,
        teamId: body.teamId ?? null,
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
        paymentProofImageUrl: this.cleanOptionalText(body.paymentProofImageUrl),
        paymentSubmittedAt: this.parseOptionalDate(body.paymentSubmittedAt),
        paymentProofSubmittedAt: this.cleanOptionalText(body.paymentProofImageUrl)
          ? this.parseOptionalDate(body.paymentSubmittedAt) ?? now
          : null,
        paymentProofSubmittedById: this.cleanOptionalText(body.paymentProofImageUrl)
          ? actorId
          : null,
        paymentVerifiedAt: this.parseOptionalDate(body.paymentVerifiedAt),
        readyForReceivingAt:
          status === WmsPurchasingBatchStatus.RECEIVING_READY ? now : null,
        submittedById: actorId,
        reviewedById:
          status === WmsPurchasingBatchStatus.REVISION
          || status === WmsPurchasingBatchStatus.PENDING_PAYMENT
          || status === WmsPurchasingBatchStatus.PAYMENT_REVIEW
          || status === WmsPurchasingBatchStatus.RECEIVING_READY
          || status === WmsPurchasingBatchStatus.RECEIVING
          || status === WmsPurchasingBatchStatus.STOCKED
            ? actorId
            : null,
        approvedById:
          status === WmsPurchasingBatchStatus.PENDING_PAYMENT
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
        events: {
          create: {
            tenantId: scope.activeTenantId,
            eventType: 'STATUS_CHANGED',
            toStatus: status,
            message: 'Purchasing batch created',
            actorId,
          },
        },
      },
      select: { id: true },
    });

    return this.getBatchById(created.id, scope.activeTenantId);
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

    if (batch.status !== WmsPurchasingBatchStatus.PENDING_PAYMENT) {
      throw new BadRequestException('Payment proof can only be submitted while payment is pending');
    }

    const paymentProofImageUrl = this.cleanOptionalText(body.paymentProofImageUrl);
    if (!paymentProofImageUrl) {
      throw new BadRequestException('Payment proof image URL is required');
    }

    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.wmsPurchasingBatch.update({
        where: { id: batch.id },
        data: {
          status: WmsPurchasingBatchStatus.PAYMENT_REVIEW,
          paymentProofImageUrl,
          paymentSubmittedAt: now,
          paymentProofSubmittedAt: now,
          paymentProofSubmittedById: actorId,
          sourceStatus: 'PAYMENT_REVIEW',
          updatedById: actorId,
        },
      });

      await tx.wmsPurchasingEvent.create({
        data: {
          batchId: batch.id,
          tenantId: batch.tenantId,
          eventType: 'PAYMENT_PROOF_SUBMITTED',
          fromStatus: batch.status,
          toStatus: WmsPurchasingBatchStatus.PAYMENT_REVIEW,
          message: this.cleanOptionalText(body.message) ?? 'Partner submitted payment proof',
          actorId,
          payload: {
            paymentProofImageUrl,
          },
        },
      });
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
            ? WmsPurchasingBatchStatus.PENDING_PAYMENT
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
            ? 'REVISION_ACCEPTED'
            : 'REVISION_REJECTED',
      },
      scope.activeTenantId,
      { bypassRevisionAcceptanceGuard: true },
    );
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
      const allowed = STATUS_TRANSITIONS[current.status];
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
    const effectivePaymentProofImageUrl =
      providedPaymentProofImageUrl ?? current.paymentProofImageUrl;

    const effectivePaymentSubmittedAt =
      body.paymentSubmittedAt === undefined
        ? current.paymentSubmittedAt
        : this.parseOptionalDate(body.paymentSubmittedAt);

    const effectivePaymentVerifiedAt =
      this.parseOptionalDate(body.paymentVerifiedAt)
      ?? (
        body.status === WmsPurchasingBatchStatus.RECEIVING_READY
        && effectivePaymentProofImageUrl
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

    if (body.status === WmsPurchasingBatchStatus.RECEIVING_READY) {
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
          paymentProofImageUrl:
            body.paymentProofImageUrl !== undefined ? effectivePaymentProofImageUrl : undefined,
          paymentProofSubmittedAt:
            body.paymentProofImageUrl !== undefined
              ? effectivePaymentProofImageUrl
                ? now
                : null
              : undefined,
          paymentProofSubmittedById:
            body.paymentProofImageUrl !== undefined
              ? effectivePaymentProofImageUrl
                ? actorId
                : null
              : undefined,
          paymentVerifiedAt:
            body.paymentVerifiedAt !== undefined
            || (
              body.status === WmsPurchasingBatchStatus.RECEIVING_READY
              && effectivePaymentProofImageUrl
            )
              ? effectivePaymentVerifiedAt
              : undefined,
          sourceStatus: nextSourceStatus ?? undefined,
          readyForReceivingAt:
            body.status === WmsPurchasingBatchStatus.RECEIVING_READY
              ? now
              : undefined,
          reviewedById:
            body.status === WmsPurchasingBatchStatus.REVISION
            || body.status === WmsPurchasingBatchStatus.PENDING_PAYMENT
            || body.status === WmsPurchasingBatchStatus.PAYMENT_REVIEW
            || body.status === WmsPurchasingBatchStatus.RECEIVING_READY
            || body.status === WmsPurchasingBatchStatus.RECEIVING
            || body.status === WmsPurchasingBatchStatus.STOCKED
              ? actorId
              : undefined,
          approvedById:
            body.status === WmsPurchasingBatchStatus.PENDING_PAYMENT
            || body.status === WmsPurchasingBatchStatus.PAYMENT_REVIEW
            || body.status === WmsPurchasingBatchStatus.RECEIVING_READY
            || body.status === WmsPurchasingBatchStatus.RECEIVING
            || body.status === WmsPurchasingBatchStatus.STOCKED
              ? actorId
              : undefined,
          updatedById: actorId,
        },
      });

      await tx.wmsPurchasingEvent.create({
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
            paymentVerifiedAt: effectivePaymentVerifiedAt,
            sourceStatus: nextSourceStatus,
          },
        },
      });
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
    const nextPartnerUnitCost =
      body.partnerUnitCost === undefined
        ? this.toNumber(line.partnerUnitCost)
        : this.numberOrNull(body.partnerUnitCost);
    const nextSupplierUnitCost =
      body.supplierUnitCost === undefined
        ? this.toNumber(line.supplierUnitCost)
        : this.numberOrNull(body.supplierUnitCost);
    const didChangeCommercialTerms =
      approvedQuantity !== line.approvedQuantity
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
      originalApprovedQuantity: baseSnapshot.originalApprovedQuantity ?? line.approvedQuantity,
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
            body.supplierUnitCost === undefined
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
        await tx.wmsPurchasingEvent.create({
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
            autoRequestedRevision: shouldAutoRequestRevision,
          },
        },
      });
    });

    return this.getBatchById(batchId, scope.activeTenantId);
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
          status: WmsPurchasingBatchStatus.RECEIVING_READY,
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

  private mapBatchDetail(
    batch: PurchasingBatchDetailRecord,
    invoiceBankDetails: InvoiceBankDetailsRecord | null,
  ) {
    const listRow = this.mapBatchListRow(batch);

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

      if (usedLineNos.has(lineNo)) {
        throw new BadRequestException(`Duplicate line number detected: ${lineNo}`);
      }
      usedLineNos.add(lineNo);

      if (line.approvedQuantity !== undefined && line.approvedQuantity > line.requestedQuantity) {
        throw new BadRequestException(
          `Line ${lineNo}: approved quantity cannot exceed requested quantity`,
        );
      }

      await this.validateResolutionTargets(
        input.tenantId,
        input.storeId,
        line.resolvedPosProductId,
        line.resolvedProfileId,
      );

      normalized.push({
        tenantId: input.tenantId,
        storeId: input.storeId,
        lineNo,
        sourceItemId: this.cleanOptionalText(line.sourceItemId),
        sourceSnapshot: this.toJsonValue({
          ...(line.sourceSnapshot ?? {}),
          originalPartnerUnitCost:
            line.partnerUnitCost === undefined ? null : this.numberOrNull(line.partnerUnitCost),
          originalSupplierUnitCost:
            line.supplierUnitCost === undefined ? null : this.numberOrNull(line.supplierUnitCost),
          originalApprovedQuantity: line.approvedQuantity ?? line.requestedQuantity,
        }),
        productId: this.cleanOptionalText(line.productId),
        variationId: this.cleanOptionalText(line.variationId),
        requestedProductName: this.cleanOptionalText(line.requestedProductName),
        uom: this.cleanOptionalText(line.uom),
        requestedQuantity: line.requestedQuantity,
        approvedQuantity: line.approvedQuantity ?? null,
        partnerUnitCost: this.numberOrNull(line.partnerUnitCost),
        supplierUnitCost: this.numberOrNull(line.supplierUnitCost),
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

  private async validateTeam(tenantId: string, teamId?: string) {
    if (!teamId) {
      return;
    }

    const team = await this.prisma.team.findFirst({
      where: {
        id: teamId,
        tenantId,
      },
      select: { id: true },
    });

    if (!team) {
      throw new BadRequestException('Selected team is outside tenant scope');
    }
  }

  private async validateResolutionTargets(
    tenantId: string,
    storeId: string,
    resolvedPosProductId?: string,
    resolvedProfileId?: string,
  ) {
    if (resolvedPosProductId) {
      const posProduct = await this.prisma.posProduct.findFirst({
        where: {
          id: resolvedPosProductId,
          storeId,
          store: {
            tenantId,
          },
        },
        select: { id: true },
      });

      if (!posProduct) {
        throw new BadRequestException('Resolved POS product is outside tenant/store scope');
      }
    }

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
    }
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
