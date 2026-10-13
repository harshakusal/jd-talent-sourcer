/** Canonical skill -> aliases. */
export const SKILLS: Record<string, string[]> = {
  python: ['python', 'py3'], java: ['java'], javascript: ['javascript', 'js', 'ecmascript'],
  typescript: ['typescript', 'ts'], go: ['golang', 'go lang'], rust: ['rust'], 'c++': ['c++', 'cpp'],
  'c#': ['c#', 'csharp', '.net', 'dotnet'], ruby: ['ruby'], php: ['php'], kotlin: ['kotlin'], swift: ['swift'],
  scala: ['scala'], sql: ['sql'], postgresql: ['postgres', 'postgresql'], mysql: ['mysql'],
  mongodb: ['mongodb', 'mongo'], redis: ['redis'], elasticsearch: ['elasticsearch', 'opensearch'],
  react: ['react', 'reactjs', 'react.js'], vue: ['vue', 'vuejs'], angular: ['angular'],
  'node.js': ['node.js', 'nodejs'], 'next.js': ['next.js', 'nextjs'], nestjs: ['nestjs', 'nest.js'],
  django: ['django'], flask: ['flask'], fastapi: ['fastapi'], spring: ['spring boot', 'spring'],
  rails: ['rails', 'ruby on rails'], graphql: ['graphql'], rest: ['rest api', 'rest apis', 'restful'],
  aws: ['aws', 'amazon web services'], gcp: ['gcp', 'google cloud'], azure: ['azure'],
  docker: ['docker', 'containers'], kubernetes: ['kubernetes', 'k8s'], terraform: ['terraform'],
  'ci/cd': ['ci/cd', 'github actions', 'jenkins', 'gitlab ci'], linux: ['linux'], kafka: ['kafka'],
  spark: ['spark', 'pyspark'], airflow: ['airflow'], dbt: ['dbt'],
  'machine learning': ['machine learning', 'ml'], 'deep learning': ['deep learning'],
  pytorch: ['pytorch', 'torch'], tensorflow: ['tensorflow', 'keras'], nlp: ['nlp', 'natural language processing'],
  llm: ['llm', 'llms', 'large language model', 'langchain', 'rag'], 'computer vision': ['computer vision', 'opencv'],
  pandas: ['pandas'], numpy: ['numpy'], 'scikit-learn': ['scikit-learn', 'sklearn'],
  microservices: ['microservices', 'microservice'], 'distributed systems': ['distributed systems'],
  ios: ['ios'], android: ['android'], flutter: ['flutter', 'dart'], 'html/css': ['html', 'css', 'tailwind'],
};
export const GH_LANG: Record<string, string> = {
  python: 'python', java: 'java', javascript: 'javascript', typescript: 'typescript', go: 'go', rust: 'rust',
  'c++': 'c++', 'c#': 'c#', ruby: 'ruby', php: 'php', kotlin: 'kotlin', swift: 'swift', scala: 'scala', flutter: 'dart',
  'node.js': 'javascript', nestjs: 'typescript', react: 'javascript', django: 'python', fastapi: 'python',
};
const SO_TAG: Record<string, string> = {
  'machine learning': 'machine-learning', 'deep learning': 'deep-learning', 'computer vision': 'computer-vision',
  'ci/cd': 'continuous-integration', gcp: 'google-cloud-platform', aws: 'amazon-web-services', rails: 'ruby-on-rails',
  spring: 'spring-boot', 'html/css': 'css', llm: 'large-language-model', 'distributed systems': 'distributed-system',
  vue: 'vue.js', react: 'reactjs', nestjs: 'nestjs',
};
export const soTag = (s: string) => SO_TAG[s] ?? s.replace(/ /g, '-');

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const PATTERNS = Object.entries(SKILLS).map(([canon, aliases]) => ({
  canon,
  re: new RegExp(`(?<![\\w+#.])(?:${[canon, ...aliases].map(esc).join('|')})(?![\\w+#])`, 'i'),
}));

/** Return canonical skills found in text, ordered by first appearance. */
export function findSkills(text: string): string[] {
  const t = ` ${text.toLowerCase().replace(/[(),;|•\n]/g, ' ')} `;
  const found: [string, number][] = [];
  for (const { canon, re } of PATTERNS) {
    const m = re.exec(t);
    if (m) found.push([canon, m.index]);
  }
  return found.sort((a, b) => a[1] - b[1]).map((f) => f[0]);
}

export function normalize(token: string): string | null {
  const t = token.toLowerCase().trim();
  for (const [canon, aliases] of Object.entries(SKILLS)) if (t === canon || aliases.includes(t)) return canon;
  return null;
}
