/** CLI: node dist/cli.js samples/sample_jd.txt [--sources github,stackexchange] [--limit 15] [--csv out.csv] [--json out.json] */
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { readFileSync, writeFileSync } from 'fs';
import { AppModule } from './app.module';
import { toCsv } from './export';
import { SourcingService } from './sourcing.service';

async function main() {
  const args = process.argv.slice(2);
  const opt = (k: string) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args.splice(i, 2)[1] : undefined; };
  const sources = opt('sources')?.split(','), limit = opt('limit'), csv = opt('csv'), json = opt('json'), top = +(opt('top') ?? 15);
  const jd = readFileSync(args[0] && args[0] !== '-' ? args[0] : 0, 'utf8');
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['warn', 'error'] });
  const r = await app.get(SourcingService).run({ jd, sources, limit: limit ? +limit : undefined });
  console.log(`Role: ${r.job.title} | ${r.job.seniority} | ${r.job.location || '-'}${r.job.remote ? ' (remote ok)' : ''}\nSkills: ${r.job.skills.join(', ')}`);
  console.log('Sources:', Object.entries(r.sources).map(([k, v]) => `${k}=${v}`).join(', '), '\n');
  r.candidates.slice(0, top).forEach((c, i) => console.log(`${String(i + 1).padStart(3)} ${String(c.score).padStart(5)}  ${c.name.slice(0, 26).padEnd(26)} ${c.sources.join(',').slice(0, 20).padEnd(20)} ${c.location.slice(0, 22).padEnd(22)} ${c.matchedSkills.join(',')} ${c.profileUrls[0] ?? ''}`));
  if (csv) writeFileSync(csv, toCsv(r.candidates));
  if (json) writeFileSync(json, JSON.stringify(r, null, 2));
  await app.close();
}
main();
