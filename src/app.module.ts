import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { AppController } from './app.controller';
import { ExtractService } from './extract.service';
import { ScoringService } from './scoring.service';
import { SourcesModule } from './sources/sources.module';
import { SourcingService } from './sourcing.service';

@Module({
  imports: [SourcesModule, ServeStaticModule.forRoot({ rootPath: join(__dirname, 'public'), exclude: ['/api/(.*)'] })],
  controllers: [AppController],
  providers: [ExtractService, ScoringService, SourcingService],
})
export class AppModule {}
