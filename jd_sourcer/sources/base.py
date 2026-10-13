class Source:
    """Pluggable source. Subclass, set `name`, implement search(profile, limit) -> list[Candidate]."""
    name = "base"

    def search(self, profile, limit=20):
        raise NotImplementedError
