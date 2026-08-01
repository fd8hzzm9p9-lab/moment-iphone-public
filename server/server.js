require('dotenv').config({
  path: __dirname + '/.env',
});

const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');

const app = express();

app.use(cors());
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/* ========================================================= */
/* ACCUEIL                                                   */
/* ========================================================= */

app.get('/', (req, res) => {
  res.json({
    message: 'Le cerveau de Moment fonctionne !',
  });
});

/* ========================================================= */
/* COMPRÉHENSION                                             */
/* ========================================================= */

app.post('/understand', async (req, res) => {
  console.log('📥 Requête reçue');

  try {
    const { text } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({
        error: 'Aucun texte reçu',
      });
    }

    console.log('🧠 Analyse de la saisie...');

    const response = await openai.responses.create({
      model: 'gpt-5-mini',

      input: `
Tu es le moteur de mémoire de l'application Moment.

Moment construit progressivement une mémoire personnelle à partir
de ce que l'utilisateur raconte naturellement.

Une saisie peut contenir UN ou PLUSIEURS événements.

Tu dois découper la saisie en événements distincts lorsque
plusieurs événements différents sont racontés.

============================================================
RÈGLE ABSOLUE SUR LES RELATIONS
============================================================

Ne crée une relation entre deux éléments QUE si cette relation
est explicitement exprimée ou clairement établie par le texte.

Ne crée JAMAIS une relation simplement parce que :

- deux éléments apparaissent dans la même saisie ;
- ils se produisent le même jour ;
- ils se produisent au même endroit ;
- ils sont proches dans le texte ;
- ils semblent logiquement liés.

La mémoire enregistrée doit rester factuelle.

============================================================
OBJECTIF
============================================================

N'INVENTE RIEN.

Ne transforme jamais :

- une proximité temporelle en relation ;
- une proximité géographique en relation ;
- une cooccurrence en relation ;
- une supposition en fait ;
- une intention en action réalisée.

Retourne UNIQUEMENT un objet JSON valide.
Aucun markdown.
Aucune explication.

============================================================
STRUCTURE
============================================================

{
  "input": "",
  "events": []
}

Chaque événement doit avoir exactement :

{
  "id": "",
  "type": "",
  "description": "",
  "date_reference": "",
  "date_precision": "",
  "context": "",
  "people": [],
  "places": [],
  "objects": [],
  "subjects": [],
  "thoughts": [],
  "actions": [],
  "intentions": [],
  "facts": [],
  "relations": [],
  "created_at": "",
  "source_text": "",
  "confidence": 0
}

============================================================
RÈGLES DES CHAMPS
============================================================

id :

"event_1", "event_2", "event_3", etc.

type :

"event"
"thought"
"idea"
"action"
"intention"
"fact"
"feeling"
"mixed"

description :

Résumé très court et fidèle.

date_reference :

Référence temporelle réellement présente.

date_precision :

"exact"
"day"
"approximate"
"relative"
"unknown"

context :

Lieu ou contexte explicitement présent.

people :

Personnes explicitement mentionnées.

places :

Lieux explicitement mentionnés.

objects :

Objets explicitement mentionnés.

subjects :

Sujets explicitement mentionnés.

thoughts :

Pensées réellement exprimées.

actions :

Actions réellement effectuées ou en cours.

intentions :

Actions envisagées mais pas encore réalisées.

facts :

Informations présentées comme des faits.

relations :

Uniquement les relations explicitement présentes.

Chaque relation doit avoir exactement :

{
  "from": "",
  "relation": "",
  "to": "",
  "evidence": ""
}

evidence :

"explicit"

ou

"implied"

Ne crée normalement PAS de relation "implied" lors de
l'enregistrement.

Les relations implicites seront calculées plus tard
par le moteur de rappel.

created_at :

Laisse ce champ vide.
Moment le remplira automatiquement.

source_text :

Partie exacte du texte utilisateur correspondant
à l'événement.

confidence :

Nombre entre 0 et 1.

============================================================
TEXTE UTILISATEUR
============================================================

${text.trim()}
`,
    });

    let result;

    try {
      result = JSON.parse(response.output_text);
    } catch (parseError) {
      console.error(
        '❌ Réponse JSON invalide :',
        response.output_text
      );

      return res.status(500).json({
        error:
          'Le cerveau de Moment a produit une réponse invalide',
      });
    }

    if (!Array.isArray(result.events)) {
      result.events = [];
    }

    result.events.forEach((event) => {
      event.created_at = new Date().toISOString();
    });

    console.log(
      `🧠 ${result.events.length} événement(s) compris`
    );

    console.log(
      JSON.stringify(result, null, 2)
    );

    res.json(result);

  } catch (error) {
    console.error(
      '❌ Erreur OpenAI :',
      error
    );

    res.status(500).json({
      error:
        'Erreur lors de la compréhension de la mémoire',
    });
  }
});

/* ========================================================= */
/* RAPPEL                                                     */
/* ========================================================= */

app.post('/recall', async (req, res) => {
  console.log('🔎 Question reçue');

  try {
    const {
      question,
      memories,
    } = req.body;

    if (
      !question ||
      !Array.isArray(memories)
    ) {
      return res.status(400).json({
        error:
          'Question ou mémoire absente',
      });
    }

    console.log(
      `🧠 Recherche dans ${memories.length} événement(s)...`
    );

    /* ===================================================== */
    /* VALIDATIONS UTILISATEUR                               */
    /* ===================================================== */

    const validatedClaims = [];

    memories.forEach((memory) => {
      if (
        !memory ||
        !Array.isArray(
          memory.validated_claims
        )
      ) {
        return;
      }

      memory.validated_claims.forEach(
        (validatedClaim) => {
          if (
            validatedClaim &&
            typeof validatedClaim.claim ===
              'string' &&
            validatedClaim.claim.trim()
              .length > 0
          ) {
            validatedClaims.push({
              event_id: memory.id,
              claim:
                validatedClaim.claim.trim(),
              validated_at:
                validatedClaim.validated_at ||
                '',
            });
          }
        }
      );
    });

    /* ===================================================== */
    /* COMPATIBILITÉ ANCIEN SYSTÈME                          */
    /* ===================================================== */

    const legacyValidatedMemories =
      memories.filter(
        (memory) =>
          memory &&
          memory.validated_by_user === true
      );

    console.log(
      `✅ ${validatedClaims.length} déduction(s) explicitement validée(s)`
    );

    console.log(
      `✅ ${legacyValidatedMemories.length} ancienne(s) validation(s) utilisateur détectée(s)`
    );

    if (
      validatedClaims.length > 0
    ) {
      console.log(
        '📌 Déductions validées :',
        validatedClaims
      );
    }

    /* ===================================================== */
    /* MÉMOIRE ENRICHIE POUR LE MODÈLE                      */
    /* ===================================================== */

    const validatedClaimsForModel =
      validatedClaims.map(
        (item) => ({
          event_id:
            item.event_id,
          claim:
            item.claim,
          validated_at:
            item.validated_at,
          status:
            'explicitly_validated_by_user',
        })
      );

    /* ===================================================== */
    /* APPEL OPENAI                                          */
    /* ===================================================== */

    const response =
      await openai.responses.create({
        model: 'gpt-5-mini',

        input: `
Tu es le moteur de rappel de Moment.

Moment possède une mémoire personnelle composée
d'événements indépendants.

L'utilisateur pose une question concernant sa propre mémoire.

Ta mission est de retrouver les événements pertinents
et de répondre naturellement.

============================================================
NIVEAUX DE CERTITUDE
============================================================

Tu dois distinguer STRICTEMENT :

1. EXPLICITE
2. IMPLIQUÉ
3. NON CONFIRMÉ
4. INCONNU

============================================================
1. EXPLICITE
============================================================

L'information est directement présente dans un événement.

============================================================
2. IMPLIQUÉ
============================================================

L'information n'est pas directement écrite mais découle
logiquement de plusieurs informations explicites.

Les événements sources restent EXPLICITES.

La conclusion construite est IMPLIQUÉE.

============================================================
3. NON CONFIRMÉ
============================================================

La mémoire contient une information proche mais ne permet
pas de confirmer le fait demandé.

============================================================
4. INCONNU
============================================================

La mémoire ne contient aucune information pertinente.

============================================================
RÈGLE ABSOLUE : DÉDUCTIONS VALIDÉES
============================================================

Certains claims ont été explicitement validés
par l'utilisateur.

Ils sont fournis séparément dans :

ÉLÉMENTS EXPLICITEMENT VALIDÉS PAR L'UTILISATEUR

Lorsqu'un claim apparaît dans cette liste :

→ le CLAIM lui-même est EXPLICITEMENT CONFIRMÉ.

Dans evidence :

→ status DOIT être "explicit".

IMPORTANT :

La validation porte uniquement sur le claim précis.

Elle ne valide pas automatiquement tout le contenu
de l'événement source.

Elle ne modifie pas l'événement source.

============================================================
RÈGLE DES DÉDUCTIONS
============================================================

Lorsqu'une conclusion est construite à partir de plusieurs
événements :

- les événements sources restent "explicit" ;
- la conclusion construite est "implied".

Une evidence "implied" DOIT avoir :

"event_id": ""

Elle doit représenter la conclusion déduite.

Elle ne doit pas recopier simplement une source.

============================================================
RÈGLE DES SOURCES
============================================================

Les événements utilisés comme sources doivent apparaître
séparément dans evidence avec status "explicit".

Pour une conclusion impliquée, event_id doit être vide.

============================================================
RÈGLE DES ACTIONS PHYSIQUES
============================================================

Les formulations suivantes impliquent généralement
la présence physique :

"j'ai mangé avec Marc"
"j'ai dîné avec Marc"
"j'ai déjeuné avec Marc"
"j'ai bu un verre avec Marc"
"j'ai travaillé avec Marc"
"j'ai fait une activité avec Marc"
"j'ai rejoint Marc"
"j'ai retrouvé Marc"

Cette conclusion reste "implied".

============================================================
RÈGLE DU TÉLÉPHONE
============================================================

Si l'événement contient :

"au téléphone"
"par téléphone"
"appelé"
"appel téléphonique"

alors :

- conversation confirmée ;
- présence physique non confirmée ;
- personne vue non confirmée.

============================================================
RÈGLE DES LIEUX
============================================================

"Je suis allé chez Marc."

ne confirme PAS que Marc était présent.

ne confirme PAS que l'utilisateur a vu Marc.

"J'ai rejoint Marc chez lui."

implique que Marc était présent.

Cette conclusion est "implied".

============================================================
RÈGLE DU TEMPS
============================================================

Respecte exactement la précision temporelle.

============================================================
RÈGLE DES MISES À JOUR
============================================================

La mémoire conserve toujours l'historique.

Ne supprime jamais un événement ancien.

Si un événement plus récent apporte une correction,
une évolution ou une précision explicite concernant
la même situation, utilise l'information la plus récente
comme état final.

Mais un événement plus récent ne remplace jamais
automatiquement un ancien événement.

============================================================
QUESTION
============================================================

${question}

============================================================
ÉVÉNEMENTS DISPONIBLES
============================================================

${JSON.stringify(
  memories,
  null,
  2
)}

============================================================
ÉLÉMENTS EXPLICITEMENT VALIDÉS PAR L'UTILISATEUR
============================================================

${JSON.stringify(
  validatedClaimsForModel,
  null,
  2
)}

============================================================
ANCIENNES VALIDATIONS
============================================================

${JSON.stringify(
  legacyValidatedMemories,
  null,
  2
)}

============================================================
INSTRUCTIONS FINALES
============================================================

Utilise les claims explicitement validés comme des faits
confirmés par l'utilisateur.

Si un claim validé permet directement de répondre :

→ evidence "explicit".

Si la réponse est directement présente dans un événement :

→ evidence "explicit".

Si la réponse nécessite de combiner plusieurs événements :

→ les sources sont "explicit"
→ la conclusion est "implied".

Ne transforme jamais une déduction en fait simplement
parce qu'elle paraît logique.

Elle devient explicitement confirmée uniquement si :

1. elle est directement présente dans un événement ;
OU
2. elle apparaît dans les claims explicitement validés.

============================================================
FORMAT DE RÉPONSE
============================================================

Retourne UNIQUEMENT un objet JSON valide.

{
  "answer": "",
  "event_ids": [],
  "confidence": 0,
  "evidence": []
}

Chaque evidence doit avoir :

{
  "event_id": "",
  "status": "",
  "claim": ""
}

status :

"explicit"
"implied"
"not_confirmed"

Pour "explicit" :

event_id DOIT correspondre à un événement existant.

Pour "implied" :

event_id DOIT être une chaîne vide.

Pour "not_confirmed" :

event_id peut être un identifiant existant
ou une chaîne vide.

============================================================
RÈGLE FINALE
============================================================

1. Claim validé par l'utilisateur → explicit.

2. Information directement présente → explicit.

3. Conclusion nécessitant plusieurs événements → implied.

4. Evidence implied → event_id vide.

5. Ne fabrique jamais d'information.

6. Ne crée jamais de nouveau souvenir.

7. Une validation porte uniquement sur le claim précis.

8. La validation ne modifie jamais l'événement source.

9. Respecte les dates.

10. Conserve les événements distincts.
`,
      });

    let result;

    try {
      result = JSON.parse(
        response.output_text
      );
    } catch (parseError) {
      console.error(
        '❌ Réponse de rappel invalide :',
        response.output_text
      );

      return res.status(500).json({
        error:
          'Réponse de rappel invalide',
      });
    }

    /* ===================================================== */
    /* NORMALISATION                                         */
    /* ===================================================== */

    if (
      typeof result.answer !== 'string'
    ) {
      result.answer =
        "Je n'ai pas suffisamment d'informations dans ma mémoire.";
    }

    if (
      !Array.isArray(result.event_ids)
    ) {
      result.event_ids = [];
    }

    if (
      !Array.isArray(result.evidence)
    ) {
      result.evidence = [];
    }

    if (
      typeof result.confidence !==
      'number'
    ) {
      result.confidence = 0;
    }

    /* ===================================================== */
    /* IDS VALIDES                                           */
    /* ===================================================== */

    const validEventIds =
      new Set(
        memories
          .map(
            (memory) =>
              memory?.id
          )
          .filter(Boolean)
      );

    result.event_ids =
      result.event_ids.filter(
        (id) =>
          validEventIds.has(id)
      );

    /* ===================================================== */
    /* NETTOYAGE EVIDENCES                                  */
    /* ===================================================== */

    result.evidence =
      result.evidence.filter(
        (item) =>
          item &&
          typeof item.event_id ===
            'string' &&
          typeof item.claim ===
            'string' &&
          [
            'explicit',
            'implied',
            'not_confirmed',
          ].includes(
            item.status
          )
      );

    /* ===================================================== */
    /* CORRECTION DES DÉDUCTIONS                            */
    /* ===================================================== */

    result.evidence =
      result.evidence.map(
        (item) => {
          if (
            item.status ===
            'implied'
          ) {
            return {
              ...item,
              event_id: '',
              validated: false,
            };
          }

          return {
            ...item,
            validated: false,
          };
        }
      );

    /* ===================================================== */
    /* IDS DES EVIDENCES                                    */
    /* ===================================================== */

    result.evidence =
      result.evidence.filter(
        (item) => {
          if (
            item.status ===
            'implied'
          ) {
            return true;
          }

          return (
            item.event_id === '' ||
            validEventIds.has(
              item.event_id
            )
          );
        }
      );

    /* ===================================================== */
    /* SÉCURITÉ DES CLAIMS VALIDÉS                          */
    /* ===================================================== */

    const validatedClaimsByEvent =
      new Map();

    validatedClaims.forEach(
      (item) => {
        if (
          !validatedClaimsByEvent.has(
            item.event_id
          )
        ) {
          validatedClaimsByEvent.set(
            item.event_id,
            []
          );
        }

        validatedClaimsByEvent
          .get(item.event_id)
          .push(item.claim);
      }
    );

    /*
     * Pour chaque evidence, on vérifie maintenant
     * si son claim correspond exactement à un claim
     * déjà validé par l'utilisateur.
     *
     * Si oui :
     *
     * validated = true
     *
     * et status = explicit.
     *
     * Cela permet à l'application de savoir qu'il ne
     * s'agit PAS d'une nouvelle déduction à valider.
     */

    result.evidence =
      result.evidence.map(
        (item) => {

          /*
           * Une conclusion implied non validée
           * reste une déduction.
           */
          if (
            item.status ===
            'implied'
          ) {
            return {
              ...item,
              validated: false,
            };
          }

          /*
           * Aucun claim validé pour cet événement.
           */
          if (
            !validatedClaimsByEvent.has(
              item.event_id
            )
          ) {
            return {
              ...item,
              validated: false,
            };
          }

          const claims =
            validatedClaimsByEvent.get(
              item.event_id
            );

          /*
           * Recherche d'une correspondance exacte.
           */
          const matchingClaim =
            claims.find(
              (claim) =>
                claim ===
                item.claim
            );

          if (
            matchingClaim
          ) {
            return {
              ...item,
              status:
                'explicit',
              claim:
                matchingClaim,
              validated: true,
            };
          }

          /*
           * L'événement contient bien un claim validé,
           * mais le claim utilisé par GPT est différent.
           *
           * On ne considère donc PAS automatiquement
           * cette evidence comme validée.
           */
          return {
            ...item,
            validated: false,
          };
        }
      );

    /* ===================================================== */
    /* COHÉRENCE DES EVENT IDS                              */
    /* ===================================================== */

    const evidenceIds =
      result.evidence
        .map(
          (item) =>
            item.event_id
        )
        .filter(Boolean);

    result.event_ids = [
      ...new Set([
        ...result.event_ids,
        ...evidenceIds,
      ]),
    ].filter(
      (id) =>
        validEventIds.has(id)
    );

    /* ===================================================== */
    /* LOGS                                                  */
    /* ===================================================== */

    console.log(
      '💡 Réponse :',
      result.answer
    );

    console.log(
      '📚 Événements utilisés :',
      result.event_ids
    );

    console.log(
      '🔎 Evidence :',
      JSON.stringify(
        result.evidence,
        null,
        2
      )
    );

    const impliedCount =
      result.evidence.filter(
        (item) =>
          item.status ===
          'implied'
      ).length;

    const explicitCount =
      result.evidence.filter(
        (item) =>
          item.status ===
          'explicit'
      ).length;

    const validatedCount =
      result.evidence.filter(
        (item) =>
          item.validated === true
      ).length;

    const notConfirmedCount =
      result.evidence.filter(
        (item) =>
          item.status ===
          'not_confirmed'
      ).length;

    console.log(
      `🧠 Informations explicites : ${explicitCount}`
    );

    console.log(
      `🧠 Déductions détectées : ${impliedCount}`
    );

    console.log(
      `✅ Déductions déjà validées : ${validatedCount}`
    );

    console.log(
      `🧠 Informations non confirmées : ${notConfirmedCount}`
    );

    res.json(result);

  } catch (error) {
    console.error(
      '❌ Erreur de rappel :',
      error
    );

    res.status(500).json({
      error:
        'Erreur lors du rappel de la mémoire',
    });
  }
});

/* ========================================================= */
/* SERVEUR                                                    */
/* ========================================================= */

const PORT =
  process.env.PORT || 3000;

app.listen(
  PORT,
  '0.0.0.0',
  () => {
    console.log(
      `🧠 Serveur Moment lancé sur le port ${PORT}`
    );
  }
);