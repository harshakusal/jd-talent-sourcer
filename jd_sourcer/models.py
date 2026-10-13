from dataclasses import dataclass, field, asdict
from typing import Dict, List, Optional


@dataclass
class JobProfile:
    title: str = ""
    seniority: str = "mid"
    skills: List[str] = field(default_factory=list)
    must_have: List[str] = field(default_factory=list)
    location: str = ""
    remote: bool = False
    min_years: Optional[int] = None

    def to_dict(self):
        return asdict(self)


@dataclass
class Candidate:
    name: str
    handle: str
    source: str
    profile_urls: List[str] = field(default_factory=list)
    location: str = ""
    bio: str = ""
    skills: List[str] = field(default_factory=list)  # raw skill/tag/language signals
    last_active: Optional[str] = None  # ISO date
    signals: Dict[str, float] = field(default_factory=dict)  # stars, reputation, followers...
    sources: List[str] = field(default_factory=list)
    matched_skills: List[str] = field(default_factory=list)
    score: float = 0.0
    breakdown: Dict[str, float] = field(default_factory=dict)

    def __post_init__(self):
        if not self.sources:
            self.sources = [self.source]

    def text(self) -> str:
        return " ".join([self.bio or "", " ".join(self.skills)]).lower()

    def to_dict(self):
        return asdict(self)
