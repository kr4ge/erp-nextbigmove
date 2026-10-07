import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { CreativeSourceMediaService } from './creative-source-media.service';

/**
 * Nightly housekeeping for held source files, registered only in the worker
 * role. A creative that was rejected and never overridden, or whose revision
 * never arrived, holds its file for the grace period and then lets it go. The
 * registry row and the analysis stay; only the bytes are removed.
 */
@Injectable()
export class CreativeMediaMaintenanceService {
  private readonly logger = new Logger(CreativeMediaMaintenanceService.name);
  private sweeping = false;

  constructor(private readonly sourceMedia: CreativeSourceMediaService) {}

  /** 03:15 server time, after the day's analyses and before the morning's sends. */
  @Cron('15 3 * * *')
  async sweepExpiredSources() {
    if (this.sweeping) return;
    this.sweeping = true;
    try {
      const result = await this.sourceMedia.sweepExpired();
      if (result.examined > 0) {
        this.logger.log(`Source media sweep: ${result.released}/${result.examined} expired file(s) released`);
      }
    } catch (error) {
      this.logger.error(`Source media sweep failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      this.sweeping = false;
    }
  }
}
