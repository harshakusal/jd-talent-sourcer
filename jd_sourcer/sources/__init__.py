from .github import GitHubSource
from .stackexchange import StackExchangeSource
from .hackernews import HackerNewsSource
from .gitlab import GitLabSource
from .devto import DevToSource
from .xray import XRaySource
from .reddit import RedditSource

ALL = {s.name: s for s in [GitHubSource, StackExchangeSource, HackerNewsSource, GitLabSource,
                           DevToSource, XRaySource, RedditSource]}
DEFAULT = ["github", "stackexchange", "hackernews", "gitlab", "devto", "xray"]
