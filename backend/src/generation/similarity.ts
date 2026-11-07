/**
 * Similitud textual entre el requerimiento y los registros históricos (TF-IDF con
 * similitud del coseno). Funciona sin servicios externos; más adelante puede
 * reemplazarse por búsqueda semántica (embeddings) sin cambiar quién la usa.
 */

const STOPWORDS = new Set(
  (
    'a al algo algun alguna algunas alguno algunos ante antes aqui asi aun cada como con contra cual cuales cuando de del desde ' +
    'donde dos durante e el ella ellas ellos en entre era eran es esa esas ese eso esos esta estan estar estas este esto estos ' +
    'fue fueron ha han hasta hay la las le les lo los mas me mientras mismo muy nada ni no nos o otra otras otro otros para pero ' +
    'poco por porque que quien se ser si sin sino sobre solo son su sus tal tambien tanto te tiene tienen todo todos tras tu un ' +
    'una unas uno unos usted y ya cuyo debe deben puede pueden sera seran segun cual cualquier dicho dicha mediante quiero como'
  ).split(/\s+/),
);

/** Normaliza, separa en palabras, quita palabras vacías y aplica una reducción simple de plurales. */
export function tokenize(text: string): string[] {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t))
    .map((t) => (t.length > 5 && t.endsWith('es') ? t.slice(0, -2) : t.length > 4 && t.endsWith('s') ? t.slice(0, -1) : t));
}

type Vector = Map<string, number>;

function termFrequencies(tokens: string[]): Map<string, number> {
  const tf = new Map<string, number>();
  for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
  return tf;
}

function cosine(a: Vector, b: Vector): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (const [t, w] of a) {
    na += w * w;
    const wb = b.get(t);
    if (wb) dot += w * wb;
  }
  for (const w of b.values()) nb += w * w;
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

/**
 * Devuelve, para cada documento, su similitud (0 a 1) con la consulta. El IDF se
 * calcula sobre el conjunto de documentos más la consulta.
 */
export function similarityScores(query: string, documents: string[]): number[] {
  const docTokens = documents.map(tokenize);
  const queryTokens = tokenize(query);
  const all = [...docTokens, queryTokens];
  const df = new Map<string, number>();
  for (const tokens of all) for (const t of new Set(tokens)) df.set(t, (df.get(t) ?? 0) + 1);
  const n = all.length;
  const vectorize = (tokens: string[]): Vector => {
    const v: Vector = new Map();
    for (const [t, f] of termFrequencies(tokens)) v.set(t, (1 + Math.log(f)) * Math.log(1 + n / (df.get(t) ?? 1)));
    return v;
  };
  const q = vectorize(queryTokens);
  return docTokens.map((tokens) => cosine(q, vectorize(tokens)));
}
