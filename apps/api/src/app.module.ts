import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpExceptionFilter } from './common/http-exception.filter';
import { ConfigModule, ENV, type Env } from './config/config.module';
import { typeormOptions } from './database/typeorm-options';
import { DeviceModule } from './modules/device/device.module';
import { GeoModule } from './modules/geo/geo.module';
import { HealthController } from './modules/health/health.controller';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forRootAsync({
      inject: [ENV],
      useFactory: (env: Env) => typeormOptions(env.DATABASE_URL),
    }),
    DeviceModule,
    GeoModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_FILTER, useClass: HttpExceptionFilter }],
})
export class AppModule {}
