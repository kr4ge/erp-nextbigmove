import { Injectable } from '@nestjs/common';
import * as dayjs from 'dayjs';
import * as utc from 'dayjs/plugin/utc';
import * as timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

const TIMEZONE = 'Asia/Manila';

export interface DateRange {
  since: string; // YYYY-MM-DD
  until: string; // YYYY-MM-DD
}

@Injectable()
export class DateRangeService {
  /**
   * Calculate date range based on workflow config
   * Supports three types: relative, absolute, rolling
   */
  calculateDateRange(config: any): DateRange {
    const type = config?.type;

    switch (type) {
      case 'relative':
        return this.calculateRelativeRange(config.days);
      case 'absolute':
        return this.calculateAbsoluteRange(config.since, config.until);
      case 'rolling':
        return this.calculateRollingRange(config.offsetDays);
      default:
        throw new Error(`Invalid date range type: ${type}`);
    }
  }

  /**
   * Relative: Last N days
   * Example: days=7 means last 7 days from today
   */
  private calculateRelativeRange(days: number): DateRange {
    const until = dayjs().tz(TIMEZONE).format('YYYY-MM-DD');
    const since = dayjs().tz(TIMEZONE).subtract(days - 1, 'days').format('YYYY-MM-DD');

    return { since, until };
  }

  /**
   * Absolute: Specific date range
   * Example: since="2024-11-01", until="2024-11-30"
   */
  private calculateAbsoluteRange(since: string, until: string): DateRange {
    return {
      since: dayjs(since).format('YYYY-MM-DD'),
      until: dayjs(until).format('YYYY-MM-DD'),
    };
  }

  /**
   * Rolling: Offset from today
   * Example: offsetDays=0 means today, offsetDays=1 means yesterday
   */
  private calculateRollingRange(offsetDays: number): DateRange {
    const date = dayjs().tz(TIMEZONE).subtract(offsetDays, 'days').format('YYYY-MM-DD');

    return { since: date, until: date };
  }

  /**
   * Get array of dates between since and until (inclusive)
   */
  getDateArray(since: string, until: string): string[] {
    const dates: string[] = [];
    let current = dayjs(since);
    const end = dayjs(until);

    while (current.isBefore(end) || current.isSame(end, 'day')) {
      dates.push(current.format('YYYY-MM-DD'));
      current = current.add(1, 'day');
    }

    return dates;
  }

  /**
   * Calculate total days in date range
   */
  getTotalDays(since: string, until: string): number {
    return dayjs(until).diff(dayjs(since), 'days') + 1;
  }
}
