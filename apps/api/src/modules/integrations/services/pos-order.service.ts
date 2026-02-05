import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import * as dayjs from 'dayjs';
import * as utc from 'dayjs/plugin/utc';
import * as timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

interface PosOrderData {
  shopId: string;
  posOrderId: string;
  insertedAt: Date;
  dateLocal: string;
  status?: number;
  statusName?: string;
  cod?: number;
  upsellSales?: number;
  mktgBaseline?: number;
  pUtmCampaign?: string;
  pUtmContent?: string;
  cogs: number;
  totalQuantity: number;
  tracking?: string;
  mapping?: string;
  itemData: any[];
  tags: { id: string; name: string }[];
  customerCare?: string;
  marketer?: string;
  salesAssignee?: string | null;
  statusHistory?: any[] | null;
  rtsReason?: { l1: string | null; l2: string | null; l3: string | null } | null;
  upsellBreakdown?: any | null;
  assigningCare?: string | null;
}

@Injectable()
export class PosOrderService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Extract mapping from note_product field
   * Example: "Agriblast-100" -> "Agriblast"
   */
  private extractMapping(noteProduct?: string): string | undefined {
    if (!noteProduct) return undefined;

    // Remove numeric suffix and trim
    const match = noteProduct.match(/^([A-Za-z\s]+)/);
    return match ? match[1].trim() : undefined;
  }

  private parseNoteProductCogs(noteProduct: any, quantity: number): number {
    if (!noteProduct || typeof noteProduct !== 'string') return 0;
    const parts = noteProduct.split('-');
    const numRaw = parts[1] ?? '';
    const num = parseFloat((numRaw || '').toString().replace(/[^0-9.\\-]/g, ''));
    if (isNaN(num)) return 0;
    const qtySafe = Math.max(quantity || 0, 1);
    return num * qtySafe;
  }

  /**
   * Derive mapping from productId values by matching pos_products.productId.
   * If multiple distinct mappings found, join with '-' in stable order.
   */
  private async deriveMappingFromItems(
    storeId: string,
    items: any[],
  ): Promise<string | undefined> {
    const productIds = Array.from(
      new Set(
        items
          .map((item: any) => item?.product_id?.toString?.() || item?.productId?.toString?.())
          .filter((v: string | undefined) => !!v),
      ),
    ) as string[];

    if (productIds.length === 0) return undefined;

    const products = await this.prisma.posProduct.findMany({
      where: {
        storeId,
        productId: { in: productIds },
      },
      select: { mapping: true },
    });

    const mappings = products
      .map((p) => (p.mapping || '').trim())
      .filter((m) => m.length > 0)
      .map((m) => m.toLowerCase());

    if (mappings.length === 0) return undefined;

    const unique = Array.from(new Set(mappings));
    if (unique.length === 1) return unique[0];

    unique.sort();
    return unique.join('-');
  }

  /**
   * Calculate COGS from note_product using PosProductCogs table
   * @param tenantId - Tenant ID
   * @param storeId - POS store ID
   * @param items - Order items array
   * @param dateLocal - Order date in YYYY-MM-DD format
   * @returns Total COGS and total quantity
   */
  private async calculateCogs(
    tenantId: string,
    storeId: string,
    items: any[],
    dateLocal: string,
  ): Promise<{ cogs: number; totalQuantity: number }> {
    let totalCogs = 0;
    let totalQuantity = 0;

    const orderDate = new Date(dateLocal);

    for (const item of items) {
      const quantity = parseInt(item.quantity || '0', 10);
      const noteCogs = this.parseNoteProductCogs(item?.note_product, quantity);
      // Accept multiple identifiers to find the product (pancake can send either product_id or product_display_id)
      const candidateIds = [
        item.product_id?.toString?.(),
        item.product_display_id?.toString?.(),
        item.variation_info?.product_display_id?.toString?.(),
      ].filter((v) => !!v) as string[];

      if (candidateIds.length === 0 || quantity === 0) {
        if (noteCogs > 0) {
          totalCogs += noteCogs;
        }
        continue;
      }

      // Find product in database (match productId or customId to any of the known identifiers)
      const product = await this.prisma.posProduct.findFirst({
        where: {
          storeId,
          OR: [
            { productId: { in: candidateIds } },
            { customId: { in: candidateIds } },
          ],
        },
      });

      if (!product) {
        if (noteCogs > 0) {
          totalCogs += noteCogs;
        }
        continue;
      }

      // Get COGS for the order date
      const cogsEntry = await this.prisma.posProductCogs.findFirst({
        where: {
          tenantId,
          productId: product.id,
          storeId,
          startDate: { lte: orderDate },
          OR: [{ endDate: { gte: orderDate } }, { endDate: null }],
        },
      });

      if (cogsEntry) {
        const itemCogs = parseFloat(cogsEntry.cogs.toString()) * quantity;
        totalCogs += itemCogs;
      } else if (noteCogs > 0) {
        totalCogs += noteCogs;
      }

      totalQuantity += quantity;
    }

    return { cogs: totalCogs, totalQuantity };
  }

  /**
   * Parse Pancake POS order data into our schema
   */
  private async parsePosOrder(
    tenantId: string,
    storeId: string,
    rawOrder: any,
  ): Promise<PosOrderData> {
    // Skip abandoned Shopify checkouts: status 0 with abandon checkout id
    if (
      (rawOrder?.status === 0 || rawOrder?.status === '0') &&
      rawOrder?.shopify_abandon_checkout_id
    ) {
      throw new Error('skip_abandoned_checkout');
    }

    // Treat inserted_at as UTC and derive Manila-local date
    const insertedAtUtc = dayjs.utc(rawOrder.inserted_at);
    const insertedAt = insertedAtUtc.toDate();
    const dateLocal = insertedAtUtc.tz('Asia/Manila').format('YYYY-MM-DD');

    // Extract item info
    const items = rawOrder.items || [];
    const firstItem = items[0];

    // Calculate COGS from note_product
    let { cogs, totalQuantity } = await this.calculateCogs(
      tenantId,
      storeId,
      items,
      dateLocal,
    );

    // Extract mapping from productId -> pos_products.mapping first
    const noteProduct = firstItem?.note_product;
    let mapping = await this.deriveMappingFromItems(storeId, items);

    // Fallback to note_product parsing if no mapping from products
    if (!mapping) {
      mapping = this.extractMapping(noteProduct);
    }

    // Build item data snapshot
    const itemData = items.map((item: any) => {
      const variation = item.variation_info || {};
      return {
        quantity: item.quantity ?? null,
        productId: item.product_id ?? null,
        variationName: variation.name ?? null,
        productDisplayId: variation.product_display_id ?? null,
      };
    });

    const customerCare =
      rawOrder.assigning_care && typeof rawOrder.assigning_care === 'object'
        ? rawOrder.assigning_care.name || undefined
        : undefined;

    const marketer =
      rawOrder.marketer && typeof rawOrder.marketer === 'object'
        ? rawOrder.marketer.name || undefined
        : undefined;

    // Normalize assigning care (id or name)
    const assigningCareRaw = rawOrder.assigning_care ?? null;
    let assigningCare: string | null = null;
    if (assigningCareRaw) {
      if (typeof assigningCareRaw === 'object') {
        assigningCare = assigningCareRaw.id?.toString?.() || assigningCareRaw.name || null;
      } else if (typeof assigningCareRaw === 'string') {
        assigningCare = assigningCareRaw.trim() || null;
      }
    }

    // Tags: allow array or JSON string
    let parsedTags: any = rawOrder.tags ?? null;
    if (typeof parsedTags === 'string') {
      try {
        const decoded = JSON.parse(parsedTags);
        if (Array.isArray(decoded)) parsedTags = decoded;
      } catch {
        // keep as-is
      }
    }
    const tags = Array.isArray(parsedTags)
      ? parsedTags
          .filter((t) => t && (typeof t === 'string' || typeof t === 'object'))
          .map((t: any) =>
            typeof t === 'string'
              ? { id: '', name: t }
              : { id: t.id?.toString?.() || '', name: t.name || '' }
          )
      : [];

    // RTS reason: split returned_reason_name by "/"
    let rtsReason: { l1: string | null; l2: string | null; l3: string | null } | null = null;
    if (typeof rawOrder.returned_reason_name === 'string' && rawOrder.returned_reason_name.trim() !== '') {
      const parts = rawOrder.returned_reason_name.split('/').map((p: string) => p.trim());
      const l1 = parts[0] || null;
      const l2 = parts[1] || null;
      const l3 = parts.length > 2 ? parts.slice(2).join('/') || null : null;
      if (l1 || l2 || l3) {
        rtsReason = { l1, l2, l3 };
      }
    }

    const statusHistory = Array.isArray(rawOrder.status_history) ? rawOrder.status_history : null;

    // Sales assignee: prefer assigning_seller.fb_id, fallback to latest status_history with status==1
    let salesAssignee: string | null = null;
    const assigningSellerRaw = rawOrder.assigning_seller ?? null;
    if (assigningSellerRaw && typeof assigningSellerRaw === 'object') {
      const fbId = assigningSellerRaw.fb_id ?? assigningSellerRaw.fbId ?? null;
      if (fbId) {
        salesAssignee = fbId.toString();
      }
    } else if (typeof assigningSellerRaw === 'string') {
      const trimmed = assigningSellerRaw.trim();
      if (trimmed) salesAssignee = trimmed;
    }

    if (!salesAssignee && Array.isArray(statusHistory)) {
      let latestEntry: any = null;
      let latestTs = -Infinity;
      let latestIdx = -1;
      statusHistory.forEach((entry: any, idx: number) => {
        if (!entry || entry.status !== 1) return;
        const updatedRaw = entry.updated_at ?? null;
        const ts = typeof updatedRaw === 'string' ? Date.parse(updatedRaw) : NaN;
        if (!isNaN(ts)) {
          if (ts > latestTs) {
            latestTs = ts;
            latestEntry = entry;
          }
          return;
        }
        if (latestTs === -Infinity && idx > latestIdx) {
          latestIdx = idx;
          latestEntry = entry;
        }
      });

      if (latestEntry) {
        const fbId =
          latestEntry.editor_fb ??
          latestEntry.editor?.fb_id ??
          latestEntry.editor?.fbId ??
          null;
        if (fbId) {
          salesAssignee = fbId.toString();
        }
      }
    }

    // Upsell breakdown from histories (if any) looking for UPSELL tag
    const upsellBreakdown = this.computeUpsellBreakdown(rawOrder);

    const codValue = parseFloat(rawOrder.cod || '0');
    let upsellSales = 0;
    if (upsellBreakdown && typeof upsellBreakdown === 'object') {
      const newAmount = parseFloat(upsellBreakdown.new_amount ?? '0');
      const originalAmount = parseFloat(upsellBreakdown.original_amount ?? '0');
      if (Number.isFinite(newAmount) && Number.isFinite(originalAmount)) {
        upsellSales = newAmount - originalAmount;
      }
    }
    const mktgBaseline = (Number.isFinite(codValue) ? codValue : 0) - upsellSales;

    // Fallback mapping: if still empty, derive from note_product first segment
    if (!mapping && typeof noteProduct === 'string' && noteProduct.trim() !== '') {
      const parts = noteProduct.split('-');
      const first = parts[0]?.trim();
      if (first) {
        mapping = first;
      }
    }

    // Normalize mapping to lowercase for consistent matching
    if (mapping) {
      mapping = mapping.trim().toLowerCase();
    }

    // Fallback COGS: if DB cogs 0, sum per-item note_product numeric part * qty
    let cogsFallback = 0;
    if (cogs === 0) {
      for (const item of items) {
        const np = item?.note_product;
        if (!np || typeof np !== 'string') continue;
        const parts = np.split('-');
        const numRaw = parts[1] ?? '';
        const num = parseFloat((numRaw || '').toString().replace(/[^0-9.\\-]/g, ''));
        if (isNaN(num)) continue;
        const unit = num;
        const qty = parseInt(item.quantity || '0', 10);
        const qtySafe = Math.max(qty || 0, 1);
        cogsFallback += unit * qtySafe;
      }
      if (cogsFallback > 0) {
        cogs = cogsFallback;
      }
    }

    const partnerExtend = (rawOrder.partner && typeof rawOrder.partner === 'object')
      ? rawOrder.partner.extend_code || rawOrder.partner.extendCode || null
      : null;

    return {
      shopId: rawOrder.shop_id?.toString(),
      posOrderId: rawOrder.id?.toString(),
      insertedAt,
      dateLocal,
      status: rawOrder.status,
      statusName: rawOrder.status_name,
      cod: codValue,
      upsellSales,
      mktgBaseline,
      pUtmCampaign: rawOrder.p_utm_campaign,
      pUtmContent: rawOrder.p_utm_content,
      cogs,
      totalQuantity,
      // Use partner extend_code as tracking marker; do not fall back to item tracking
      tracking: partnerExtend,
      mapping,
      itemData,
      tags,
      customerCare,
      marketer,
      salesAssignee,
      statusHistory,
      rtsReason,
      upsellBreakdown,
      assigningCare,
    };
  }

  /**
   * Upsert POS orders to database
   * Uses upsert pattern to handle re-running workflows for same dates
   */
  async upsertPosOrders(
    tenantId: string,
    storeId: string,
    rawOrders: any[],
    teamId: string | null,
  ): Promise<number> {
    let upserted = 0;

    for (const rawOrder of rawOrders) {
      const sourceName = rawOrder?.order_sources_name?.toString?.().trim?.() || '';
      if (sourceName.toLowerCase() === 'tiktok') {
        continue;
      }

      const items = Array.isArray(rawOrder.items) ? rawOrder.items : [];
      const hasProduct = items.some((item: any) => !!item?.product_id);
      if (items.length === 0 || !hasProduct) {
        continue;
      }

      const order = await this.parsePosOrder(tenantId, storeId, rawOrder);

      await this.prisma.posOrder.upsert({
        where: {
          tenantId_shopId_posOrderId: {
            tenantId,
            shopId: order.shopId,
            posOrderId: order.posOrderId,
          },
        },
        create: {
          tenantId,
          teamId,
          shopId: order.shopId,
          posOrderId: order.posOrderId,
          insertedAt: order.insertedAt,
          dateLocal: order.dateLocal,
          status: order.status,
          statusName: order.statusName,
          cod: order.cod ? new Decimal(order.cod) : null,
          upsellSales: new Decimal(order.upsellSales || 0),
          mktgBaseline: new Decimal(order.mktgBaseline || 0),
          pUtmCampaign: order.pUtmCampaign,
          pUtmContent: order.pUtmContent,
          cogs: new Decimal(order.cogs),
          totalQuantity: order.totalQuantity,
          tracking: order.tracking,
          mapping: order.mapping,
          itemData: order.itemData,
          tags: this.jsonOrDbNull(order.tags),
          customerCare: order.customerCare,
          marketer: order.marketer,
          salesAssignee: order.salesAssignee,
          statusHistory: this.jsonOrDbNull(order.statusHistory),
          rtsReason: this.jsonOrDbNull(order.rtsReason),
          upsellBreakdown: this.jsonOrDbNull(order.upsellBreakdown),
          assigningCare: order.assigningCare,
        },
        update: {
          teamId,
          insertedAt: order.insertedAt,
          status: order.status,
          statusName: order.statusName,
          cod: order.cod ? new Decimal(order.cod) : null,
          upsellSales: new Decimal(order.upsellSales || 0),
          mktgBaseline: new Decimal(order.mktgBaseline || 0),
          pUtmCampaign: order.pUtmCampaign,
          pUtmContent: order.pUtmContent,
          cogs: new Decimal(order.cogs),
          totalQuantity: order.totalQuantity,
          tracking: order.tracking,
          mapping: order.mapping,
          itemData: order.itemData,
          tags: this.jsonOrDbNull(order.tags),
          customerCare: order.customerCare,
          marketer: order.marketer,
          salesAssignee: order.salesAssignee,
          statusHistory: this.jsonOrDbNull(order.statusHistory),
          rtsReason: this.jsonOrDbNull(order.rtsReason),
          upsellBreakdown: this.jsonOrDbNull(order.upsellBreakdown),
          assigningCare: order.assigningCare,
        },
      });

      upserted++;
    }

    return upserted;
  }

  /**
   * Get orders for a specific date range
   */
  async getOrders(
    tenantId: string,
    shopId?: string,
    dateFrom?: string,
    dateTo?: string,
  ): Promise<any[]> {
    const where: any = { tenantId };

    if (shopId) {
      where.shopId = shopId;
    }

    if (dateFrom || dateTo) {
      where.dateLocal = {};
      if (dateFrom) where.dateLocal.gte = dateFrom;
      if (dateTo) where.dateLocal.lte = dateTo;
    }

    return this.prisma.posOrder.findMany({
      where,
      orderBy: [{ dateLocal: 'desc' }, { insertedAt: 'desc' }],
    });
  }

  private jsonOrDbNull(value: any): typeof Prisma.JsonNull | Prisma.InputJsonValue | undefined {
    if (value === undefined) return undefined;
    if (value === null) return Prisma.JsonNull;
    return value as Prisma.InputJsonValue;
  }

  // -----------------------------
  // Upsell helpers
  // -----------------------------
  private hasUpsellTagInList(tagsRaw: any): boolean {
    if (isString(tagsRaw)) {
      try {
        const decoded = JSON.parse(tagsRaw);
        tagsRaw = decoded;
      } catch {
        // ignore parse error
      }
    }
    if (!Array.isArray(tagsRaw)) return false;
    for (const tag of tagsRaw) {
      let id: any = null;
      let name: any = null;
      if (isObject(tag)) {
        id = tag.id ?? null;
        name = tag.name ?? null;
      } else if (isString(tag)) {
        name = tag;
      }
      if (id !== null && parseInt(id, 10) === 103) return true;
      if (typeof name === 'string' && name.trim().toUpperCase() === 'UPSELL') return true;
    }
    return false;
  }

  private computeUpsellItemsTotals(itemsRaw: any): { old: number; new: number } {
    if (!Array.isArray(itemsRaw)) return { old: 0, new: 0 };
    let oldTotal = 0;
    let newTotal = 0;
    for (const item of itemsRaw) {
      if (!isObject(item)) continue;
      const oldItem = item.old ?? null;
      const newItem = item.new ?? null;
      if (isObject(oldItem)) oldTotal += this.computeUpsellItemAmount(oldItem);
      if (isObject(newItem)) newTotal += this.computeUpsellItemAmount(newItem);
    }
    return { old: oldTotal, new: newTotal };
  }

  private computeUpsellItemAmount(item: any): number {
    const qty = parseInt(item.quantity ?? '0', 10);
    const price = item.variation_info?.retail_price ?? item.retail_price ?? 0;
    const q = isNaN(qty) ? 0 : Math.max(qty, 0);
    const p = isNaN(parseFloat(price)) ? 0 : parseFloat(price);
    return q * p;
  }

  private extractHistoryAmount(entry: any, key: string): { old: number; new: number } {
    let old = 0;
    let newVal = 0;
    if (!isObject(entry) || !entry.hasOwnProperty(key)) return { old, new: newVal };
    const value = entry[key];
    if (isObject(value)) {
      if (isNumeric(value.old)) old = parseFloat(value.old);
      if (isNumeric(value.new)) newVal = parseFloat(value.new);
    } else if (isNumeric(value)) {
      newVal = parseFloat(value);
    }
    return { old, new: newVal };
  }

  private extractHistoryDiscount(entry: any): { old: number; new: number } {
    for (const key of ['total_discount', 'general_discount', 'discount']) {
      if (!entry || !entry.hasOwnProperty(key)) continue;
      const value = entry[key];
      if (isObject(value)) {
        const old = isNumeric(value.old) ? parseFloat(value.old) : 0;
        const neu = isNumeric(value.new) ? parseFloat(value.new) : 0;
        return { old, new: neu };
      }
      if (isNumeric(value)) {
        return { old: 0, new: parseFloat(value) };
      }
    }
    return { old: 0, new: 0 };
  }

  private computeUpsellBreakdown(order: any): any | null {
    const tags = order?.tags ?? null;
    if (!this.hasUpsellTagInList(tags)) {
      return null;
    }

    let histories: any = order?.histories ?? null;
    if (isString(histories)) {
      try {
        const decoded = JSON.parse(histories);
        histories = decoded;
      } catch {
        histories = null;
      }
    }
    if (!Array.isArray(histories) || histories.length === 0) {
      return null;
    }

    const entriesWithItems = histories.filter(
      (entry: any) => isObject(entry) && Array.isArray(entry.items) && entry.items.length > 0,
    );
    if (entriesWithItems.length === 0) {
      return null;
    }

    // Group entries by updated_at for discount pairing
    const byUpdatedAt: Record<string, any[]> = {};
    for (const entry of histories) {
      if (!isObject(entry)) continue;
      const updatedRaw = entry.updated_at ?? null;
      if (isString(updatedRaw) && updatedRaw !== '') {
        byUpdatedAt[updatedRaw] = byUpdatedAt[updatedRaw] || [];
        byUpdatedAt[updatedRaw].push(entry);
      }
    }

    let best: any = null;
    let bestRank: number | null = null;

    entriesWithItems.forEach((entry: any, idx: number) => {
      if (!isObject(entry)) return;

      const itemTotals = this.computeUpsellItemsTotals(entry.items ?? null);
      if (itemTotals.new <= 0) return;

      let discount = this.extractHistoryDiscount(entry);
      if (discount.old <= 0 && discount.new <= 0) {
        const updatedRaw = entry.updated_at ?? null;
        if (isString(updatedRaw) && byUpdatedAt[updatedRaw]) {
          for (const peer of byUpdatedAt[updatedRaw]) {
            const candidate = this.extractHistoryDiscount(peer);
            if (candidate.old > 0 || candidate.new > 0) {
              discount = candidate;
              break;
            }
          }
        }
      }

      const shipping = this.extractHistoryAmount(entry, 'shipping_fee');

      const isReplacement = itemTotals.old > 0 && itemTotals.new > 0;
      let itemTotalOld = itemTotals.old;
      let itemTotalNew = itemTotals.new;

      let originalAmount = 0;
      let newAmount = 0;

      if (!isReplacement) {
        const orderCod = parseFloat(order?.cod || '0');
        const hasShippingField = isObject(entry) && Object.prototype.hasOwnProperty.call(entry, 'shipping_fee');
        const hasDiscountField = isObject(entry) && ['total_discount', 'general_discount', 'discount']
          .some((key) => Object.prototype.hasOwnProperty.call(entry, key));
        const hasDiscountValue = discount.old !== 0 || discount.new !== 0;
        const useAdjustments = hasShippingField || hasDiscountField || hasDiscountValue;

        if (useAdjustments) {
          itemTotalOld = orderCod - itemTotalNew - shipping.new + discount.new;
        } else {
          itemTotalOld = orderCod - itemTotalNew;
        }
        originalAmount = itemTotalOld + shipping.old - discount.old;
        newAmount = itemTotalOld + itemTotalNew + shipping.new - discount.new;
      } else {
        originalAmount = itemTotalOld + shipping.old - discount.old;
        newAmount = itemTotalNew + shipping.new - discount.new;
      }

      const updatedRaw = entry.updated_at ?? null;
      let rank = idx;
      if (isString(updatedRaw)) {
        const ts = Date.parse(updatedRaw);
        if (!isNaN(ts)) rank = ts;
      }

      if (bestRank === null || rank > bestRank) {
        bestRank = rank;
        best = {
          flag: true,
          original_amount: originalAmount,
          new_amount: newAmount,
          item_total_old: itemTotalOld,
          item_total_new: itemTotalNew,
          shipping_old: shipping.old,
          shipping_new: shipping.new,
          discount_old: discount.old,
          discount_new: discount.new,
          updated_at: updatedRaw,
        };
      }
    });

    return best;
  }
}

function isString(val: any): val is string {
  return typeof val === 'string';
}

function isObject(val: any): val is Record<string, any> {
  return val !== null && typeof val === 'object' && !Array.isArray(val);
}

function isNumeric(val: any): boolean {
  return val !== null && val !== undefined && !isNaN(Number(val));
}
