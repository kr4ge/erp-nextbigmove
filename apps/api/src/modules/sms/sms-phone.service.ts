import { BadRequestException, Injectable } from '@nestjs/common';

const GSM_BASIC =
  '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞ !\"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà';
const GSM_EXTENDED = '^{}\\[~]|€';

@Injectable()
export class SmsPhoneService {
  normalize(rawValue: string): string {
    const compact = rawValue.trim().replace(/[^\d+]/g, '');
    let normalized = compact;

    if (compact.startsWith('09') && compact.length === 11) {
      normalized = `+63${compact.slice(1)}`;
    } else if (compact.startsWith('9') && compact.length === 10) {
      normalized = `+63${compact}`;
    } else if (compact.startsWith('63') && compact.length === 12) {
      normalized = `+${compact}`;
    }

    if (!/^\+[1-9]\d{7,14}$/.test(normalized)) {
      throw new BadRequestException('Phone number must be a valid E.164 number');
    }

    return normalized;
  }

  analyzeBody(body: string) {
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

    const encodedLength = isGsm7 ? gsmLength : Array.from(normalizedBody).length;
    const singleSegmentLimit = isGsm7 ? 160 : 70;
    if (encodedLength > singleSegmentLimit) {
      throw new BadRequestException(
        `Message must fit one SMS segment (${singleSegmentLimit} ${isGsm7 ? 'GSM-7' : 'Unicode'} characters)`,
      );
    }

    return {
      body: normalizedBody,
      encoding: isGsm7 ? 'GSM-7' : 'UCS-2',
      segmentCount: 1,
    };
  }
}
