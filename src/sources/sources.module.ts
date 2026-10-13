import { Module } from '@nestjs/common';
import { DevToSource } from './devto.source';
import { GitHubSource } from './github.source';
import { GitLabSource } from './gitlab.source';
import { HackerNewsSource } from './hackernews.source';
import { RedditSource } from './reddit.source';
import { CANDIDATE_SOURCES, CandidateSource } from './source';
import { StackExchangeSource } from './stackexchange.source';
import { XRaySource } from './xray.source';

const PROVIDERS = [GitHubSource, StackExchangeSource, HackerNewsSource, GitLabSource, DevToSource, XRaySource, RedditSource];

@Module({
  providers: [
    ...PROVIDERS,
    { provide: CANDIDATE_SOURCES, useFactory: (...s: CandidateSource[]) => s, inject: PROVIDERS },
  ],
  exports: [CANDIDATE_SOURCES],
})
export class SourcesModule {}
