import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from '@jest/globals';
import { SmsPhoneService } from './sms-phone.service';

describe('SmsPhoneService', () => {
  const service = new SmsPhoneService();

  describe('normalize', () => {
    it.each([
      ['09171234567', '+639171234567'],
      ['9171234567', '+639171234567'],
      ['639171234567', '+639171234567'],
      ['+639171234567', '+639171234567'],
      ['00639171234567', '+639171234567'],
      ['+6309171234567', '+639171234567'],
      ['6309171234567', '+639171234567'],
      ['tel:+63 917 123 4567', '+639171234567'],
    ])('normalizes %s to %s', (input, expected) => {
      expect(service.normalize(input)).toBe(expected);
    });

    it('rejects invalid phone numbers', () => {
      expect(() => service.normalize('123')).toThrow(BadRequestException);
    });
  });

  describe('message analysis', () => {
    it('keeps outbound messages limited to one segment', () => {
      expect(() => service.analyzeBody('a'.repeat(161))).toThrow(BadRequestException);
    });

    it('accepts and counts multipart inbound GSM-7 messages', () => {
      expect(service.analyzeInboundBody('a'.repeat(161))).toMatchObject({
        encoding: 'GSM-7',
        segmentCount: 2,
      });
    });

    it('accepts and counts multipart inbound Unicode messages', () => {
      expect(service.analyzeInboundBody('你'.repeat(71))).toMatchObject({
        encoding: 'UCS-2',
        segmentCount: 2,
      });
    });

    it('rejects unexpectedly large inbound payloads', () => {
      expect(() => service.analyzeInboundBody('a'.repeat(4097))).toThrow(
        BadRequestException,
      );
    });
  });
});
