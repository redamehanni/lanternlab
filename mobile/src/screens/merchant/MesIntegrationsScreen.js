/**
 * Épée — « Mes logiciels ».
 *
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │ CET ÉCRAN NE CONNAÎT AUCUN ÉDITEUR, ET C'EST SA SEULE RÈGLE.                 │
 * │                                                                             │
 * │ Il ne contient ni « Shopify », ni aucun autre nom de logiciel. Le backend    │
 * │ décrit chaque connecteur — son libellé, son mode de connexion, les champs à  │
 * │ demander — et cet écran DESSINE cette description. Le prochain logiciel du   │
 * │ marché n'ajoutera donc pas une ligne ici : il apparaîtra tout seul.          │
 * └─────────────────────────────────────────────────────────────────────────────┘
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LE CHEMIN DU TABLEUR RESTE VISIBLE, MÊME QUAND UNE API EXISTE
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Le collage de catalogue est présenté au même niveau que les logiciels, pas rangé dans un
 * repli honteux. Trois raisons, et aucune n'est provisoire :
 *
 *   · beaucoup de commerçants n'ont AUCUN logiciel, et ils sont la majorité des premiers
 *     utilisateurs de Ma Zone ;
 *   · une connexion peut échouer, expirer, ou être refusée par un éditeur — et un commerçant
 *     qui ne peut pas vendre ce jour-là ne revient pas ;
 *   · un commerçant qui débranche son logiciel doit rester debout.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LE JOURNAL DE CONFLITS EST MONTRÉ, PAS CACHÉ
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Quand Ma Zone refuse ce qu'un logiciel propose — un stock déclaré alors que le commerçant
 * en garde la tenue, un article inconnu —, la décision lui est dite. L'alternative serait un
 * journal technique que personne ne lit et un stock qui ne bouge pas sans raison visible.
 */

import React, { useCallback, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet,
  ActivityIndicator, RefreshControl, Alert, Linking,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  getMyStore, getIntegrations, connectIntegration, disconnectIntegration,
  reconcileIntegrations, inspectCatalogImport, importCatalog,
  acknowledgeIntegrationConflict,
} from '../../api';
import { THEME } from '../../theme';

/** Modes de connexion, tels que le backend les nomme. Aucun éditeur ici. */
const MODE = { DELEGATED: 'delegated', CREDENTIALS: 'credentials', NONE: 'none' };

export default function MesIntegrationsScreen() {
  const [store, setStore] = useState(null);
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(null);
  const [inputs, setInputs] = useState({});
  const [document, setDocument] = useState('');
  const [inspection, setInspection] = useState(null);

  const load = useCallback(async () => {
    try {
      const mine = await getMyStore();
      const boutique = mine.data.store;
      setStore(boutique || null);
      if (!boutique) { setState(null); return; }

      const res = await getIntegrations(boutique.id);
      setState(res.data);
    } catch (err) {
      setState(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  /** Valeur saisie pour un champ d'un connecteur donné. */
  const valueOf = (connectorId, field) => inputs[`${connectorId}.${field}`] ?? '';
  const setValue = (connectorId, field, value) =>
    setInputs((prev) => ({ ...prev, [`${connectorId}.${field}`]: value }));

  /**
   * Branche un logiciel.
   *
   * L'écran envoie ce qu'il a récolté et laisse le backend décider de la suite : une URL de
   * consentement à ouvrir, ou un branchement déjà fait. Il ne devine pas le mode — il le lit.
   */
  async function connect(connector) {
    const { form } = connector;
    const values = {};
    for (const field of form.fields) {
      const value = valueOf(connector.id, field.name).trim();
      if (!value && field.required !== false) {
        Alert.alert('Information manquante', `« ${field.label} » est nécessaire.`);
        return;
      }
      if (value) values[field.name] = value;
    }

    setBusy(connector.id);
    try {
      const payload = form.mode === MODE.DELEGATED
        ? { params: values }
        : { credentials: values };

      const res = await connectIntegration(store.id, connector.id, payload);

      if (res.data.authorize_url) {
        // La connexion se termine chez l'éditeur, dans le navigateur du téléphone : c'est
        // LUI qui doit voir l'écran de consentement de son propre logiciel, sur son propre
        // domaine. Une page de saisie déguisée dans notre application demanderait à un
        // commerçant d'entrer ses identifiants ailleurs que chez lui.
        await Linking.openURL(res.data.authorize_url);
        Alert.alert(
          'Autorisation en cours',
          'Validez la connexion dans votre logiciel, puis revenez ici et tirez pour '
          + 'rafraîchir.'
        );
      } else {
        Alert.alert('Logiciel branché', 'Votre catalogue et votre stock vont se synchroniser.');
      }
      await load();
    } catch (err) {
      Alert.alert('Connexion impossible', message(err));
    } finally {
      setBusy(null);
    }
  }

  function disconnect(connector) {
    Alert.alert(
      `Débrancher ${connector.label} ?`,
      'Vos produits et votre stock restent à vous. Ma Zone cessera de lire ce logiciel et '
      + 'oubliera ses identifiants.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Débrancher',
          style: 'destructive',
          onPress: async () => {
            setBusy(connector.id);
            try {
              await disconnectIntegration(store.id, connector.id);
              await load();
            } catch (err) {
              Alert.alert('Débranchement impossible', message(err));
            } finally {
              setBusy(null);
            }
          },
        },
      ]
    );
  }

  async function reconcile() {
    setBusy('reconcile');
    try {
      await reconcileIntegrations(store.id);
      await load();
      Alert.alert('Vérification faite', 'Ma Zone a confronté son stock à celui de vos logiciels.');
    } catch (err) {
      Alert.alert('Vérification impossible', message(err));
    } finally {
      setBusy(null);
    }
  }

  async function inspect() {
    setBusy('inspect');
    try {
      const res = await inspectCatalogImport(store.id, document);
      setInspection(res.data);
    } catch (err) {
      Alert.alert('Fichier illisible', message(err));
    } finally {
      setBusy(null);
    }
  }

  async function runImport() {
    setBusy('import');
    try {
      const res = await importCatalog(store.id, document);
      const { imported, rejected = [] } = res.data;
      setDocument('');
      setInspection(null);
      await load();
      Alert.alert(
        'Catalogue importé',
        `${imported} article(s) importé(s)`
        + (rejected.length ? `, ${rejected.length} ligne(s) non comprise(s).` : '.')
      );
    } catch (err) {
      Alert.alert('Import impossible', message(err));
    } finally {
      setBusy(null);
    }
  }

  async function acknowledge(conflictId) {
    try {
      await acknowledgeIntegrationConflict(conflictId);
      await load();
    } catch {
      // Acquitter est un geste de confort : son échec ne mérite pas d'interrompre la lecture.
    }
  }

  if (loading) {
    return <ActivityIndicator style={styles.center} size="large" color={THEME.colors.accent} />;
  }

  if (!store) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyText}>
          Créez d'abord votre commerce : les logiciels se branchent sur une boutique.
        </Text>
      </View>
    );
  }

  const connectors = state?.connectors || [];
  const conflicts = state?.conflictLog || [];
  const pending = state?.conflicts || 0;

  return (
    <ScrollView
      style={styles.bg}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />
      }
    >
      <Text style={styles.intro}>
        Ma Zone peut lire votre catalogue et votre stock depuis le logiciel que vous utilisez
        déjà. Vous n'êtes jamais obligé d'en avoir un.
      </Text>

      {connectors.map((connector) => (
        <ConnectorCard
          key={connector.id}
          connector={connector}
          busy={busy === connector.id}
          valueOf={valueOf}
          setValue={setValue}
          onConnect={() => connect(connector)}
          onDisconnect={() => disconnect(connector)}
        />
      ))}

      {/* ── Le chemin du tableur : toujours là, jamais en second choix ── */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Coller un catalogue</Text>
        <Text style={styles.cardHint}>
          Une ligne par article, colonnes séparées par des points-virgules :
          référence, nom, prix, quantité.
        </Text>
        <TextInput
          style={styles.textarea}
          value={document}
          onChangeText={(text) => { setDocument(text); setInspection(null); }}
          placeholder={'reference;nom;prix;quantite\nCAFE-001;Café en grains;18,90;12'}
          placeholderTextColor={THEME.colors.textMuted}
          multiline
          autoCapitalize="none"
          autoCorrect={false}
        />

        {inspection ? (
          <Text style={inspection.usable ? styles.ok : styles.warn}>
            {inspection.usable
              ? `${inspection.lineCount} ligne(s) comprise(s).`
              : `Ce fichier ne peut pas être importé : ${inspection.reason || 'colonnes manquantes'}.`}
          </Text>
        ) : null}

        <View style={styles.row}>
          {/* Vérifier AVANT d'importer : un import qui part sans retour en arrière est un
              import qu'on n'ose pas essayer. */}
          <TouchableOpacity
            style={[styles.secondary, !document && styles.disabled]}
            disabled={!document || busy === 'inspect'}
            onPress={inspect}
          >
            <Text style={styles.secondaryLabel}>Vérifier</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.primary, (!inspection?.usable || busy === 'import') && styles.disabled]}
            disabled={!inspection?.usable || busy === 'import'}
            onPress={runImport}
          >
            <Text style={styles.primaryLabel}>Importer</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Ce que Ma Zone a refusé, et pourquoi ── */}
      {conflicts.length ? (
        <View style={styles.card}>
          <View style={styles.cardHead}>
            <Text style={styles.cardTitle}>Ce que Ma Zone a refusé</Text>
            {pending ? <Text style={styles.badge}>{pending}</Text> : null}
          </View>
          {conflicts.slice(0, 10).map((conflict) => (
            <TouchableOpacity
              key={conflict.id}
              style={styles.conflict}
              onPress={() => acknowledge(conflict.id)}
            >
              <Text style={styles.conflictText}>{conflict.payload_summary || conflict.reason}</Text>
              <Text style={styles.conflictMeta}>
                {conflict.attribute}
                {conflict.acknowledged_at ? ' · vu' : ' · appuyez pour marquer comme vu'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      {connectors.some((c) => c.installed) ? (
        <TouchableOpacity
          style={[styles.secondary, styles.wide, busy === 'reconcile' && styles.disabled]}
          disabled={busy === 'reconcile'}
          onPress={reconcile}
        >
          <Text style={styles.secondaryLabel}>
            {busy === 'reconcile' ? 'Vérification…' : 'Vérifier mon stock maintenant'}
          </Text>
        </TouchableOpacity>
      ) : null}
    </ScrollView>
  );
}

/**
 * Une tuile par logiciel, dessinée d'après sa description.
 *
 * Toute la variété des éditeurs tient dans `form` : le mode de connexion et les champs à
 * demander. Aucun `if (connector.id === …)` n'apparaît ici, et c'est la condition pour que
 * cet écran ne grossisse pas d'un logiciel à l'autre.
 */
function ConnectorCard({ connector, busy, valueOf, setValue, onConnect, onDisconnect }) {
  const { form } = connector;
  const indisponible = !form.vaultReady || !form.callbackReady;

  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <Text style={styles.cardTitle}>{connector.label}</Text>
        {connector.installed ? (
          <Text style={connector.status === 'active' ? styles.tagOn : styles.tagOff}>
            {connector.status === 'active' ? 'branché' : 'en pause'}
          </Text>
        ) : null}
      </View>

      <Text style={styles.cardHint}>{describe(connector)}</Text>

      {connector.installed ? (
        <>
          {connector.reads?.length ? (
            <Text style={styles.meta}>
              Dernière lecture : {connector.reads
                .map((read) => `${read.resource} ${humanDate(read.last_pulled_at)}`)
                .join(' · ')}
            </Text>
          ) : null}
          <TouchableOpacity
            style={[styles.danger, busy && styles.disabled]}
            disabled={busy}
            onPress={onDisconnect}
          >
            <Text style={styles.dangerLabel}>Débrancher</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          {form.fields.map((field) => (
            <TextInput
              key={field.name}
              style={styles.input}
              value={valueOf(connector.id, field.name)}
              onChangeText={(text) => setValue(connector.id, field.name, text)}
              placeholder={field.placeholder || field.label}
              placeholderTextColor={THEME.colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              // Un identifiant collé depuis un back-office ne doit pas s'afficher en clair
              // au-dessus de l'épaule de quelqu'un.
              secureTextEntry={form.mode === MODE.CREDENTIALS}
            />
          ))}

          {form.scopes?.length ? (
            <Text style={styles.meta}>
              Ma Zone demandera : {form.scopes.join(', ')}
            </Text>
          ) : null}

          {indisponible ? (
            // Ne PAS proposer un bouton qui échouera. Un commerçant qui appuie et reçoit une
            // erreur technique conclut que Ma Zone est cassée, ce qui n'est pas faux : il
            // manque une configuration de l'instance, et ce n'est pas à lui de la deviner.
            <Text style={styles.warn}>
              Cette connexion n'est pas encore disponible sur cette installation de Ma Zone.
            </Text>
          ) : (
            <TouchableOpacity
              style={[styles.primary, busy && styles.disabled]}
              disabled={busy}
              onPress={onConnect}
            >
              <Text style={styles.primaryLabel}>{busy ? 'Connexion…' : 'Connecter'}</Text>
            </TouchableOpacity>
          )}
        </>
      )}
    </View>
  );
}

/** Ce que ce logiciel sait faire, dit à un commerçant et pas à un développeur. */
function describe(connector) {
  const phrases = {
    pull_catalog: 'lire vos articles',
    pull_inventory: 'lire votre stock',
    push_sales: 'recevoir vos ventes Ma Zone',
    push_inventory: 'recevoir vos mouvements de stock',
    webhooks: 'vous prévenir en temps réel',
  };
  const said = (connector.capabilities || []).map((c) => phrases[c]).filter(Boolean);
  if (!said.length) return 'Aucune synchronisation automatique.';
  return `Ma Zone peut ${said.join(', ')}.`;
}

function humanDate(value) {
  if (!value) return 'jamais';
  const date = new Date(String(value).replace(' ', 'T') + 'Z');
  if (Number.isNaN(date.getTime())) return 'jamais';
  return date.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

/**
 * Message affichable.
 *
 * Le backend écrit ses refus pour un commerçant (« importez d'abord votre catalogue »), et
 * les afficher tels quels vaut mieux que n'importe quelle reformulation générique.
 */
function message(err) {
  return err?.response?.data?.error || 'Une erreur est survenue. Réessayez dans un instant.';
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: THEME.colors.bg },
  content: { padding: 16, paddingBottom: 40, gap: 12 },
  center: { flex: 1 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: THEME.colors.bg },
  emptyText: { ...THEME.typography.body, color: THEME.colors.textSecondary, textAlign: 'center' },
  intro: { ...THEME.typography.body, color: THEME.colors.textSecondary, marginBottom: 4 },

  card: {
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    padding: 16,
    gap: 10,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { ...THEME.typography.subtitle, color: THEME.colors.text, flex: 1 },
  cardHint: { ...THEME.typography.caption, color: THEME.colors.textSecondary, lineHeight: 19 },
  meta: { ...THEME.typography.caption, color: THEME.colors.textMuted },

  tagOn: {
    ...THEME.typography.micro, color: THEME.colors.success, backgroundColor: THEME.colors.successSoft,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: THEME.radius.full, overflow: 'hidden',
  },
  tagOff: {
    ...THEME.typography.micro, color: THEME.colors.warning, backgroundColor: THEME.colors.warningSoft,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: THEME.radius.full, overflow: 'hidden',
  },
  badge: {
    ...THEME.typography.micro, color: THEME.colors.card, backgroundColor: THEME.colors.warning,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: THEME.radius.full, overflow: 'hidden',
  },

  input: {
    borderWidth: 1, borderColor: THEME.colors.border, borderRadius: THEME.radius.sm,
    paddingHorizontal: 12, paddingVertical: 10, color: THEME.colors.text,
    backgroundColor: THEME.colors.bg,
  },
  textarea: {
    borderWidth: 1, borderColor: THEME.colors.border, borderRadius: THEME.radius.sm,
    padding: 12, minHeight: 110, color: THEME.colors.text, backgroundColor: THEME.colors.bg,
    textAlignVertical: 'top', fontSize: 13,
  },

  row: { flexDirection: 'row', gap: 10 },
  primary: {
    flex: 1, backgroundColor: THEME.colors.accent, borderRadius: THEME.radius.sm,
    paddingVertical: 12, alignItems: 'center',
  },
  primaryLabel: { ...THEME.typography.subtitle, color: '#FFFFFF' },
  secondary: {
    flex: 1, backgroundColor: THEME.colors.accentSoft, borderRadius: THEME.radius.sm,
    paddingVertical: 12, alignItems: 'center',
  },
  secondaryLabel: { ...THEME.typography.subtitle, color: THEME.colors.accent },
  wide: { flex: 0 },
  danger: {
    backgroundColor: THEME.colors.errorSoft, borderRadius: THEME.radius.sm,
    paddingVertical: 12, alignItems: 'center',
  },
  dangerLabel: { ...THEME.typography.subtitle, color: THEME.colors.error },
  disabled: { opacity: 0.45 },

  ok: { ...THEME.typography.caption, color: THEME.colors.success },
  warn: { ...THEME.typography.caption, color: THEME.colors.warning, lineHeight: 19 },

  conflict: {
    borderTopWidth: 1, borderTopColor: THEME.colors.borderLight, paddingTop: 10, gap: 3,
  },
  conflictText: { ...THEME.typography.caption, color: THEME.colors.text, lineHeight: 19 },
  conflictMeta: { ...THEME.typography.micro, color: THEME.colors.textMuted },
});
