/**
 * Connecteur manuel — lecture et écriture de CSV.
 *
 * Volontairement écrit à la main plutôt qu'avec une bibliothèque. Trois raisons, et la
 * troisième est la vraie :
 *   1. le besoin est un CSV plat, sans structures imbriquées ;
 *   2. une dépendance de plus est une dépendance à surveiller ;
 *   3. les fichiers d'inventaire réels sont sales — points-virgules, BOM Excel,
 *      guillemets, virgules décimales françaises — et un parseur générique échoue
 *      proprement là où il faudrait pardonner.
 *
 * Ce qui est pardonné ici l'est délibérément. Un commerçant qui exporte depuis Excel ne
 * doit pas voir « erreur de parsing ligne 1 » parce que Windows a écrit trois octets
 * invisibles au début du fichier.
 */

/** Séparateurs candidats, du plus fréquent en France au plus rare. */
const CANDIDATE_DELIMITERS = [';', ',', '\t', '|'];

/**
 * Devine le séparateur sur la ligne d'en-tête.
 *
 * Le point-virgule gagne les égalités : c'est ce qu'Excel produit en configuration
 * française, et c'est le cas majoritaire de nos commerçants.
 */
function sniffDelimiter(headerLine) {
  let best = ';';
  let bestCount = 0;
  for (const delimiter of CANDIDATE_DELIMITERS) {
    const count = headerLine.split(delimiter).length - 1;
    if (count > bestCount) {
      best = delimiter;
      bestCount = count;
    }
  }
  return best;
}

/** Découpe une ligne en respectant les guillemets et les doublements `""`. */
function splitLine(line, delimiter) {
  const cells = [];
  let current = '';
  let quoted = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (quoted) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        current += char;
      }
      continue;
    }

    if (char === '"') quoted = true;
    else if (char === delimiter) {
      cells.push(current);
      current = '';
    } else current += char;
  }

  cells.push(current);
  return cells.map((cell) => cell.trim());
}

/** Normalise un nom de colonne : accents, casse et espaces ne doivent pas compter. */
function normalizeHeader(name) {
  return name
    .replace(/^\uFEFF/, '') // BOM d'Excel
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

/**
 * Parse un CSV en lignes nommées.
 *
 * @returns {{ headers: string[], rows: object[], delimiter: string }}
 */
function parse(text) {
  if (typeof text !== 'string' || text.trim().length === 0) {
    return { headers: [], rows: [], delimiter: ';' };
  }

  const lines = text
    .split(/\r\n|\r|\n/)
    .filter((line) => line.trim().length > 0);

  if (lines.length === 0) return { headers: [], rows: [], delimiter: ';' };

  const delimiter = sniffDelimiter(lines[0]);
  const headers = splitLine(lines[0], delimiter).map(normalizeHeader);

  const rows = lines.slice(1).map((line, index) => {
    const cells = splitLine(line, delimiter);
    const row = { __line: index + 2 }; // numéro de ligne du fichier, pour les erreurs
    headers.forEach((header, position) => {
      row[header] = cells[position] ?? '';
    });
    return row;
  });

  return { headers, rows, delimiter };
}

/**
 * Lit un entier tolérant : espaces, espaces insécables, séparateurs de milliers.
 *
 * Renvoie `null` plutôt que `NaN` ou `0`. La distinction est importante : une cellule
 * vide veut dire « je ne déclare rien », et la traiter comme un zéro effacerait le stock
 * d'un produit que le commerçant n'avait pas l'intention de toucher.
 */
function toInt(value) {
  if (value === null || value === undefined) return null;
  const cleaned = String(value).replace(/[\s\u00A0.]/g, '').replace(',', '.');
  if (cleaned === '') return null;
  const parsed = Number.parseInt(cleaned, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Sérialise des lignes en CSV. Point-virgule et BOM : Excel français ouvre sans rien régler. */
function serialize(rows, headers) {
  const columns = headers || (rows.length > 0 ? Object.keys(rows[0]) : []);
  const escape = (value) => {
    const text = value === null || value === undefined ? '' : String(value);
    return /[";\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };

  const lines = [columns.join(';')];
  for (const row of rows) lines.push(columns.map((c) => escape(row[c])).join(';'));

  return `\uFEFF${lines.join('\r\n')}\r\n`;
}

module.exports = { parse, serialize, toInt, normalizeHeader, sniffDelimiter, splitLine };
