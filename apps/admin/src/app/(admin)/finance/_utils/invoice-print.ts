import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type PDFImage } from 'pdf-lib';
import type { WmsInvoiceDocumentResponse } from '../_types/purchasing';
import { formatInvoiceStatusLabel, formatShortDate } from './purchasing-presenters';

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const PAGE_MARGIN_X = 34;
const PAGE_MARGIN_TOP = 30;
const PAGE_MARGIN_BOTTOM = 30;
const HEADER_DETAILS_GAP = 18;
const TABLE_HEADER_COLOR = rgb(58 / 255, 66 / 255, 77 / 255);
const TOTAL_STRIP_COLOR = rgb(236 / 255, 239 / 255, 242 / 255);
const AMOUNT_DUE_COLOR = rgb(227 / 255, 231 / 255, 236 / 255);
const STATUS_RED = rgb(1, 59 / 255, 48 / 255);
const STATUS_GREEN = rgb(23 / 255, 114 / 255, 69 / 255);

type PageContext = {
  page: PDFPage;
  top: number;
};

export async function printInvoiceDocument(payload: WmsInvoiceDocumentResponse) {
  if (typeof window === 'undefined') {
    return;
  }

  const bytes = await buildInvoicePdf(payload);
  openPdfDocument(bytes, `${payload.invoice.invoiceNumber}.pdf`);
}

async function buildInvoicePdf(payload: WmsInvoiceDocumentResponse) {
  const { invoice, document } = payload;
  const issuer = (document.issuer ?? {}) as Record<string, unknown>;
  const billTo = (document.billTo ?? {}) as Record<string, unknown>;
  const issuerName = readString(issuer, 'companyName') ?? document.tenant.name;
  const billToName = readString(billTo, 'companyName') ?? readString(billTo, 'tenantName') ?? 'Not set';
  const pdfDoc = await PDFDocument.create();
  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const logo = await resolvePdfLogo(pdfDoc, readString(issuer, 'logoUrl'));
  let context = addPage(pdfDoc);

  context.top = drawHeader({
    context,
    invoiceNumber: invoice.invoiceNumber,
    invoiceStatus: formatInvoiceStatusLabel(invoice.status),
    logo,
    boldFont,
  });

  context.top = drawDetails({
    context,
    issuerName,
    issuerAddress: readString(issuer, 'companyAddress'),
    billToName,
    billToAddress: readString(billTo, 'billingAddress'),
    issueDate: formatShortDate(invoice.issueDate),
    dueDate: formatShortDate(invoice.dueDate),
    regularFont,
    boldFont,
  });

  const tableTop = context.top;
  const tableWidth = PAGE_WIDTH - 88;
  const tableColumns = {
    index: 38,
    item: 273,
    qty: 56,
    rate: 70,
    amount: 70,
  };
  const rowHeight = 27;
  const tailReserve = 170;
  const centeredTableLeft = (PAGE_WIDTH - tableWidth) / 2;

  drawTableHeader(context.page, tableTop, centeredTableLeft, tableColumns, regularFont, boldFont);
  let rowsTop = tableTop + 34;

  for (let index = 0; index < invoice.lines.length; index += 1) {
    if (rowsTop + rowHeight + tailReserve > PAGE_HEIGHT - PAGE_MARGIN_BOTTOM) {
      context = addPage(pdfDoc);
      drawTableHeader(context.page, context.top, centeredTableLeft, tableColumns, regularFont, boldFont);
      rowsTop = context.top + 34;
    }

    drawInvoiceRow({
      page: context.page,
      top: rowsTop,
      left: centeredTableLeft,
      lineNo: invoice.lines[index].lineNo,
      itemName: invoice.lines[index].description,
      storeName: invoice.lines[index].store?.name ?? null,
      quantity: invoice.lines[index].quantity.toLocaleString(),
      rate: formatPdfAmount(invoice.lines[index].unitRate),
      amount: formatPdfAmount(invoice.lines[index].amount),
      regularFont,
      boldFont,
      columns: tableColumns,
    });
    rowsTop += rowHeight;
  }

  const totalsTop = rowsTop + 28;
  drawTotals({
    page: context.page,
    top: totalsTop,
    subtotal: formatPdfCurrency(invoice.totals.subtotal ?? invoice.totalAmount),
    total: formatPdfCurrency(invoice.totals.totalAmount ?? invoice.totalAmount),
    amountDue: formatPdfCurrency(invoice.totals.amountDue ?? invoice.amountDue),
    regularFont,
    boldFont,
  });

  const paymentRows = [
    readString(document.payment as Record<string, unknown>, 'bankName')
      ? `Bank: ${readString(document.payment as Record<string, unknown>, 'bankName')}`
      : null,
    readString(document.payment as Record<string, unknown>, 'bankAccountName')
      ? `Account Name: ${readString(document.payment as Record<string, unknown>, 'bankAccountName')}`
      : null,
    readString(document.payment as Record<string, unknown>, 'bankAccountNumber')
      ? `Account Number: ${readString(document.payment as Record<string, unknown>, 'bankAccountNumber')}`
      : null,
    readString(document.payment as Record<string, unknown>, 'bankAccountType')
      ? `Account Type: ${readString(document.payment as Record<string, unknown>, 'bankAccountType')}`
      : null,
    readString(document.payment as Record<string, unknown>, 'bankBranch')
      ? `Branch: ${readString(document.payment as Record<string, unknown>, 'bankBranch')}`
      : null,
  ].filter((value): value is string => Boolean(value));

  const paymentTop = totalsTop + 116;
  drawPaymentBlock({
    page: context.page,
    top: paymentTop,
    rows: paymentRows,
    paymentInstructions: document.payment.paymentInstructions ?? null,
    footerNotes: document.payment.footerNotes ?? null,
    invoiceNotes: invoice.notes,
    regularFont,
    boldFont,
  });

  return pdfDoc.save();
}

function addPage(pdfDoc: PDFDocument): PageContext {
  return {
    page: pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]),
    top: PAGE_MARGIN_TOP,
  };
}

function drawHeader(params: {
  context: PageContext;
  invoiceNumber: string;
  invoiceStatus: string;
  logo: { image: PDFImage; width: number; height: number } | null;
  boldFont: PDFFont;
}) {
  const { context, invoiceNumber, invoiceStatus, logo, boldFont } = params;
  const headerTop = context.top;
  const logoMaxWidth = 120;
  const logoMaxHeight = 80;
  let logoRenderedHeight = 0;

  if (logo) {
    const scale = Math.min(logoMaxWidth / logo.width, logoMaxHeight / logo.height);
    const renderedWidth = logo.width * scale;
    const renderedHeight = logo.height * scale;
    logoRenderedHeight = renderedHeight;
    drawImageFromTop(context.page, logo.image, PAGE_MARGIN_X, headerTop, {
      width: renderedWidth,
      height: renderedHeight,
    });
  }

  drawRightAlignedText(context.page, 'Billing Statement', {
    right: PAGE_WIDTH - PAGE_MARGIN_X,
    top: headerTop,
    size: 28,
    font: boldFont,
    color: rgb(0, 0, 0),
  });
  drawRightAlignedText(context.page, `# ${invoiceNumber}`, {
    right: PAGE_WIDTH - PAGE_MARGIN_X,
    top: headerTop + 34,
    size: 16,
    font: boldFont,
    color: rgb(78 / 255, 78 / 255, 78 / 255),
  });
  drawRightAlignedText(context.page, invoiceStatus.toUpperCase(), {
    right: PAGE_WIDTH - PAGE_MARGIN_X,
    top: headerTop + 56,
    size: 12,
    font: boldFont,
    color: invoiceStatus.toUpperCase() === 'PAID VERIFIED' ? STATUS_GREEN : STATUS_RED,
  });

  return headerTop + Math.max(Math.min(logoRenderedHeight, 118), 72) + HEADER_DETAILS_GAP;
}

function drawDetails(params: {
  context: PageContext;
  issuerName: string;
  issuerAddress: string | null;
  billToName: string;
  billToAddress: string | null;
  issueDate: string;
  dueDate: string;
  regularFont: PDFFont;
  boldFont: PDFFont;
}) {
  const {
    context,
    issuerName,
    issuerAddress,
    billToName,
    billToAddress,
    issueDate,
    dueDate,
    regularFont,
    boldFont,
  } = params;

  const leftX = PAGE_MARGIN_X + 10;
  const rightColumnWidth = 270;
  const rightEdge = PAGE_WIDTH - PAGE_MARGIN_X;
  const leftTop = context.top;
  const nameTop = leftTop;
  const rightLabelTop = leftTop - 2;
  const rightNameTop = leftTop + 16;

  drawTextFromTop(context.page, issuerName, {
    x: leftX,
    top: nameTop,
    size: 13,
    font: boldFont,
  });

  drawRightAlignedText(context.page, 'Bill To:', {
    right: rightEdge,
    top: rightLabelTop,
    size: 11,
    font: boldFont,
  });
  drawRightAlignedText(context.page, billToName, {
    right: rightEdge,
    top: rightNameTop,
    size: 13,
    font: boldFont,
  });

  let leftCursor = nameTop + 24;
  for (const line of splitMultiline(issuerAddress)) {
    drawTextFromTop(context.page, line, {
      x: leftX,
      top: leftCursor,
      size: 11,
      font: regularFont,
    });
    leftCursor += 18;
  }

  let rightCursor = rightNameTop + 24;
  for (const line of wrapLines(splitMultiline(billToAddress).join(', '), rightColumnWidth, regularFont, 11)) {
    drawRightAlignedText(context.page, line, {
      right: rightEdge,
      top: rightCursor,
      size: 11,
      font: regularFont,
    });
    rightCursor += 18;
  }

  const dateBlockTop = Math.max(leftCursor, rightCursor) + 4;

  drawRightAlignedText(context.page, `Invoice Date: ${issueDate}`, {
    right: rightEdge,
    top: dateBlockTop,
    size: 11,
    font: regularFont,
  });
  drawRightAlignedText(context.page, `Due Date: ${dueDate}`, {
    right: rightEdge,
    top: dateBlockTop + 22,
    size: 11,
    font: regularFont,
  });

  return dateBlockTop + 44;
}

function drawTableHeader(
  page: PDFPage,
  top: number,
  left: number,
  columns: { index: number; item: number; qty: number; rate: number; amount: number },
  regularFont: PDFFont,
  boldFont: PDFFont,
) {
  const headerHeight = 26;
  page.drawRectangle({
    x: left,
    y: toPdfY(top + headerHeight),
    width: columns.index + columns.item + columns.qty + columns.rate + columns.amount,
    height: headerHeight,
    color: TABLE_HEADER_COLOR,
  });

  let x = left;
  drawCenteredText(page, '#', {
    x,
    width: columns.index,
    top: top + 8,
    size: 10.5,
    font: boldFont,
    color: rgb(1, 1, 1),
  });
  x += columns.index;
  drawTextFromTop(page, 'Item', {
    x: x + 12,
    top: top + 8,
    size: 10.5,
    font: boldFont,
    color: rgb(1, 1, 1),
  });
  x += columns.item;
  drawCenteredText(page, 'Qty', {
    x,
    width: columns.qty,
    top: top + 8,
    size: 10.5,
    font: boldFont,
    color: rgb(1, 1, 1),
  });
  x += columns.qty;
  drawCenteredText(page, 'Rate', {
    x,
    width: columns.rate,
    top: top + 8,
    size: 10.5,
    font: boldFont,
    color: rgb(1, 1, 1),
  });
  x += columns.rate;
  drawCenteredText(page, 'Amount', {
    x,
    width: columns.amount,
    top: top + 8,
    size: 10.5,
    font: boldFont,
    color: rgb(1, 1, 1),
  });
}

function drawInvoiceRow(params: {
  page: PDFPage;
  top: number;
  left: number;
  lineNo: number;
  itemName: string;
  storeName: string | null;
  quantity: string;
  rate: string;
  amount: string;
  regularFont: PDFFont;
  boldFont: PDFFont;
  columns: { index: number; item: number; qty: number; rate: number; amount: number };
}) {
  const { page, top, left, lineNo, itemName, storeName, quantity, rate, amount, regularFont, boldFont, columns } = params;
  drawCenteredText(page, `${lineNo}`, {
    x: left,
    width: columns.index,
    top: top + 7,
    size: 10.5,
    font: regularFont,
  });

  const itemX = left + columns.index + 10;
  const itemWidth = columns.item - 16;
  const fittedItemName = fitText(itemName, itemWidth, boldFont, 10.5);
  const itemNameWidth = boldFont.widthOfTextAtSize(fittedItemName, 10.5);
  drawTextFromTop(page, fittedItemName, {
    x: itemX,
    top: top + 7,
    size: 10.5,
    font: boldFont,
  });

  if (storeName) {
    const separator = ' - ';
    const remainingWidth = Math.max(itemWidth - itemNameWidth, 0);
    const fittedStore = fitText(`${separator}${storeName}`, remainingWidth, regularFont, 10.5);
    if (fittedStore.trim().length) {
      drawTextFromTop(page, fittedStore, {
        x: itemX + itemNameWidth,
        top: top + 7,
        size: 10.5,
        font: regularFont,
      });
    }
  }

  const qtyRight = left + columns.index + columns.item + columns.qty - 10;
  drawRightAlignedText(page, quantity, {
    right: qtyRight,
    top: top + 7,
    size: 10.5,
    font: regularFont,
  });

  const rateRight = qtyRight + columns.rate;
  drawRightAlignedText(page, rate, {
    right: rateRight,
    top: top + 7,
    size: 10.5,
    font: regularFont,
  });

  const amountRight = rateRight + columns.amount;
  drawRightAlignedText(page, amount, {
    right: amountRight,
    top: top + 7,
    size: 10.5,
    font: regularFont,
  });
}

function drawTotals(params: {
  page: PDFPage;
  top: number;
  subtotal: string;
  total: string;
  amountDue: string;
  regularFont: PDFFont;
  boldFont: PDFFont;
}) {
  const { page, top, subtotal, total, amountDue, boldFont } = params;
  const totalWidth = 310;
  const labelWidth = 154;
  const valueWidth = 136;
  const x = PAGE_WIDTH - PAGE_MARGIN_X - totalWidth;
  const rowHeight = 22;
  const rows = [
    { label: 'Sub Total', value: subtotal, color: null },
    { label: 'Total', value: total, color: TOTAL_STRIP_COLOR },
    { label: 'Amount Due', value: amountDue, color: AMOUNT_DUE_COLOR },
  ];

  rows.forEach((row, index) => {
    const rowTop = top + (index * rowHeight);
    if (row.color) {
      page.drawRectangle({
        x,
        y: toPdfY(rowTop + rowHeight),
        width: totalWidth,
        height: rowHeight,
        color: row.color,
      });
    }
    drawRightAlignedText(page, row.label, {
      right: x + labelWidth,
      top: rowTop + 5,
      size: 10.5,
      font: boldFont,
    });
    drawRightAlignedText(page, row.value, {
      right: x + labelWidth + valueWidth,
      top: rowTop + 5,
      size: 10.5,
      font: boldFont,
    });
  });
}

function drawPaymentBlock(params: {
  page: PDFPage;
  top: number;
  rows: string[];
  paymentInstructions: string | null;
  footerNotes: string | null;
  invoiceNotes: string | null;
  regularFont: PDFFont;
  boldFont: PDFFont;
}) {
  const { page, top, rows, paymentInstructions, footerNotes, invoiceNotes, regularFont, boldFont } = params;
  const x = PAGE_MARGIN_X + 10;
  let cursorTop = top;
  drawTextFromTop(page, 'Offline Payment:', {
    x,
    top: cursorTop,
    size: 11,
    font: boldFont,
  });
  cursorTop += 22;

  const extraRows = [
    ...rows,
    ...splitMultiline(paymentInstructions),
    ...splitMultiline(invoiceNotes),
    ...splitMultiline(footerNotes),
  ];

  for (const row of extraRows) {
    drawTextFromTop(page, row, {
      x,
      top: cursorTop,
      size: 10.5,
      font: regularFont,
    });
    cursorTop += 16;
  }
}

function fitText(text: string, maxWidth: number, font: PDFFont, size: number) {
  if (maxWidth <= 0) {
    return '';
  }
  const normalizedText = normalizePdfText(text);
  if (font.widthOfTextAtSize(normalizedText, size) <= maxWidth) {
    return normalizedText;
  }

  const ellipsis = '...';
  let output = normalizedText;
  while (output.length > 1 && font.widthOfTextAtSize(`${output}${ellipsis}`, size) > maxWidth) {
    output = output.slice(0, -1);
  }

  return `${output.trimEnd()}${ellipsis}`;
}

function wrapLines(text: string, maxWidth: number, font: PDFFont, size: number) {
  const normalizedText = normalizePdfText(text);
  if (!normalizedText.trim()) {
    return [];
  }

  const words = normalizedText.split(/\s+/);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
      continue;
    }

    if (current) {
      lines.push(current);
    }
    current = word;
  }

  if (current) {
    lines.push(current);
  }

  return lines;
}

function splitMultiline(value: string | null | undefined) {
  return (value ?? '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function drawTextFromTop(
  page: PDFPage,
  text: string,
  options: {
    x: number;
    top: number;
    size: number;
    font: PDFFont;
    color?: ReturnType<typeof rgb>;
  },
) {
  page.drawText(normalizePdfText(text), {
    x: options.x,
    y: toPdfY(options.top + options.size),
    size: options.size,
    font: options.font,
    color: options.color ?? rgb(0, 0, 0),
  });
}

function drawRightAlignedText(
  page: PDFPage,
  text: string,
  options: {
    right: number;
    top: number;
    size: number;
    font: PDFFont;
    color?: ReturnType<typeof rgb>;
  },
) {
  const normalizedText = normalizePdfText(text);
  const width = options.font.widthOfTextAtSize(normalizedText, options.size);
  drawTextFromTop(page, normalizedText, {
    x: options.right - width,
    top: options.top,
    size: options.size,
    font: options.font,
    color: options.color,
  });
}

function drawCenteredText(
  page: PDFPage,
  text: string,
  options: {
    x: number;
    width: number;
    top: number;
    size: number;
    font: PDFFont;
    color?: ReturnType<typeof rgb>;
  },
) {
  const normalizedText = normalizePdfText(text);
  const textWidth = options.font.widthOfTextAtSize(normalizedText, options.size);
  drawTextFromTop(page, normalizedText, {
    x: options.x + ((options.width - textWidth) / 2),
    top: options.top,
    size: options.size,
    font: options.font,
    color: options.color,
  });
}

function drawImageFromTop(
  page: PDFPage,
  image: PDFImage,
  x: number,
  top: number,
  size: { width: number; height: number },
) {
  page.drawImage(image, {
    x,
    y: toPdfY(top + size.height),
    width: size.width,
    height: size.height,
  });
}

function toPdfY(topOffset: number) {
  return PAGE_HEIGHT - topOffset;
}

function openPdfDocument(bytes: Uint8Array, filename: string) {
  const arrayBuffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(arrayBuffer).set(bytes);
  const blob = new Blob([arrayBuffer], { type: 'application/pdf' });
  const blobUrl = URL.createObjectURL(blob);
  const popup = window.open(blobUrl, '_blank', 'noopener,noreferrer');

  if (!popup) {
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  window.setTimeout(() => {
    URL.revokeObjectURL(blobUrl);
  }, 60_000);
}

async function resolvePdfLogo(
  pdfDoc: PDFDocument,
  logoUrl: string | null,
): Promise<{ image: PDFImage; width: number; height: number } | null> {
  if (!logoUrl || typeof window === 'undefined') {
    return null;
  }

  try {
    const response = await fetch(logoUrl);
    if (!response.ok) {
      return null;
    }

    const blob = await response.blob();
    const pngBlob = await convertBlobToPng(blob);
    const bytes = new Uint8Array(await pngBlob.arrayBuffer());
    const image = await pdfDoc.embedPng(bytes);

    return {
      image,
      width: image.width,
      height: image.height,
    };
  } catch {
    return null;
  }
}

async function convertBlobToPng(blob: Blob) {
  const image = await loadImageFromBlob(blob);
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth || image.width;
  canvas.height = image.naturalHeight || image.height;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Unable to render invoice logo');
  }

  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  cropCanvasToVisibleBounds(canvas, context);

  const output = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((pngBlob) => resolve(pngBlob), 'image/png');
  });

  if (!output) {
    throw new Error('Unable to encode invoice logo');
  }

  return output;
}

function cropCanvasToVisibleBounds(canvas: HTMLCanvasElement, context: CanvasRenderingContext2D) {
  const { width, height } = canvas;
  const pixels = context.getImageData(0, 0, width, height).data;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = ((y * width) + x) * 4;
      const alpha = pixels[offset + 3];
      if (alpha < 8) {
        continue;
      }

      const red = pixels[offset];
      const green = pixels[offset + 1];
      const blue = pixels[offset + 2];
      const isNearWhite = red > 245 && green > 245 && blue > 245;
      if (isNearWhite) {
        continue;
      }

      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }

  if (maxX < minX || maxY < minY) {
    return;
  }

  const cropWidth = maxX - minX + 1;
  const cropHeight = maxY - minY + 1;
  const cropped = context.getImageData(minX, minY, cropWidth, cropHeight);
  canvas.width = cropWidth;
  canvas.height = cropHeight;
  context.putImageData(cropped, 0, 0);
}

function loadImageFromBlob(blob: Blob) {
  const objectUrl = URL.createObjectURL(blob);

  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Unable to load invoice logo'));
    };
    image.src = objectUrl;
  });
}

function readString(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === 'string' && value.trim().length ? value.trim() : null;
}

function formatPdfAmount(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return '-';
  }

  return new Intl.NumberFormat('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatPdfCurrency(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return 'PHP 0.00';
  }

  return `PHP ${formatPdfAmount(value)}`;
}

function normalizePdfText(value: string) {
  return value
    .replaceAll('₱', 'PHP ')
    .replaceAll('—', '-')
    .replaceAll('–', '-')
    .replaceAll('’', "'")
    .replaceAll('‘', "'")
    .replaceAll('“', '"')
    .replaceAll('”', '"')
    .replaceAll('\u00A0', ' ');
}
