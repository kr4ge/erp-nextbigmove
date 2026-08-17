import { BadRequestException, Injectable } from '@nestjs/common';

const GSM_BASIC =
  '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞ !\"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà';
const GSM_EXTENDED = '^{}\\[~]|€';
const INBOUND_BODY_MAX_LENGTH = 4096;

@Injectable()
export class SmsPhoneService {
  normalize(rawValue: string): string {
    const address = rawValue
      .trim()
      .replace(/^tel:/i, '')
      .split(';', 1)[0];
    const digits = address.replace(/\D/g, '');
    let normalized = address.trim().startsWith('+')
      ? `+${digits}`
      : digits.startsWith('00')
        ? `+${digits.slice(2)}`
        : digits;

    // Some Philippine carriers include the domestic trunk zero after +63.
    if (normalized.startsWith('+6309') && normalized.length === 14) {
      normalized = `+63${normalized.slice(4)}`;
    } else if (normalized.startsWith('6309') && normalized.length === 13) {
      normalized = `+63${normalized.slice(3)}`;
    } else if (normalized.startsWith('09') && normalized.length === 11) {
      normalized = `+63${normalized.slice(1)}`;
    } else if (normalized.startsWith('9') && normalized.length === 10) {
      normalized = `+63${normalized}`;
    } else if (normalized.startsWith('63') && normalized.length === 12) {
      normalized = `+${normalized}`;
    }

    if (!/^\+[1-9]\d{7,14}$/.test(normalized)) {
      throw new BadRequestException('Phone number must be a valid E.164 number');
    }

    return normalized;
  }

  analyzeBody(body: string) {
    const analysis = this.analyzeEncoding(body);
    const singleSegmentLimit = analysis.encoding === 'GSM-7' ? 160 : 70;
    if (analysis.encodedLength > singleSegmentLimit) {
      throw new BadRequestException(
        `Message must fit one SMS segment (${singleSegmentLimit} ${analysis.encoding === 'GSM-7' ? 'GSM-7' : 'Unicode'} characters)`,
      );
    }

    return {
      body: analysis.body,
      encoding: analysis.encoding,
      segmentCount: 1,
    };
  }

  analyzeInboundBody(body: string) {
    const analysis = this.analyzeEncoding(body);
    if (Array.from(analysis.body).length > INBOUND_BODY_MAX_LENGTH) {
      throw new BadRequestException(
        `Inbound message must be ${INBOUND_BODY_MAX_LENGTH} characters or fewer`,
      );
    }

    const singleSegmentLimit = analysis.encoding === 'GSM-7' ? 160 : 70;
    const multipartSegmentLimit = analysis.encoding === 'GSM-7' ? 153 : 67;
    const segmentCount = analysis.encodedLength <= singleSegmentLimit
      ? 1
      : Math.ceil(analysis.encodedLength / multipartSegmentLimit);

    return {
      body: analysis.body,
      encoding: analysis.encoding,
      segmentCount,
    };
  }

  private analyzeEncoding(body: string) {
    const normalizedBody = body.trim();
    if (!normalizedBody) {
      throw new BadRequestException('Message body is required');
    }

    let gsmLength = 0;
    let isGsm7 = true;
    for (const character of normalizedBody) {
      if (GSM_BASIC.includes(character)) {
        gsmLength += 1;
      } else if (GSM_EXTENDED.includes(character)) {
        gsmLength += 2;
      } else {
        isGsm7 = false;
        break;
      }
    }

    return {
      body: normalizedBody,
      encoding: isGsm7 ? 'GSM-7' as const : 'UCS-2' as const,
      encodedLength: isGsm7 ? gsmLength : Array.from(normalizedBody).length,
    };
  }
}
