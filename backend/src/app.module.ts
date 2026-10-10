import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from './auth/auth.module';
import { CatalogsModule } from './catalogs/catalogs.module';
import { ImportsModule } from './imports/imports.module';
import { KnowledgeModule } from './knowledge/knowledge.module';
import { PermissionsModule } from './permissions/permissions.module';
import { TemplatesModule } from './templates/templates.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>('MONGODB_URI', 'mongodb://localhost:27017/qa_knowledge'),
      }),
    }),
    PermissionsModule,
    UsersModule,
    AuthModule,
    CatalogsModule,
    KnowledgeModule,
    ImportsModule,
    TemplatesModule,
  ],
})
export class AppModule {}
