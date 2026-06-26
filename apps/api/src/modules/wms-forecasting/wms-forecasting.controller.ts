import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { WmsAccessGuard } from '../../common/guards/wms-access.guard';
import { GetWmsForecastingDto } from './dto/get-wms-forecasting.dto';
import { WmsForecastingService } from './wms-forecasting.service';

@Controller('wms/forecasting')
@UseGuards(JwtAuthGuard, WmsAccessGuard)
export class WmsForecastingController {
  constructor(private readonly wmsForecastingService: WmsForecastingService) {}

  @Get()
  @Permissions('wms.forecast.read')
  async getForecast(@Query() query: GetWmsForecastingDto) {
    return this.wmsForecastingService.getForecast(query);
  }

  @Post('generate')
  @Permissions('wms.forecast.read')
  async generateForecast(@Body() body: GetWmsForecastingDto) {
    return this.wmsForecastingService.generateForecast(body);
  }
}
