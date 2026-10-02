import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ENV, type Env } from '../config/config.module';
import { typeormOptions } from './typeorm-options';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forRootAsync({
      inject: [ENV],
      useFactory: (env: Env) => typeormOptions(env.DATABASE_URL),
    }),
  ],
})
export class DatabaseModule {}
