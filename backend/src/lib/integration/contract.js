/**
 * Integration Engine — le contrat Connector.
 *
 * Un connecteur TRADUIT et TRANSPORTE. Il ne décide jamais (Loi 2). Ce fichier dit ce
 * qu'un connecteur doit savoir faire, et refuse au boot toute déclaration incomplète.
 *
 * POURQUOI VALIDER SI TÔT ET SI DUREMENT. Un connecteur incomplet ne se manifeste pas
 * au démarrage mais trois semaines plus tard, sur la boutique d'un commerçant, au
 * moment d'une vente. Le seul moment où le coût d'une déclaration fausse est nul, c'est
 * avant que le serveur accepte sa première requête.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LOI 16 — LA FRONTIÈRE DE SUBSTITUTION PASSE ICI, ET NULLE PART AILLEURS.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * L'Organe d'Orchestration ne dialogue jamais directement avec un logiciel tiers : il
 * orchestre des intentions métier. Traduction, authentification, mapping, webhook,
 * synchronisation et protocole appartiennent exclusivement à cet organe et à ses
 * connecteurs. Ce fichier est le point où le vocabulaire canonique de Ma Zone rencontre
 * le dialecte d'un éditeur, et ce contact ne doit remonter nulle part.
 *
 * Conséquence pratique pour qui écrit un connecteur : tout ce que vous savez de votre
 * éditeur reste dans votre fichier. Ni un organe, ni un plan d'intention, ni le CDM ne
 * doit avoir à changer pour vous accueillir. Si c'est le cas, la faute est ici.
 */

/**
 * Capacités déclarables par un connecteur.
 *
 * Une capacité décrit ce qu'un connecteur SAIT FAIRE, en vocabulaire Ma Zone. Elle ne
 * nomme jamais un protocole ni un éditeur : `push_sales` est licite, `push_sales_rest`
 * ne l'est pas. C'est ce qui permet à l'orchestration de tenir compte d'un logiciel
 * tiers sans jamais le connaître — elle lit une capacité, jamais sa cause.
 *
 * `methods` liste ce que la capacité EXIGE. Déclarer une capacité sans fournir sa
 * mécanique est l'erreur la plus coûteuse possible : Ma Zone promettrait au commerçant
 * un service qui échouerait au premier usage.
 */
const CONNECTOR_CAPABILITIES = {
  push_sales: {
    label: 'Envoyer les ventes Ma Zone vers le logiciel du commerçant',
    methods: ['push', 'fromCanonical'],
    resources: ['order'],
  },
  push_inventory: {
    label: 'Envoyer les mouvements de stock Ma Zone vers le logiciel',
    methods: ['push', 'fromCanonical'],
    resources: ['inventory'],
  },
  pull_inventory: {
    label: 'Recevoir le stock depuis le logiciel du commerçant',
    methods: ['pull', 'toCanonical'],
    resources: ['inventory'],
  },
  pull_catalog: {
    label: 'Recevoir le catalogue depuis le logiciel du commerçant',
    methods: ['pull', 'toCanonical'],
    resources: ['product'],
  },
  webhooks: {
    label: 'Être prévenu en temps réel par le logiciel du commerçant',
    // Un webhook non vérifié est une porte ouverte : n'importe qui pourrait déclarer
    // un stock. La vérification n'est donc pas optionnelle quand la capacité est là.
    methods: ['verifyWebhook', 'subscribeWebhooks', 'toCanonical'],
    resources: [],
  },
};

const CAPABILITY_IDS = Object.keys(CONNECTOR_CAPABILITIES);

/**
 * Ressources canoniques qu'un connecteur peut manipuler.
 *
 * Ce sont des noms d'entités du CDM, pas des tables ni des points d'entrée d'API. Un
 * connecteur qui aurait besoin d'une ressource absente de cette liste demande en
 * réalité une extension du CDM — une discussion, pas un ajout discret.
 */
const RESOURCES = ['product', 'inventory', 'order', 'customer'];

/** Méthodes du contrat. Aucune n'est obligatoire en soi : les capacités les exigent. */
const CONTRACT_METHODS = [
  'authenticate',
  'pull',
  'push',
  'subscribeWebhooks',
  'verifyWebhook',
  'toCanonical',
  'fromCanonical',
];

/**
 * Comment un logiciel se connecte. Deux modes, et c'est un choix de FAMILLE, pas de premier
 * cas.
 *
 * L'étape 8 a été ouverte par un éditeur qui parle OAuth. Il aurait été plus court de ne
 * traiter que celui-là. Ç'aurait aussi été une erreur mesurable : une part importante des
 * logiciels visés — extensions de boutique en ligne, logiciels de gestion installés — ne
 * délivrent pas de jeton par redirection mais une PAIRE DE CLÉS que le commerçant copie
 * depuis son back-office. Un moteur qui ne connaîtrait que la redirection obligerait le
 * connecteur suivant à simuler un flux OAuth qui n'existe pas chez lui.
 *
 * Les deux modes aboutissent au même endroit : des secrets dans le coffre, une installation
 * active, et rien de spécifique à un éditeur dans le moteur.
 */
const CONNECTION_MODE = {
  /** Redirection chez l'éditeur, consentement, code échangé contre un jeton. */
  DELEGATED: 'delegated',
  /** Le commerçant colle des identifiants obtenus chez son éditeur. */
  CREDENTIALS: 'credentials',
  /** Rien à connecter : fichiers, saisie, ou logiciel sans API. */
  NONE: 'none',
};

const CONNECTOR_ID = /^[a-z][a-z0-9_]*$/;
const SECRET_NAME = /^[a-z][a-z0-9_]*$/;

class ConnectorDeclarationError extends Error {
  constructor(message) {
    super(`[Integration] ${message}`);
    this.name = 'ConnectorDeclarationError';
  }
}

/**
 * Valide et normalise une déclaration de connecteur.
 *
 * @param {object} def
 * @param {string} def.id                 identifiant stable (`manual`)
 * @param {string} def.label              phrase lisible par un commerçant
 * @param {boolean} [def.requiresAuth]    le connecteur a-t-il besoin d'un secret ?
 * @param {string[]} def.capabilities     capacités déclarées
 * @param {string[]} [def.resources]      ressources canoniques touchées
 * @param {string[]} [def.secrets]        noms canoniques des secrets exigés
 * @param {object} [def.oauth]            descripteur de connexion déléguée
 * @param {object[]} [def.credentialFields] champs à demander au commerçant
 */
function defineConnector(def) {
  if (!def || typeof def !== 'object') {
    throw new ConnectorDeclarationError('déclaration de connecteur vide');
  }

  const {
    id, label, capabilities = [], resources = [], requiresAuth = false,
    secrets = [], oauth = null, credentialFields = null,
  } = def;

  if (!CONNECTOR_ID.test(id || '')) {
    throw new ConnectorDeclarationError(
      `identifiant de connecteur invalide « ${id} » — attendu minuscules et underscores`
    );
  }
  if (typeof label !== 'string' || label.trim().length === 0) {
    throw new ConnectorDeclarationError(`« ${id} » n'a pas de libellé lisible par un commerçant`);
  }
  if (!Array.isArray(capabilities) || capabilities.length === 0) {
    throw new ConnectorDeclarationError(
      `« ${id} » ne déclare aucune capacité — un connecteur qui ne sait rien faire n'a pas de raison d'exister`
    );
  }

  for (const capability of capabilities) {
    const spec = CONNECTOR_CAPABILITIES[capability];
    if (!spec) {
      throw new ConnectorDeclarationError(
        `capacité inconnue « ${capability} » chez « ${id} » — connues : ${CAPABILITY_IDS.join(', ')}`
      );
    }
    for (const method of spec.methods) {
      if (typeof def[method] !== 'function') {
        throw new ConnectorDeclarationError(
          `« ${id} » déclare « ${capability} » mais n'implémente pas ${method}() — `
          + 'une capacité annoncée et absente promet au commerçant un service qui échouera'
        );
      }
    }
  }

  for (const resource of resources) {
    if (!RESOURCES.includes(resource)) {
      throw new ConnectorDeclarationError(
        `ressource inconnue « ${resource} » chez « ${id} » — connues : ${RESOURCES.join(', ')}`
      );
    }
  }

  const connectionMode = assertConnectable({ id, label, requiresAuth, oauth, credentialFields });
  assertSecretNames(id, secrets, requiresAuth);

  const normalized = {
    id,
    label,
    requiresAuth: !!requiresAuth,
    capabilities: [...new Set(capabilities)],
    resources: resourcesFor(capabilities, resources),
    secrets: [...new Set(secrets)],
    connectionMode,
    oauth: oauth || null,
    credentialFields: credentialFields || null,
  };

  for (const method of CONTRACT_METHODS) {
    normalized[method] = typeof def[method] === 'function' ? def[method] : null;
  }

  return normalized;
}

/**
 * Un connecteur qui exige des identifiants doit dire COMMENT on les obtient.
 *
 * C'est le refus que l'étape 6 n'avait pas su formuler. Elle exigeait `authenticate()`, ce
 * qui laissait passer un connecteur capable de vérifier un jeton sans qu'aucun chemin
 * n'existe pour l'acquérir : le commerçant se retrouvait devant un logiciel branché
 * « en théorie ». Ce que le moteur doit exiger n'est pas une fonction de vérification, c'est
 * un MODE DE CONNEXION.
 *
 * `authenticate()` devient donc ce qu'il aurait toujours dû être : un test de connexion
 * optionnel, appelé juste après le rangement des identifiants, pour qu'une clé fausse se
 * révèle devant le commerçant qui vient de la coller — et pas trois heures plus tard, dans
 * un journal technique, sous la forme d'un stock qui ne se met plus à jour.
 */
function assertConnectable({ id, label, requiresAuth, oauth, credentialFields }) {
  if (!requiresAuth) {
    if (oauth || credentialFields) {
      throw new ConnectorDeclarationError(
        `« ${id} » décrit un moyen de connexion mais annonce requiresAuth: false — `
        + 'l\'un des deux est faux, et le commerçant en paierait la différence'
      );
    }
    return CONNECTION_MODE.NONE;
  }

  if (oauth && credentialFields) {
    throw new ConnectorDeclarationError(
      `« ${id} » décrit deux modes de connexion à la fois — un commerçant doit avoir un `
      + 'chemin, pas un choix technique à faire'
    );
  }

  if (oauth) {
    assertOauthDescriptor(id, oauth);
    return CONNECTION_MODE.DELEGATED;
  }

  if (Array.isArray(credentialFields) && credentialFields.length) {
    for (const field of credentialFields) {
      if (!field?.name || !SECRET_NAME.test(field.name)) {
        throw new ConnectorDeclarationError(
          `« ${id} » déclare un identifiant à saisir dont le nom est invalide `
          + `(« ${field?.name} ») — attendu minuscules et underscores`
        );
      }
      if (!field.label) {
        throw new ConnectorDeclarationError(
          `« ${id} » demande « ${field.name} » sans libellé : un commerçant ne peut pas `
          + 'coller une valeur qu\'on ne sait pas lui nommer'
        );
      }
    }
    return CONNECTION_MODE.CREDENTIALS;
  }

  throw new ConnectorDeclarationError(
    `« ${label || id} » exige des identifiants mais ne dit pas comment les obtenir : `
    + 'déclarez soit `oauth` (redirection chez l\'éditeur), soit `credentialFields` '
    + '(saisie par le commerçant). Un connecteur qu\'on ne peut pas connecter n\'a pas '
    + 'de raison d\'exister.'
  );
}

/**
 * Le descripteur de connexion déléguée est-il exploitable ?
 *
 * Validé ICI et pas dans `oauth.js`, volontairement : le contrat valide des DÉCLARATIONS au
 * démarrage, le moteur d'autorisation exécute un FLUX en présence d'un commerçant. Mélanger
 * les deux ferait dépendre la validation d'une déclaration de l'état de la base et de la
 * configuration du serveur, et un connecteur mal déclaré ne se révélerait plus au boot.
 */
function assertOauthDescriptor(id, descriptor) {
  for (const fn of ['authorizeUrl', 'tokenRequest', 'parseToken']) {
    if (typeof descriptor[fn] !== 'function') {
      throw new ConnectorDeclarationError(
        `« ${id} » décrit une connexion déléguée sans ${fn}() — le moteur ne devine ni `
        + 'l\'URL de consentement, ni la requête d\'échange, ni la forme de la réponse'
      );
    }
  }

  for (const param of descriptor.params || []) {
    if (!param?.name || !param?.label) {
      throw new ConnectorDeclarationError(
        `« ${id} » demande un paramètre de connexion sans nom ni libellé`
      );
    }
  }

  // Une portée déclarée est une portée que le commerçant peut lire avant d'accepter. Un
  // connecteur qui n'en déclare aucune demande soit rien, soit tout — et « tout » ne doit
  // pas être une valeur par défaut silencieuse.
  if (descriptor.scopes && !Array.isArray(descriptor.scopes)) {
    throw new ConnectorDeclarationError(`« ${id} » déclare des portées qui ne sont pas une liste`);
  }
}

/**
 * Les noms de secrets sont canoniques, jamais des noms d'éditeur.
 *
 * `access_token` est licite, `shopify_token` ne l'est pas : le coffre est un mécanisme de
 * famille, et un nom d'éditeur dans une colonne du moteur est le premier pas vers un moteur
 * qui connaît ses éditeurs.
 */
function assertSecretNames(id, secrets, requiresAuth) {
  if (requiresAuth && (!Array.isArray(secrets) || secrets.length === 0)) {
    throw new ConnectorDeclarationError(
      `« ${id} » exige des identifiants sans dire lesquels ranger — déclarez \`secrets\``
    );
  }

  for (const name of secrets || []) {
    if (!SECRET_NAME.test(name)) {
      throw new ConnectorDeclarationError(
        `« ${id} » déclare un secret nommé « ${name} » — attendu minuscules et underscores`
      );
    }
  }
}

/**
 * Ressources effectives : celles déclarées, plus celles impliquées par les capacités.
 *
 * Déduire évite une classe entière d'incohérences — déclarer `push_sales` sans
 * `order` — sans obliger l'auteur du connecteur à répéter ce que sa capacité dit déjà.
 */
function resourcesFor(capabilities, declared) {
  const implied = capabilities.flatMap((c) => CONNECTOR_CAPABILITIES[c]?.resources || []);
  return [...new Set([...declared, ...implied])];
}

/** Le connecteur sait-il faire cela ? */
function supports(connector, capability) {
  return !!connector && connector.capabilities.includes(capability);
}

module.exports = {
  CONNECTOR_CAPABILITIES,
  CAPABILITY_IDS,
  RESOURCES,
  CONTRACT_METHODS,
  CONNECTION_MODE,
  defineConnector,
  supports,
  ConnectorDeclarationError,
};
