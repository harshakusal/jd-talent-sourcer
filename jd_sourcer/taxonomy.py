"""Small skill taxonomy: canonical name -> aliases. Also maps to GitHub language / SO tag."""
SKILLS = {
    "python": ["python", "py3"], "java": ["java"], "javascript": ["javascript", "js", "ecmascript"],
    "typescript": ["typescript", "ts"], "go": ["golang", "go lang", " go "], "rust": ["rust"],
    "c++": ["c++", "cpp"], "c#": ["c#", "csharp", ".net", "dotnet"], "ruby": ["ruby"], "php": ["php"],
    "kotlin": ["kotlin"], "swift": ["swift"], "scala": ["scala"], "r": [" r ", "rstats"],
    "sql": ["sql"], "postgresql": ["postgres", "postgresql"], "mysql": ["mysql"], "mongodb": ["mongodb", "mongo"],
    "redis": ["redis"], "elasticsearch": ["elasticsearch", "elastic search", "opensearch"],
    "react": ["react", "reactjs", "react.js"], "vue": ["vue", "vuejs"], "angular": ["angular"],
    "node.js": ["node.js", "nodejs", "node"], "next.js": ["next.js", "nextjs"],
    "django": ["django"], "flask": ["flask"], "fastapi": ["fastapi"], "spring": ["spring boot", "spring"],
    "rails": ["rails", "ruby on rails"], "graphql": ["graphql"], "rest": ["rest api", "restful"],
    "aws": ["aws", "amazon web services"], "gcp": ["gcp", "google cloud"], "azure": ["azure"],
    "docker": ["docker", "containers"], "kubernetes": ["kubernetes", "k8s"], "terraform": ["terraform"],
    "ci/cd": ["ci/cd", "github actions", "jenkins", "gitlab ci"], "linux": ["linux"],
    "kafka": ["kafka"], "spark": ["spark", "pyspark"], "airflow": ["airflow"], "dbt": ["dbt"],
    "machine learning": ["machine learning", " ml ", "ml engineer"], "deep learning": ["deep learning"],
    "pytorch": ["pytorch", "torch"], "tensorflow": ["tensorflow", "keras"], "nlp": ["nlp", "natural language processing"],
    "llm": ["llm", "large language model", "langchain", "rag"], "computer vision": ["computer vision", "opencv"],
    "pandas": ["pandas"], "numpy": ["numpy"], "scikit-learn": ["scikit-learn", "sklearn"],
    "microservices": ["microservices", "microservice"], "distributed systems": ["distributed systems"],
    "ios": ["ios"], "android": ["android"], "flutter": ["flutter", "dart"], "html/css": ["html", "css", "tailwind"],
}
# GitHub "language:" qualifier names
GH_LANG = {"python": "python", "java": "java", "javascript": "javascript", "typescript": "typescript",
           "go": "go", "rust": "rust", "c++": "c++", "c#": "c#", "ruby": "ruby", "php": "php",
           "kotlin": "kotlin", "swift": "swift", "scala": "scala", "r": "r", "flutter": "dart"}
# Stack Overflow tag names
SO_TAG = {"c++": "c++", "c#": "c#", "node.js": "node.js", "next.js": "next.js", "machine learning": "machine-learning",
          "deep learning": "deep-learning", "scikit-learn": "scikit-learn", "computer vision": "computer-vision",
          "ci/cd": "continuous-integration", "gcp": "google-cloud-platform", "aws": "amazon-web-services",
          "rails": "ruby-on-rails", "spring": "spring-boot", "html/css": "css", "rest": "rest", "llm": "large-language-model",
          "distributed systems": "distributed-system", "go": "go", "vue": "vue.js", "react": "reactjs"}


def so_tag(skill: str) -> str:
    return SO_TAG.get(skill, skill.replace(" ", "-"))


def normalize(token: str):
    t = f" {token.lower().strip()} "
    for canon, aliases in SKILLS.items():
        if t.strip() == canon or any(a.strip() == t.strip() for a in aliases):
            return canon
    return None
