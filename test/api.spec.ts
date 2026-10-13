import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { readFileSync } from 'fs';
import { AppModule } from '../src/app.module';
import { makeCandidate } from '../src/models';
import { CANDIDATE_SOURCES } from '../src/sources/source';

const JD = readFileSync(__dirname + '/../samples/sample_jd.txt', 'utf8');

describe('POST /api/source (mocked sources)', () => {
  let app: INestApplication;
  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(CANDIDATE_SOURCES)
      .useValue([
        { name: 'ok', enabledByDefault: true, search: async () => [makeCandidate({ name: 'C', handle: 'c', source: 'ok', bio: 'python django', location: 'Bangalore' })] },
        { name: 'boom', enabledByDefault: true, search: async () => { throw new Error('down'); } },
        { name: 'off', enabledByDefault: false, search: async () => [] },
      ])
      .compile();
    app = mod.createNestApplication();
    await app.init();
  });
  afterAll(() => app.close());

  it('ranks candidates and isolates source failures', async () => {
    const r = await request(app.getHttpServer()).post('/api/source').send({ jd: JD, useLlm: false }).expect(201);
    expect(r.body.sources).toEqual({ ok: 'ok (1)', boom: 'error: down' });
    expect(r.body.candidates[0].matchedSkills).toEqual(expect.arrayContaining(['python', 'django']));
    expect(r.body.candidates[0].breakdown.location).toBe(15);
  });
  it('exports CSV', async () => {
    const r = await request(app.getHttpServer()).get('/api/export.csv').expect(200);
    expect(r.text).toContain('score,name');
  });
  it('rejects empty JD', () => request(app.getHttpServer()).post('/api/source').send({ jd: '' }).expect(400));
});
