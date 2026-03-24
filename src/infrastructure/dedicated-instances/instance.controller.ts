import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { InstanceProvisionerService } from './instance-provisioner.service';
import { ProvisionInstanceDto } from './dto/provision-instance.dto';
import { ResourceConfigDto } from './dto/resource-config.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@Controller('infrastructure/instances')
@UseGuards(JwtAuthGuard)
export class InstanceController {
  constructor(private readonly provisionerService: InstanceProvisionerService) {}

  @Post('provision')
  async provision(@Body() dto: ProvisionInstanceDto) {
    return this.provisionerService.provisionInstance(dto);
  }

  @Get(':id')
  async getOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.provisionerService.getInstance(id);
  }

  @Get(':id/status')
  async getStatus(@Param('id', ParseUUIDPipe) id: string) {
    return this.provisionerService.getInstanceStatus(id);
  }

  @Get('user/:userId')
  async listUserInstances(
    @Param('userId') userId: string,
    @Query('page', ParseIntPipe) page = 1,
    @Query('pageSize', ParseIntPipe) pageSize = 10,
  ) {
    return this.provisionerService.listUserInstances(userId, page, pageSize);
  }

  @Get(':id/resources')
  async getResources(@Param('id', ParseUUIDPipe) id: string) {
    return this.provisionerService.getInstanceResources(id);
  }

  @Patch(':id/resources')
  async updateResource(@Body() dto: ResourceConfigDto) {
    return this.provisionerService.updateResourceAllocation(dto);
  }

  @Patch(':id/scale')
  async scale(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('replicaCount', ParseIntPipe) replicaCount: number,
  ) {
    return this.provisionerService.scaleInstance(id, replicaCount);
  }

  @Delete(':id')
  async terminate(@Param('id', ParseUUIDPipe) id: string) {
    return this.provisionerService.terminateInstance(id);
  }

  @Get(':id/config')
  async getConfig(@Param('id', ParseUUIDPipe) id: string) {
    return this.provisionerService.getInstanceConfig(id);
  }

  @Post(':id/config')
  async setConfig(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('key') key: string,
    @Body('value') value: string,
    @Body('isSecret') isSecret = false,
  ) {
    return this.provisionerService.setInstanceConfig(id, key, value, isSecret);
  }
}
