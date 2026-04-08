import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  AuditWmsStockRequestDto,
  CreateWmsStockRequestDto,
  CreateWmsStockRequestPaymentDto,
  ListWmsForecastsDto,
  ListWmsInvoicesDto,
  ListWmsPaymentsDto,
  ListWmsRequestProductsDto,
  ListWmsStockRequestsDto,
  RespondWmsStockRequestDto,
  ReviewWmsStockRequestDto,
  UpdateWmsStockRequestDto,
  UpsertWmsCompanyBillingSettingsDto,
  VerifyWmsStockRequestPaymentDto,
} from './dto';

type RequestableProductRecord = Prisma.PosProductGetPayload<{
  include: {
    store: {
      select: {
        id: true;
        name: true;
        shopId: true;
        shopName: true;
        tenant: {
          select: {
            id: true;
            name: true;
            slug: true;
            companyName: true;
            billingAddress: true;
          };
        };
      };
    };
    wmsSkuProfile: true;
  };
}>;

const MANILA_TIMEZONE = 'Asia/Manila';
const FORECAST_OPEN_ORDER_STATUSES = new Set([1, 9]);
const FORECAST_RETURNING_ORDER_STATUSES = new Set([4]);
const FORECAST_ALLOWED_RUN_DAYS = new Set([1, 3, 5]);
const PROCUREMENT_REQUEST_TYPE = 'WMS_PROCUREMENT';
const SELF_BUY_REQUEST_TYPE = 'PARTNER_SELF_BUY';

@Injectable()
export class WmsRequestsService {
  constructor(private readonly prisma: PrismaService) {}

  private getRequestReader(
    client?: Prisma.TransactionClient,
  ): Prisma.TransactionClient | PrismaService {
    return client || this.prisma;
  }

  private normalizeText(value?: string | null) {
    const next = value?.trim();
    return next ? next : null;
  }

  private formatDateStringParts(parts: { year: number; month: number; day: number }) {
    return [
      String(parts.year).padStart(4, '0'),
      String(parts.month).padStart(2, '0'),
      String(parts.day).padStart(2, '0'),
    ].join('-');
  }

  private parseDateString(value: string) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) {
      return null;
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);

    if (
      !Number.isInteger(year) ||
      !Number.isInteger(month) ||
      !Number.isInteger(day) ||
      month < 1 ||
      month > 12 ||
      day < 1 ||
      day > 31
    ) {
      return null;
    }

    return { year, month, day };
  }

  private getManilaDateString(date = new Date()) {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: MANILA_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);

    const year = Number(parts.find((part) => part.type === 'year')?.value);
    const month = Number(parts.find((part) => part.type === 'month')?.value);
    const day = Number(parts.find((part) => part.type === 'day')?.value);

    return this.formatDateStringParts({ year, month, day });
  }

  private addDaysToDateString(value: string, days: number) {
    const parts = this.parseDateString(value);
    if (!parts) {
      throw new BadRequestException('Forecast run date must use YYYY-MM-DD.');
    }

    const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
    date.setUTCDate(date.getUTCDate() + days);

    return this.formatDateStringParts({
      year: date.getUTCFullYear(),
      month: date.getUTCMonth() + 1,
      day: date.getUTCDate(),
    });
  }

  private getDateStringWeekday(value: string) {
    const parts = this.parseDateString(value);
    if (!parts) {
      throw new BadRequestException('Forecast run date must use YYYY-MM-DD.');
    }

    return new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay();
  }

  private getDefaultForecastRunDate(referenceDate = new Date()) {
    let candidate = this.getManilaDateString(referenceDate);

    while (!FORECAST_ALLOWED_RUN_DAYS.has(this.getDateStringWeekday(candidate))) {
      candidate = this.addDaysToDateString(candidate, -1);
    }

    return candidate;
  }

  private resolveForecastRunDate(runDate?: string | null) {
    const next = this.normalizeText(runDate) || this.getDefaultForecastRunDate();
    if (!this.parseDateString(next)) {
      throw new BadRequestException('Forecast run date must use YYYY-MM-DD.');
    }

    if (!FORECAST_ALLOWED_RUN_DAYS.has(this.getDateStringWeekday(next))) {
      throw new BadRequestException(
        'Forecast run date must fall on Monday, Wednesday, or Friday.',
      );
    }

    return next;
  }

  private toNumber(value: Prisma.Decimal | null | undefined) {
    return value == null ? null : Number(value);
  }

  private toDecimal(value: number | string | Prisma.Decimal | null | undefined) {
    if (value instanceof Prisma.Decimal) {
      return value;
    }

    if (typeof value === 'number' || typeof value === 'string') {
      return new Prisma.Decimal(value);
    }

    return new Prisma.Decimal(0);
  }

  private toObject(value: Prisma.JsonValue | null | undefined) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }

    return value as Record<string, unknown>;
  }

  private toText(value: unknown) {
    if (typeof value === 'string') {
      return value.trim();
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value);
    }

    return '';
  }

  private toCount(value: unknown) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string') {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : 0;
    }

    return 0;
  }

  private isSelfBuyRequestType(value?: string | null) {
    return value === SELF_BUY_REQUEST_TYPE;
  }

  private buildRequestCode() {
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
    return `REQ-${stamp}-${suffix}`;
  }

  private buildInvoiceCode() {
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
    return `INV-${stamp}-${suffix}`;
  }

  private buildPaymentCode() {
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
    return `PAY-${stamp}-${suffix}`;
  }

  private resolveProductImage(snapshot: Prisma.JsonValue | null | undefined) {
    const root = this.toObject(snapshot);
    if (!root) {
      return null;
    }

    const images = Array.isArray(root.images) ? root.images : [];
    const firstImage = images.find(
      (entry) => typeof entry === 'string' && entry.trim().length > 0,
    );
    if (typeof firstImage === 'string') {
      return firstImage.trim();
    }

    const product = this.toObject(root.product as Prisma.JsonValue | null);
    const productImage = product?.image;
    if (typeof productImage === 'string' && productImage.trim().length > 0) {
      return productImage.trim();
    }

    const image = root.image;
    if (typeof image === 'string' && image.trim().length > 0) {
      return image.trim();
    }

    return null;
  }

  private parseSnapshotItems(value: unknown) {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .map((entry) => {
        const item = this.toObject(entry as Prisma.JsonValue | null);
        if (!item) {
          return null;
        }

        const variation = this.toObject(
          (item.variation_info || item.variationInfo) as Prisma.JsonValue | null,
        );

        return {
          variationId: this.toText(
            item.variation_id || item.variationId || variation?.id || item.id,
          ),
          productId: this.toText(
            item.product_id ||
              item.productId ||
              variation?.product_id ||
              variation?.productId ||
              item.id,
          ),
          quantity: this.toCount(item.quantity),
        };
      })
      .filter(
        (entry): entry is { variationId: string; productId: string; quantity: number } =>
          Boolean(entry && entry.quantity > 0 && (entry.variationId || entry.productId)),
      );
  }

  private buildOrderAggregateKey(shopId: string, variationId?: string | null, productId?: string | null) {
    if (variationId && variationId.trim().length > 0) {
      return `${shopId}::variation::${variationId.trim()}`;
    }

    if (productId && productId.trim().length > 0) {
      return `${shopId}::product::${productId.trim()}`;
    }

    return null;
  }

  private mapBillingAddress(address: Prisma.JsonValue | null | undefined) {
    const value = this.toObject(address);
    if (!value) {
      return null;
    }

    return {
      line1: this.toText(value.line1),
      line2: this.toText(value.line2) || null,
      city: this.toText(value.city),
      province: this.toText(value.province) || null,
      postalCode: this.toText(value.postalCode) || null,
      country: this.toText(value.country),
    };
  }

  private mapPartnerType(
    type:
      | {
          id: string;
          key: string;
          name: string;
          description?: string | null;
          isDefault?: boolean;
          isActive?: boolean;
          createdAt?: Date;
          updatedAt?: Date;
        }
      | null
      | undefined,
  ) {
    if (!type) {
      return null;
    }

    return {
      id: type.id,
      key: type.key,
      name: type.name,
      description: type.description || null,
      isDefault: type.isDefault ?? false,
      isActive: type.isActive ?? true,
      createdAt: type.createdAt ?? null,
      updatedAt: type.updatedAt ?? null,
    };
  }

  private mapBillingSettings(
    settings:
      | {
          id: string;
          companyName: string;
          billingAddress: Prisma.JsonValue;
          bankName: string | null;
          bankAccountName: string | null;
          bankAccountNumber: string | null;
          bankAccountType: string | null;
          notes: string | null;
          updatedAt: Date;
        }
      | null
      | undefined,
  ) {
    if (!settings) {
      return null;
    }

    return {
      id: settings.id,
      companyName: settings.companyName,
      billingAddress: this.mapBillingAddress(settings.billingAddress),
      bankName: settings.bankName,
      bankAccountName: settings.bankAccountName,
      bankAccountNumber: settings.bankAccountNumber,
      bankAccountType: settings.bankAccountType,
      notes: settings.notes,
      updatedAt: settings.updatedAt,
    };
  }

  private mapRequestableProduct(product: RequestableProductRecord) {
    return {
      id: product.id,
      productId: product.productId,
      variationId: product.variationId,
      variationCustomId: product.variationCustomId,
      customId: product.customId,
      name: product.name,
      retailPrice: this.toNumber(product.retailPrice),
      imageUrl: this.resolveProductImage(product.productSnapshot),
      store: {
        id: product.store.id,
        name: product.store.name,
        shopId: product.store.shopId,
        shopName: product.store.shopName,
      },
      tenant: {
        id: product.store.tenant.id,
        name: product.store.tenant.name,
        slug: product.store.tenant.slug,
        companyName: product.store.tenant.companyName,
        billingAddress: this.mapBillingAddress(product.store.tenant.billingAddress),
      },
      skuProfile: product.wmsSkuProfile
        ? {
            id: product.wmsSkuProfile.id,
            code: product.wmsSkuProfile.code,
            barcode: product.wmsSkuProfile.barcode,
            status: product.wmsSkuProfile.status,
            isSerialized: product.wmsSkuProfile.isSerialized,
            supplierCost: this.toNumber(product.wmsSkuProfile.supplierCost),
            wmsUnitPrice: this.toNumber(product.wmsSkuProfile.wmsUnitPrice),
            isRequestable: product.wmsSkuProfile.isRequestable,
          }
        : null,
    };
  }

  private async loadRequestableProducts(
    query: ListWmsRequestProductsDto,
  ): Promise<RequestableProductRecord[]> {
    const search = this.normalizeText(query.search);
    const skuProfileFilter: Prisma.WmsSkuProfileNullableRelationFilter | undefined =
      query.requestableOnly
      ? {
          is: {
            isRequestable: true,
            status: 'ACTIVE' as const,
          },
        }
      : query.profileOnly
        ? {
            isNot: null,
          }
        : undefined;

    return this.prisma.posProduct.findMany({
      where: {
        variationId: { not: null },
        ...(query.tenantId ? { store: { tenantId: query.tenantId } } : {}),
        ...(query.storeId ? { storeId: query.storeId } : {}),
        ...(skuProfileFilter
          ? {
              wmsSkuProfile: skuProfileFilter,
            }
          : {}),
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { variationId: { contains: search, mode: 'insensitive' } },
                { variationCustomId: { contains: search, mode: 'insensitive' } },
                { customId: { contains: search, mode: 'insensitive' } },
                { productId: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      take: query.limit || 200,
      orderBy: [{ name: 'asc' }, { updatedAt: 'desc' }],
      include: {
        store: {
          select: {
            id: true,
            name: true,
            shopId: true,
            shopName: true,
            tenant: {
              select: {
                id: true,
                name: true,
                slug: true,
                companyName: true,
                billingAddress: true,
              },
            },
          },
        },
        wmsSkuProfile: true,
      },
    });
  }

  private async buildRequestLineSnapshots(
    tx: Prisma.TransactionClient,
    tenantId: string,
    storeId: string | null,
    requestType: string,
    items: Array<{
      posProductId: string;
      requestedQuantity: number;
      recommendedQuantity?: number;
      remainingQuantity?: number;
      pendingQuantity?: number;
      pastTwoDaysQuantity?: number;
      returningQuantity?: number;
      declaredUnitCost?: number;
      partnerNotes?: string;
    }>,
  ) {
    const posProductIds = [...new Set(items.map((item) => item.posProductId))];
    const products = await tx.posProduct.findMany({
      where: {
        id: { in: posProductIds },
        store: {
          tenantId,
        },
        ...(storeId ? { storeId } : {}),
      },
      include: {
        wmsSkuProfile: true,
      },
    });

    if (products.length !== posProductIds.length) {
      throw new BadRequestException('One or more requested products are invalid for this partner/store');
    }

    const productMap = new Map(products.map((product) => [product.id, product]));

    return items.map((item, index) => {
      const product = productMap.get(item.posProductId)!;
      const requestedQuantity = this.toDecimal(item.requestedQuantity);
      let supplierCost: Prisma.Decimal | null = null;
      let wmsUnitPrice = new Prisma.Decimal(0);
      let declaredUnitCost: Prisma.Decimal | null = null;

      if (requestType === PROCUREMENT_REQUEST_TYPE) {
        if (
          !product.wmsSkuProfile ||
          !product.wmsSkuProfile.isRequestable ||
          product.wmsSkuProfile.status !== 'ACTIVE'
        ) {
          throw new BadRequestException(`Product ${product.name} is not requestable`);
        }

        if (product.wmsSkuProfile.wmsUnitPrice == null) {
          throw new BadRequestException(
            `Product ${product.name} has no WMS price configured`,
          );
        }

        wmsUnitPrice = product.wmsSkuProfile.wmsUnitPrice;
        supplierCost = product.wmsSkuProfile.supplierCost;
      } else {
        declaredUnitCost =
          item.declaredUnitCost != null ? this.toDecimal(item.declaredUnitCost) : null;
      }

      const lineAmount =
        requestType === PROCUREMENT_REQUEST_TYPE
          ? requestedQuantity.mul(wmsUnitPrice)
          : requestedQuantity.mul(declaredUnitCost || new Prisma.Decimal(0));

      return {
        lineNo: index + 1,
        posProductId: product.id,
        skuProfileId: product.wmsSkuProfile?.id || null,
        sku:
          this.normalizeText(product.wmsSkuProfile?.code) ||
          this.normalizeText(product.variationId) ||
          this.normalizeText(product.variationCustomId) ||
          this.normalizeText(product.customId),
        productName: product.name,
        variationId: this.normalizeText(product.variationId),
        variationCustomId: this.normalizeText(product.variationCustomId),
        variationName: this.normalizeText(product.mapping),
        barcode: this.normalizeText(product.wmsSkuProfile?.barcode),
        requestedQuantity,
        recommendedQuantity:
          item.recommendedQuantity != null ? this.toDecimal(item.recommendedQuantity) : null,
        remainingQuantity:
          item.remainingQuantity != null ? this.toDecimal(item.remainingQuantity) : null,
        pendingQuantity:
          item.pendingQuantity != null ? this.toDecimal(item.pendingQuantity) : null,
        pastTwoDaysQuantity:
          item.pastTwoDaysQuantity != null ? this.toDecimal(item.pastTwoDaysQuantity) : null,
        returningQuantity:
          item.returningQuantity != null ? this.toDecimal(item.returningQuantity) : null,
        declaredUnitCost,
        confirmedUnitCost: null,
        supplierCost,
        wmsUnitPrice,
        lineAmount,
        partnerNotes: this.normalizeText(item.partnerNotes),
        isActive: true,
      };
    });
  }

  private computeRequestTotals(
    lines: Array<{
      requestedQuantity: Prisma.Decimal;
      wmsUnitPrice: Prisma.Decimal;
      lineAmount: Prisma.Decimal;
      isActive: boolean;
    }>,
    adjustmentAmount?: Prisma.Decimal | null,
  ) {
    const activeLines = lines.filter((line) => line.isActive);

    const totalQuantity = activeLines.reduce(
      (sum, line) => sum.add(line.requestedQuantity),
      new Prisma.Decimal(0),
    );
    const subtotal = activeLines.reduce(
      (sum, line) => sum.add(line.lineAmount),
      new Prisma.Decimal(0),
    );
    const adjustment = adjustmentAmount || new Prisma.Decimal(0);
    const totalAmount = subtotal.add(adjustment);

    return {
      totalItems: activeLines.length,
      totalQuantity,
      subtotal,
      adjustmentAmount: adjustment,
      totalAmount,
    };
  }

  private async getRequestOrThrow(
    id: string,
    client?: Prisma.TransactionClient,
  ) {
    const reader = this.getRequestReader(client);
    const request = await reader.wmsStockRequest.findUnique({
      where: { id },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
            companyName: true,
            billingAddress: true,
            partnerType: {
              select: {
                id: true,
                key: true,
                name: true,
              },
            },
          },
        },
        store: {
          select: {
            id: true,
            name: true,
            shopId: true,
            shopName: true,
          },
        },
        items: {
          orderBy: { lineNo: 'asc' },
        },
        invoice: {
          include: {
            lines: {
              orderBy: { lineNo: 'asc' },
            },
            payments: {
              orderBy: { submittedAt: 'desc' },
            },
          },
        },
        payments: {
          orderBy: { submittedAt: 'desc' },
        },
      },
    });

    if (!request) {
      throw new NotFoundException('Stock request not found');
    }

    return request;
  }

  private mapPayment(
    payment: Prisma.WmsStockRequestPaymentGetPayload<{
      include: {
        request: {
          select: {
            id: true;
            requestCode: true;
            tenant: {
              select: {
                id: true;
                name: true;
              };
            };
          };
        };
        invoice: {
          select: {
            id: true;
            invoiceCode: true;
          };
        };
      };
    }>,
  ) {
    return {
      id: payment.id,
      status: payment.status,
      proofUrl: payment.proofUrl,
      proofNote: payment.proofNote,
      remarks: payment.remarks,
      submittedAt: payment.submittedAt,
      verifiedAt: payment.verifiedAt,
      verifiedByUserId: payment.verifiedByUserId,
      request: {
        id: payment.request.id,
        requestCode: payment.request.requestCode,
        tenant: payment.request.tenant,
      },
      invoice: payment.invoice,
    };
  }

  private async getPaymentOrThrow(
    id: string,
    client?: Prisma.TransactionClient,
  ) {
    const reader = this.getRequestReader(client);
    const payment = await reader.wmsStockRequestPayment.findUnique({
      where: { id },
      include: {
        request: {
          select: {
            id: true,
            requestCode: true,
            tenant: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        invoice: {
          select: {
            id: true,
            invoiceCode: true,
          },
        },
      },
    });

    if (!payment) {
      throw new NotFoundException('Payment proof not found');
    }

    return payment;
  }

  private mapStockRequest(request: Awaited<ReturnType<WmsRequestsService['getRequestOrThrow']>>) {
    return {
      id: request.id,
      requestCode: request.requestCode,
      requestType: request.requestType,
      status: request.status,
      forecastRunDate: request.forecastRunDate,
      orderingWindow: request.orderingWindow,
      reviewRemarks: request.reviewRemarks,
      internalNotes: request.internalNotes,
      submittedAt: request.submittedAt,
      reviewedAt: request.reviewedAt,
      partnerRespondedAt: request.partnerRespondedAt,
      auditStartedAt: request.auditStartedAt,
      auditCompletedAt: request.auditCompletedAt,
      invoicedAt: request.invoicedAt,
      paymentSubmittedAt: request.paymentSubmittedAt,
      paymentVerifiedAt: request.paymentVerifiedAt,
      procurementStartedAt: request.procurementStartedAt,
      receivedAt: request.receivedAt,
      totalItems: request.totalItems,
      totalQuantity: this.toNumber(request.totalQuantity) || 0,
      subtotal: this.toNumber(request.subtotal) || 0,
      adjustmentAmount: this.toNumber(request.adjustmentAmount) || 0,
      totalAmount: this.toNumber(request.totalAmount) || 0,
      currency: request.currency,
      tenant: {
        id: request.tenant.id,
        name: request.tenant.name,
        slug: request.tenant.slug,
        companyName: request.tenant.companyName,
        billingAddress: this.mapBillingAddress(request.tenant.billingAddress),
        partnerType: this.mapPartnerType(request.tenant.partnerType),
      },
      store: request.store,
      items: request.items.map((item) => ({
        id: item.id,
        lineNo: item.lineNo,
        posProductId: item.posProductId,
        skuProfileId: item.skuProfileId,
        sku: item.sku,
        productName: item.productName,
        variationId: item.variationId,
        variationCustomId: item.variationCustomId,
        variationName: item.variationName,
        barcode: item.barcode,
        requestedQuantity: this.toNumber(item.requestedQuantity) || 0,
        recommendedQuantity: this.toNumber(item.recommendedQuantity),
        remainingQuantity: this.toNumber(item.remainingQuantity),
        pendingQuantity: this.toNumber(item.pendingQuantity),
        pastTwoDaysQuantity: this.toNumber(item.pastTwoDaysQuantity),
        returningQuantity: this.toNumber(item.returningQuantity),
        deliveredQuantity: this.toNumber(item.deliveredQuantity) || 0,
        acceptedQuantity: this.toNumber(item.acceptedQuantity) || 0,
        receivedQuantity: this.toNumber(item.receivedQuantity) || 0,
        declaredUnitCost: this.toNumber(item.declaredUnitCost),
        confirmedUnitCost: this.toNumber(item.confirmedUnitCost),
        supplierCost: this.toNumber(item.supplierCost),
        wmsUnitPrice: this.toNumber(item.wmsUnitPrice) || 0,
        lineAmount: this.toNumber(item.lineAmount) || 0,
        isActive: item.isActive,
        partnerNotes: item.partnerNotes,
        reviewRemarks: item.reviewRemarks,
        auditRemarks: item.auditRemarks,
      })),
      invoice: request.invoice
        ? {
            id: request.invoice.id,
            invoiceCode: request.invoice.invoiceCode,
            status: request.invoice.status,
            companyName: request.invoice.companyName,
            companyBillingAddress: this.mapBillingAddress(request.invoice.companyBillingAddress),
            partnerCompanyName: request.invoice.partnerCompanyName,
            partnerBillingAddress: this.mapBillingAddress(request.invoice.partnerBillingAddress),
            bankName: request.invoice.bankName,
            bankAccountName: request.invoice.bankAccountName,
            bankAccountNumber: request.invoice.bankAccountNumber,
            bankAccountType: request.invoice.bankAccountType,
            invoiceDate: request.invoice.invoiceDate,
            dueDate: request.invoice.dueDate,
            note: request.invoice.note,
            subtotal: this.toNumber(request.invoice.subtotal) || 0,
            adjustmentAmount: this.toNumber(request.invoice.adjustmentAmount) || 0,
            totalAmount: this.toNumber(request.invoice.totalAmount) || 0,
            amountDue: this.toNumber(request.invoice.amountDue) || 0,
            currency: request.invoice.currency,
            lines: request.invoice.lines.map((line) => ({
              id: line.id,
              lineNo: line.lineNo,
              requestLineId: line.requestLineId,
              posProductId: line.posProductId,
              sku: line.sku,
              productName: line.productName,
              variationId: line.variationId,
              variationCustomId: line.variationCustomId,
              variationName: line.variationName,
              quantity: this.toNumber(line.quantity) || 0,
              supplierCost: this.toNumber(line.supplierCost),
              wmsUnitPrice: this.toNumber(line.wmsUnitPrice) || 0,
              lineAmount: this.toNumber(line.lineAmount) || 0,
            })),
          }
        : null,
      payments: request.payments.map((payment) => ({
        id: payment.id,
        status: payment.status,
        proofUrl: payment.proofUrl,
        proofNote: payment.proofNote,
        remarks: payment.remarks,
        submittedAt: payment.submittedAt,
        verifiedAt: payment.verifiedAt,
        verifiedByUserId: payment.verifiedByUserId,
      })),
    };
  }

  async listPartnerTypes() {
    const types = await this.prisma.partnerType.findMany({
      where: { isActive: true },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });

    return types.map((type) => this.mapPartnerType(type));
  }

  async getCompanyBillingSettings() {
    const settings = await this.prisma.wmsCompanyBillingSettings.findFirst({
      orderBy: { createdAt: 'asc' },
    });

    return this.mapBillingSettings(settings);
  }

  async upsertCompanyBillingSettings(dto: UpsertWmsCompanyBillingSettingsDto) {
    const existing = await this.prisma.wmsCompanyBillingSettings.findFirst({
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });

    const payload = {
      companyName: dto.companyName.trim(),
      billingAddress: dto.billingAddress as unknown as Prisma.InputJsonValue,
      bankName: this.normalizeText(dto.bankName),
      bankAccountName: this.normalizeText(dto.bankAccountName),
      bankAccountNumber: this.normalizeText(dto.bankAccountNumber),
      bankAccountType: this.normalizeText(dto.bankAccountType),
      notes: this.normalizeText(dto.notes),
    };

    const settings = existing
      ? await this.prisma.wmsCompanyBillingSettings.update({
          where: { id: existing.id },
          data: payload,
        })
      : await this.prisma.wmsCompanyBillingSettings.create({
          data: payload,
        });

    return this.mapBillingSettings(settings);
  }

  async listRequestProducts(query: ListWmsRequestProductsDto) {
    const products = await this.loadRequestableProducts(query);
    return products.map((product) => this.mapRequestableProduct(product));
  }

  async listForecasts(query: ListWmsForecastsDto) {
    const requestType = query.requestType || PROCUREMENT_REQUEST_TYPE;
    const runDate = this.resolveForecastRunDate(query.runDate);
    const pastTwoDaysStart = this.addDaysToDateString(runDate, -2);
    const requestableOnly =
      query.requestableOnly ?? requestType === PROCUREMENT_REQUEST_TYPE;
    const profileOnly = query.profileOnly ?? false;
    const products = await this.loadRequestableProducts({
      tenantId: query.tenantId,
      storeId: query.storeId,
      search: query.search,
      requestableOnly,
      profileOnly,
      limit: query.limit,
    });

    if (products.length === 0) {
      return [];
    }

    const skuProfileIds = products
      .map((product) => product.wmsSkuProfile?.id)
      .filter((value): value is string => Boolean(value));
    const variationIds = products
      .map((product) => product.variationId)
      .filter((value): value is string => Boolean(value));
    const shopIds = [...new Set(products.map((product) => product.store.shopId))];

    const [availableUnits, fallbackBalances, pendingOrders, recentOrders, returningOrders] =
      await Promise.all([
        skuProfileIds.length
          ? this.prisma.wmsInventoryUnit.groupBy({
              by: ['skuProfileId'],
              where: {
                skuProfileId: { in: skuProfileIds },
                status: 'AVAILABLE',
              },
              _count: { _all: true },
            })
          : [],
        variationIds.length
          ? this.prisma.wmsInventoryBalance.groupBy({
              by: ['variationId'],
              where: {
                variationId: { in: variationIds },
              },
              _sum: {
                availableQuantity: true,
              },
            })
          : [],
        this.prisma.posOrder.findMany({
          where: {
            tenantId: query.tenantId,
            shopId: { in: shopIds },
            isVoid: false,
            isAbandoned: false,
            status: {
              in: Array.from(FORECAST_OPEN_ORDER_STATUSES),
            },
          },
          select: {
            shopId: true,
            orderSnapshot: true,
          },
        }),
        this.prisma.posOrder.findMany({
          where: {
            tenantId: query.tenantId,
            shopId: { in: shopIds },
            isVoid: false,
            isAbandoned: false,
            status: {
              in: Array.from(FORECAST_OPEN_ORDER_STATUSES),
            },
            dateLocal: {
              gte: pastTwoDaysStart,
              lte: runDate,
            },
          },
          select: {
            shopId: true,
            orderSnapshot: true,
          },
        }),
        this.prisma.posOrder.findMany({
          where: {
            tenantId: query.tenantId,
            shopId: { in: shopIds },
            isVoid: false,
            isAbandoned: false,
            status: {
              in: Array.from(FORECAST_RETURNING_ORDER_STATUSES),
            },
          },
          select: {
            shopId: true,
            orderSnapshot: true,
          },
        }),
      ]);

    const availableMap = new Map<string, number>();
    for (const row of availableUnits) {
      availableMap.set(row.skuProfileId || '', row._count._all);
    }

    const balanceMap = new Map<string, number>();
    for (const row of fallbackBalances) {
      if (row.variationId) {
        balanceMap.set(
          row.variationId,
          this.toNumber(row._sum.availableQuantity) || 0,
        );
      }
    }

    const buildAggregateMap = (
      orders: Array<{ shopId: string; orderSnapshot: Prisma.JsonValue | null }>,
    ) => {
      const map = new Map<string, number>();

      for (const order of orders) {
        const snapshot = this.toObject(order.orderSnapshot);
        const items = this.parseSnapshotItems(snapshot?.items);

        for (const item of items) {
          const key = this.buildOrderAggregateKey(
            order.shopId,
            item.variationId,
            item.productId,
          );
          if (!key) {
            continue;
          }

          map.set(key, (map.get(key) || 0) + item.quantity);
        }
      }

      return map;
    };

    const pendingMap = buildAggregateMap(pendingOrders);
    const recentMap = buildAggregateMap(recentOrders);
    const returningMap = buildAggregateMap(returningOrders);

    return products.map((product) => {
      const pendingKey = this.buildOrderAggregateKey(
        product.store.shopId,
        product.variationId,
        product.productId,
      );
      const onHand = product.wmsSkuProfile?.isSerialized
        ? availableMap.get(product.wmsSkuProfile.id) || 0
        : (product.variationId ? balanceMap.get(product.variationId) : null) || 0;
      const pending = pendingKey ? pendingMap.get(pendingKey) || 0 : 0;
      const pastTwoDays = pendingKey ? recentMap.get(pendingKey) || 0 : 0;
      const returning = pendingKey ? returningMap.get(pendingKey) || 0 : 0;
      const remainingStock = Math.max(onHand - pending, 0);
      const recommendedQuantity = pending + pastTwoDays - remainingStock;

      return {
        ...this.mapRequestableProduct(product),
        forecast: {
          runDate,
          remainingStock,
          pending,
          pastTwoDays,
          returning,
          recommendedQuantity,
          suggestedQuantity: recommendedQuantity > 0 ? recommendedQuantity : 0,
        },
      };
    });
  }

  async listStockRequests(query: ListWmsStockRequestsDto) {
    const requests = await this.prisma.wmsStockRequest.findMany({
      where: {
        ...(query.tenantId ? { tenantId: query.tenantId } : {}),
        ...(query.storeId ? { storeId: query.storeId } : {}),
        ...(query.status ? { status: query.status as any } : {}),
        ...(query.search
          ? {
              OR: [
                { requestCode: { contains: query.search, mode: 'insensitive' } },
                { tenant: { name: { contains: query.search, mode: 'insensitive' } } },
                { store: { name: { contains: query.search, mode: 'insensitive' } } },
              ],
            }
          : {}),
      },
      take: query.limit || 50,
      orderBy: [{ createdAt: 'desc' }],
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
            companyName: true,
            billingAddress: true,
            partnerType: {
              select: {
                id: true,
                key: true,
                name: true,
              },
            },
          },
        },
        store: {
          select: {
            id: true,
            name: true,
            shopId: true,
            shopName: true,
          },
        },
        items: {
          orderBy: { lineNo: 'asc' },
        },
        invoice: {
          include: {
            lines: true,
            payments: {
              orderBy: { submittedAt: 'desc' },
            },
          },
        },
        payments: {
          orderBy: { submittedAt: 'desc' },
        },
      },
    });

    return requests.map((request) => this.mapStockRequest(request as any));
  }

  async getStockRequest(id: string, client?: Prisma.TransactionClient) {
    const request = await this.getRequestOrThrow(id, client);
    return this.mapStockRequest(request);
  }

  async createStockRequest(dto: CreateWmsStockRequestDto) {
    return this.prisma.$transaction(async (tx) => {
      const requestType = dto.requestType || PROCUREMENT_REQUEST_TYPE;
      const tenant = await tx.tenant.findUnique({
        where: { id: dto.tenantId },
        select: { id: true },
      });

      if (!tenant) {
        throw new NotFoundException('Partner not found');
      }

      if (dto.storeId) {
        const store = await tx.posStore.findFirst({
          where: {
            id: dto.storeId,
            tenantId: dto.tenantId,
          },
          select: { id: true },
        });

        if (!store) {
          throw new BadRequestException('Store is invalid for this partner');
        }
      }

      const requestCode = this.buildRequestCode();
      const lines = await this.buildRequestLineSnapshots(
        tx,
        dto.tenantId,
        dto.storeId || null,
        requestType,
        dto.items,
      );
      const totals = this.computeRequestTotals(
        lines.map((line) => ({
          requestedQuantity: line.requestedQuantity,
          wmsUnitPrice: line.wmsUnitPrice,
          lineAmount: line.lineAmount,
          isActive: line.isActive,
        })),
        dto.adjustmentAmount != null ? this.toDecimal(dto.adjustmentAmount) : null,
      );
      const now = new Date();

      const request = await tx.wmsStockRequest.create({
        data: {
          requestCode,
          tenantId: dto.tenantId,
          storeId: dto.storeId || null,
          requestType,
          status: dto.submit ? 'SUBMITTED' : 'DRAFT',
          forecastRunDate: dto.forecastRunDate ? new Date(dto.forecastRunDate) : null,
          orderingWindow: this.normalizeText(dto.orderingWindow),
          internalNotes: this.normalizeText(dto.internalNotes),
          submittedAt: dto.submit ? now : null,
          currency: this.normalizeText(dto.currency)?.toUpperCase() || 'PHP',
          ...totals,
          items: {
            create: lines,
          },
        },
      });

      return this.getStockRequest(request.id, tx);
    });
  }

  async updateStockRequest(id: string, dto: UpdateWmsStockRequestDto) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.wmsStockRequest.findUnique({
        where: { id },
        select: {
          id: true,
          tenantId: true,
          storeId: true,
          requestType: true,
          status: true,
        },
      });

      if (!existing) {
        throw new NotFoundException('Stock request not found');
      }

      if (!['DRAFT', 'PARTNER_REJECTED', 'FEEDBACK_REQUIRED'].includes(existing.status)) {
        throw new BadRequestException('Only draft, rejected, or feedback requests can be edited');
      }

      let itemsMutation: Prisma.WmsStockRequestLineUpdateManyWithoutRequestNestedInput | undefined;
      let totals: ReturnType<WmsRequestsService['computeRequestTotals']> | undefined;

      if (dto.items) {
        const lines = await this.buildRequestLineSnapshots(
          tx,
          existing.tenantId,
          existing.storeId || null,
          existing.requestType,
          dto.items,
        );
        const nextTotals = this.computeRequestTotals(
          lines.map((line) => ({
            requestedQuantity: line.requestedQuantity,
            wmsUnitPrice: line.wmsUnitPrice,
            lineAmount: line.lineAmount,
            isActive: line.isActive,
          })),
          dto.adjustmentAmount != null ? this.toDecimal(dto.adjustmentAmount) : undefined,
        );
        itemsMutation = {
          deleteMany: {},
          create: lines,
        };
        totals = nextTotals;
      }

      const updateData: Prisma.WmsStockRequestUpdateInput = {
        forecastRunDate: dto.forecastRunDate ? new Date(dto.forecastRunDate) : undefined,
        orderingWindow:
          dto.orderingWindow !== undefined
            ? this.normalizeText(dto.orderingWindow)
            : undefined,
        internalNotes:
          dto.internalNotes !== undefined
            ? this.normalizeText(dto.internalNotes)
            : undefined,
        adjustmentAmount:
          dto.adjustmentAmount !== undefined ? this.toDecimal(dto.adjustmentAmount) : undefined,
        ...(totals
          ? {
              totalItems: totals.totalItems,
              totalQuantity: totals.totalQuantity,
              subtotal: totals.subtotal,
              totalAmount: totals.totalAmount,
            }
          : {}),
        ...(itemsMutation ? { items: itemsMutation } : {}),
      };

      await tx.wmsStockRequest.update({
        where: { id },
        data: updateData,
      });

      return this.getStockRequest(id, tx);
    });
  }

  async submitStockRequest(id: string) {
    await this.prisma.wmsStockRequest.updateMany({
      where: {
        id,
        status: {
          in: ['DRAFT', 'PARTNER_REJECTED', 'FEEDBACK_REQUIRED'],
        },
      },
      data: {
        status: 'SUBMITTED',
        submittedAt: new Date(),
      },
    });

    return this.getStockRequest(id);
  }

  async reviewStockRequest(id: string, dto: ReviewWmsStockRequestDto) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.wmsStockRequest.findUnique({
        where: { id },
        include: {
          items: {
            orderBy: { lineNo: 'asc' },
          },
        },
      });

      if (!existing) {
        throw new NotFoundException('Stock request not found');
      }

      if (existing.requestType !== PROCUREMENT_REQUEST_TYPE) {
        throw new BadRequestException('WMS review is only available for procurement requests');
      }

      if (existing.status !== 'SUBMITTED') {
        throw new BadRequestException('Only submitted requests can be reviewed');
      }

      const linePatchMap = new Map(dto.items.map((item) => [item.id, item]));

      if (linePatchMap.size !== dto.items.length) {
        throw new BadRequestException('Duplicate request lines in review payload');
      }

      for (const item of dto.items) {
        if (!existing.items.find((line) => line.id === item.id)) {
          throw new BadRequestException('Review payload contains invalid request line');
        }
      }

      const updatedLines = existing.items.map((line) => {
        const patch = linePatchMap.get(line.id);
        const requestedQuantity =
          patch?.requestedQuantity != null
            ? this.toDecimal(patch.requestedQuantity)
            : line.requestedQuantity;
        const supplierCost =
          patch?.supplierCost != null ? this.toDecimal(patch.supplierCost) : line.supplierCost;
        const wmsUnitPrice =
          patch?.wmsUnitPrice != null ? this.toDecimal(patch.wmsUnitPrice) : line.wmsUnitPrice;
        const isActive = patch?.isActive ?? line.isActive;
        const lineAmount = isActive
          ? requestedQuantity.mul(wmsUnitPrice)
          : new Prisma.Decimal(0);

        return {
          id: line.id,
          requestedQuantity,
          supplierCost,
          wmsUnitPrice,
          isActive,
          reviewRemarks:
            patch?.reviewRemarks !== undefined
              ? this.normalizeText(patch.reviewRemarks)
              : line.reviewRemarks,
          lineAmount,
        };
      });

      for (const line of updatedLines) {
        await tx.wmsStockRequestLine.update({
          where: { id: line.id },
          data: {
            requestedQuantity: line.requestedQuantity,
            supplierCost: line.supplierCost,
            wmsUnitPrice: line.wmsUnitPrice,
            isActive: line.isActive,
            reviewRemarks: line.reviewRemarks,
            lineAmount: line.lineAmount,
          },
        });
      }

      await tx.wmsStockRequest.update({
        where: { id },
        data: {
          status: 'WMS_REVIEWED',
          reviewedAt: new Date(),
          reviewRemarks: this.normalizeText(dto.reviewRemarks),
          ...this.computeRequestTotals(
            updatedLines,
            dto.adjustmentAmount != null
              ? this.toDecimal(dto.adjustmentAmount)
              : existing.adjustmentAmount,
          ),
        },
      });

      return this.getStockRequest(id, tx);
    });
  }

  async respondToStockRequest(id: string, dto: RespondWmsStockRequestDto) {
    return this.prisma.$transaction(async (tx) => {
      const request = await tx.wmsStockRequest.findUnique({
        where: { id },
        include: {
          tenant: {
            select: {
              id: true,
              companyName: true,
              billingAddress: true,
            },
          },
          items: {
            where: { isActive: true },
            orderBy: { lineNo: 'asc' },
          },
          invoice: {
            select: { id: true },
          },
        },
      });

      if (!request) {
        throw new NotFoundException('Stock request not found');
      }

      if (request.requestType !== PROCUREMENT_REQUEST_TYPE) {
        throw new BadRequestException('Partner confirmation is only available for procurement requests');
      }

      if (request.status !== 'WMS_REVIEWED') {
        throw new BadRequestException('Only reviewed requests can receive partner feedback');
      }

      const partnerRespondedAt = new Date();

      if (dto.action === 'REJECT') {
        await tx.wmsStockRequest.update({
          where: { id },
          data: {
            status: 'PARTNER_REJECTED',
            partnerRespondedAt,
            internalNotes: this.normalizeText(dto.note) || request.internalNotes,
          },
        });

        return this.getStockRequest(id, tx);
      }

      if (request.invoice) {
        throw new ConflictException('Invoice already exists for this request');
      }

      const companySettings = await tx.wmsCompanyBillingSettings.findFirst({
        orderBy: { createdAt: 'asc' },
      });

      if (!companySettings) {
        throw new BadRequestException('WMS billing settings must be configured before confirming a request');
      }

      if (!request.tenant.companyName || !request.tenant.billingAddress) {
        throw new BadRequestException('Partner company name and billing address are required before invoicing');
      }

      const invoiceDate = new Date();
      const dueDate = new Date(invoiceDate);
      const invoiceCode = this.buildInvoiceCode();

      const invoice = await tx.wmsStockRequestInvoice.create({
        data: {
          requestId: request.id,
          tenantId: request.tenantId,
          invoiceCode,
          status: 'UNPAID',
          companyName: companySettings.companyName,
          companyBillingAddress:
            companySettings.billingAddress as Prisma.InputJsonValue,
          partnerCompanyName: request.tenant.companyName,
          partnerBillingAddress:
            request.tenant.billingAddress as Prisma.InputJsonValue,
          bankName: companySettings.bankName,
          bankAccountName: companySettings.bankAccountName,
          bankAccountNumber: companySettings.bankAccountNumber,
          bankAccountType: companySettings.bankAccountType,
          invoiceDate,
          dueDate,
          note: this.normalizeText(dto.note) || companySettings.notes,
          subtotal: request.subtotal,
          adjustmentAmount: request.adjustmentAmount,
          totalAmount: request.totalAmount,
          amountDue: request.totalAmount,
          currency: request.currency,
          lines: {
            create: request.items.map((line) => ({
              lineNo: line.lineNo,
              requestLineId: line.id,
              posProductId: line.posProductId,
              sku: line.sku,
              productName: line.productName,
              variationId: line.variationId,
              variationCustomId: line.variationCustomId,
              variationName: line.variationName,
              quantity: line.requestedQuantity,
              supplierCost: line.supplierCost,
              wmsUnitPrice: line.wmsUnitPrice,
              lineAmount: line.lineAmount,
            })),
          },
        },
      });

      await tx.wmsStockRequest.update({
        where: { id },
        data: {
          status: 'INVOICED',
          partnerRespondedAt,
          invoicedAt: invoiceDate,
        },
      });

      return this.getStockRequest(id, tx);
    });
  }

  async markRequestInProcurement(id: string) {
    const request = await this.prisma.wmsStockRequest.findUnique({
      where: { id },
      select: { id: true, requestType: true, status: true },
    });

    if (!request) {
      throw new NotFoundException('Stock request not found');
    }

    if (request.requestType !== PROCUREMENT_REQUEST_TYPE) {
      throw new BadRequestException('Only procurement requests can move into procurement');
    }

    if (request.status !== 'PAYMENT_VERIFIED') {
      throw new BadRequestException('Only payment-verified requests can move into procurement');
    }

    await this.prisma.wmsStockRequest.update({
      where: { id },
      data: {
        status: 'IN_PROCUREMENT',
        procurementStartedAt: new Date(),
      },
    });

    return this.getStockRequest(id);
  }

  async startStockRequestAudit(id: string) {
    const request = await this.prisma.wmsStockRequest.findUnique({
      where: { id },
      select: { id: true, requestType: true, status: true },
    });

    if (!request) {
      throw new NotFoundException('Stock request not found');
    }

    if (request.requestType !== SELF_BUY_REQUEST_TYPE) {
      throw new BadRequestException('Only self-buy requests can enter audit');
    }

    if (!['SUBMITTED', 'FEEDBACK_REQUIRED'].includes(request.status)) {
      throw new BadRequestException('Only submitted or feedback requests can start audit');
    }

    await this.prisma.wmsStockRequest.update({
      where: { id },
      data: {
        status: 'UNDER_AUDIT',
        auditStartedAt: new Date(),
      },
    });

    return this.getStockRequest(id);
  }

  async auditStockRequest(id: string, dto: AuditWmsStockRequestDto) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.wmsStockRequest.findUnique({
        where: { id },
        include: {
          items: {
            orderBy: { lineNo: 'asc' },
          },
        },
      });

      if (!existing) {
        throw new NotFoundException('Stock request not found');
      }

      if (existing.requestType !== SELF_BUY_REQUEST_TYPE) {
        throw new BadRequestException('Only self-buy requests can be audited');
      }

      if (existing.status !== 'UNDER_AUDIT') {
        throw new BadRequestException('Only requests under audit can be completed');
      }

      const linePatchMap = new Map(dto.items.map((item) => [item.id, item]));

      if (linePatchMap.size !== dto.items.length) {
        throw new BadRequestException('Duplicate request lines in audit payload');
      }

      for (const item of dto.items) {
        if (!existing.items.find((line) => line.id === item.id)) {
          throw new BadRequestException('Audit payload contains invalid request line');
        }
      }

      const updatedLines = existing.items.map((line) => {
        const patch = linePatchMap.get(line.id);
        if (!patch) {
          throw new BadRequestException('Audit payload must include every request line');
        }

        const deliveredQuantity = this.toDecimal(patch.deliveredQuantity);
        const acceptedQuantity = this.toDecimal(patch.acceptedQuantity);
        const confirmedUnitCost = this.toDecimal(patch.confirmedUnitCost);

        if (acceptedQuantity.greaterThan(deliveredQuantity)) {
          throw new BadRequestException(
            `Accepted quantity cannot exceed delivered quantity for ${line.productName}`,
          );
        }

        const lineAmount = acceptedQuantity.mul(confirmedUnitCost);

        return {
          id: line.id,
          posProductId: line.posProductId,
          productName: line.productName,
          variationId: line.variationId,
          sku: line.sku,
          barcode: line.barcode,
          deliveredQuantity,
          acceptedQuantity,
          confirmedUnitCost,
          auditRemarks: this.normalizeText(patch.auditRemarks),
          lineAmount,
        };
      });

      const activeAcceptedLines = updatedLines.filter((line) =>
        line.acceptedQuantity.greaterThan(new Prisma.Decimal(0)),
      );

      const activeProfileMap = new Map<
        string,
        {
          skuProfileId: string;
          code: string | null;
          barcode: string | null;
        }
      >();

      if (dto.action === 'ACCEPT' && activeAcceptedLines.length > 0) {
        const products = await tx.posProduct.findMany({
          where: {
            id: {
              in: activeAcceptedLines.map((line) => line.posProductId),
            },
          },
          select: {
            id: true,
            wmsSkuProfile: {
              select: {
                id: true,
                status: true,
                code: true,
                barcode: true,
              },
            },
          },
        });

        const missingProfiles = activeAcceptedLines.filter((line) => {
          const product = products.find((entry) => entry.id === line.posProductId);
          return !product?.wmsSkuProfile || product.wmsSkuProfile.status !== 'ACTIVE';
        });

        if (missingProfiles.length > 0) {
          throw new ConflictException(
            `Configure an active warehouse profile before accepting audit for: ${missingProfiles
              .map((line) => line.productName)
              .join(', ')}`,
          );
        }

        for (const product of products) {
          if (!product.wmsSkuProfile || product.wmsSkuProfile.status !== 'ACTIVE') {
            continue;
          }

          activeProfileMap.set(product.id, {
            skuProfileId: product.wmsSkuProfile.id,
            code: product.wmsSkuProfile.code || null,
            barcode: product.wmsSkuProfile.barcode || null,
          });
        }
      }

      for (const line of updatedLines) {
        const profileContext = activeProfileMap.get(line.posProductId);
        await tx.wmsStockRequestLine.update({
          where: { id: line.id },
          data: {
            deliveredQuantity: line.deliveredQuantity,
            acceptedQuantity: line.acceptedQuantity,
            confirmedUnitCost: line.confirmedUnitCost,
            auditRemarks: line.auditRemarks,
            lineAmount: line.lineAmount,
            ...(profileContext
              ? {
                  skuProfileId: profileContext.skuProfileId,
                  sku:
                    profileContext.code ||
                    this.normalizeText(line.variationId) ||
                    this.normalizeText(line.sku),
                  barcode: profileContext.barcode || this.normalizeText(line.barcode),
                }
              : {}),
          },
        });
      }

      const activeLines = updatedLines.filter((line) =>
        line.acceptedQuantity.greaterThan(new Prisma.Decimal(0)),
      );
      const subtotal = activeLines.reduce(
        (sum, line) => sum.add(line.lineAmount),
        new Prisma.Decimal(0),
      );
      const totalQuantity = activeLines.reduce(
        (sum, line) => sum.add(line.acceptedQuantity),
        new Prisma.Decimal(0),
      );

      await tx.wmsStockRequest.update({
        where: { id },
        data: {
          status: dto.action === 'ACCEPT' ? 'AUDIT_ACCEPTED' : 'FEEDBACK_REQUIRED',
          reviewRemarks: this.normalizeText(dto.auditRemarks),
          auditCompletedAt: new Date(),
          totalItems: activeLines.length,
          totalQuantity,
          subtotal,
          totalAmount: subtotal.add(existing.adjustmentAmount),
        },
      });

      return this.getStockRequest(id, tx);
    });
  }

  async listInvoices(query: ListWmsInvoicesDto) {
    const invoices = await this.prisma.wmsStockRequestInvoice.findMany({
      where: {
        ...(query.tenantId ? { tenantId: query.tenantId } : {}),
        ...(query.status ? { status: query.status as any } : {}),
        ...(query.search
          ? {
              OR: [
                { invoiceCode: { contains: query.search, mode: 'insensitive' } },
                { request: { requestCode: { contains: query.search, mode: 'insensitive' } } },
                { tenant: { name: { contains: query.search, mode: 'insensitive' } } },
              ],
            }
          : {}),
      },
      take: query.limit || 50,
      orderBy: [{ createdAt: 'desc' }],
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        request: {
          select: {
            id: true,
            requestCode: true,
            status: true,
          },
        },
        lines: {
          orderBy: { lineNo: 'asc' },
        },
        payments: {
          orderBy: { submittedAt: 'desc' },
        },
      },
    });

    return invoices.map((invoice) => ({
      id: invoice.id,
      invoiceCode: invoice.invoiceCode,
      status: invoice.status,
      invoiceDate: invoice.invoiceDate,
      dueDate: invoice.dueDate,
      subtotal: this.toNumber(invoice.subtotal) || 0,
      adjustmentAmount: this.toNumber(invoice.adjustmentAmount) || 0,
      totalAmount: this.toNumber(invoice.totalAmount) || 0,
      amountDue: this.toNumber(invoice.amountDue) || 0,
      currency: invoice.currency,
      tenant: invoice.tenant,
      request: invoice.request,
      lines: invoice.lines.map((line) => ({
        id: line.id,
        lineNo: line.lineNo,
        productName: line.productName,
        variationCustomId: line.variationCustomId,
        variationName: line.variationName,
        quantity: this.toNumber(line.quantity) || 0,
        wmsUnitPrice: this.toNumber(line.wmsUnitPrice) || 0,
        lineAmount: this.toNumber(line.lineAmount) || 0,
      })),
      payments: invoice.payments.map((payment) => ({
        id: payment.id,
        status: payment.status,
        proofUrl: payment.proofUrl,
        submittedAt: payment.submittedAt,
      })),
    }));
  }

  async listPayments(query: ListWmsPaymentsDto) {
    const payments = await this.prisma.wmsStockRequestPayment.findMany({
      where: {
        ...(query.status ? { status: query.status as any } : {}),
        ...(query.tenantId ? { request: { tenantId: query.tenantId } } : {}),
        ...(query.search
          ? {
              OR: [
                { proofNote: { contains: query.search, mode: 'insensitive' } },
                { invoice: { invoiceCode: { contains: query.search, mode: 'insensitive' } } },
                { request: { requestCode: { contains: query.search, mode: 'insensitive' } } },
              ],
            }
          : {}),
      },
      take: query.limit || 50,
      orderBy: [{ submittedAt: 'desc' }],
      include: {
        request: {
          select: {
            id: true,
            requestCode: true,
            tenant: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        invoice: {
          select: {
            id: true,
            invoiceCode: true,
          },
        },
      },
    });

    return payments.map((payment) => this.mapPayment(payment));
  }

  async submitPayment(requestId: string, dto: CreateWmsStockRequestPaymentDto) {
    return this.prisma.$transaction(async (tx) => {
      const request = await tx.wmsStockRequest.findUnique({
        where: { id: requestId },
        include: {
          invoice: {
            select: {
              id: true,
              amountDue: true,
            },
          },
        },
      });

      if (!request) {
        throw new NotFoundException('Stock request not found');
      }

      if (!request.invoice) {
        throw new BadRequestException('Invoice must exist before payment proof can be submitted');
      }

      if (!['INVOICED', 'PAYMENT_SUBMITTED'].includes(request.status)) {
        throw new BadRequestException('Payment proof can only be submitted for invoiced requests');
      }

      const paymentCode = this.buildPaymentCode();
      const submittedAt = new Date();

      const payment = await tx.wmsStockRequestPayment.create({
        data: {
          requestId,
          invoiceId: request.invoice.id,
          status: 'SUBMITTED',
          proofUrl: dto.proofUrl.trim(),
          proofNote: this.normalizeText(dto.proofNote),
          metadata: {
            paymentCode,
          },
          submittedAt,
        },
      });

      await tx.wmsStockRequest.update({
        where: { id: requestId },
        data: {
          status: 'PAYMENT_SUBMITTED',
          paymentSubmittedAt: submittedAt,
        },
      });

      await tx.wmsStockRequestInvoice.update({
        where: { id: request.invoice.id },
        data: {
          status: 'PAYMENT_SUBMITTED',
        },
      });

      return this.mapPayment(await this.getPaymentOrThrow(payment.id, tx));
    });
  }

  async verifyPayment(paymentId: string, dto: VerifyWmsStockRequestPaymentDto) {
    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.wmsStockRequestPayment.findUnique({
        where: { id: paymentId },
        include: {
          request: {
            select: {
              id: true,
            },
          },
          invoice: {
            select: {
              id: true,
              totalAmount: true,
            },
          },
        },
      });

      if (!payment) {
        throw new NotFoundException('Payment proof not found');
      }

      if (payment.status !== 'SUBMITTED') {
        throw new BadRequestException('Only submitted payment proofs can be verified');
      }

      const verifiedAt = new Date();

      await tx.wmsStockRequestPayment.update({
        where: { id: paymentId },
        data: {
          status: dto.approve ? 'VERIFIED' : 'REJECTED',
          remarks: this.normalizeText(dto.remarks),
          verifiedAt,
        },
      });

      if (dto.approve) {
        await tx.wmsStockRequest.update({
          where: { id: payment.request.id },
          data: {
            status: 'PAYMENT_VERIFIED',
            paymentVerifiedAt: verifiedAt,
          },
        });

        await tx.wmsStockRequestInvoice.update({
          where: { id: payment.invoice.id },
          data: {
            status: 'PAID',
            amountDue: new Prisma.Decimal(0),
          },
        });
      } else {
        await tx.wmsStockRequest.update({
          where: { id: payment.request.id },
          data: {
            status: 'INVOICED',
          },
        });

        await tx.wmsStockRequestInvoice.update({
          where: { id: payment.invoice.id },
          data: {
            status: 'UNPAID',
            amountDue: payment.invoice.totalAmount,
          },
        });
      }

      return this.mapPayment(await this.getPaymentOrThrow(paymentId, tx));
    });
  }
}
