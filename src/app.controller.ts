import { BadRequestException, Body, Controller, Get, Header, Post, Query } from '@nestjs/common';
import { toCsv } from './export';
import { SourceResult, SourcingService } from './sourcing.service';

class SourceDto { jd!: string; sources?: string[] | string; limit?: number; useLlm?: boolean }

@Controller('api')
export class AppController {
  private last: SourceResult | null = null;
  constructor(private readonly sourcing: SourcingService) {}

  @Get('health') health() { return { ok: true }; }
  @Get('sources') sources() { return this.sourcing.listSources(); }

  /** POST /api/source {jd, sources?, limit?, useLlm?}  -> ranked candidates. ?format=csv returns CSV. */
  @Post('source')
  async source(@Body() body: SourceDto, @Query('format') format?: string) {
    if (!body?.jd || typeof body.jd !== 'string' || body.jd.trim().length < 20) throw new BadRequestException('jd (string, >= 20 chars) is required');
    const sources = typeof body.sources === 'string' ? body.sources.split(',').map((s) => s.trim()).filter(Boolean) : body.sources;
    this.last = await this.sourcing.run({ jd: body.jd, sources, limit: body.limit ? +body.limit : undefined, useLlm: body.useLlm });
    return format === 'csv' ? toCsv(this.last.candidates) : this.last;
  }

  @Get('export.csv')
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename="candidates.csv"')
  exportCsv() { return toCsv(this.last?.candidates ?? []); }

  @Get('export.json')
  @Header('Content-Disposition', 'attachment; filename="candidates.json"')
  exportJson() { return this.last ?? { job: null, sources: {}, count: 0, candidates: [] }; }
}
