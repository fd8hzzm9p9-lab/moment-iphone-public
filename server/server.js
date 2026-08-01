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
/* OUTILS                                                    */
/* ========================================================= */

function normalizeText(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function questionToConfirmedClaim(question) {
  let claim = String(question || '').trim();

  claim = claim
    .replace(/[?？]\s*$/, '')
    .trim();

  const prefixes = [
    /^est-ce que\s+/i,
    /^est ce que\s+/i,
    /^est-ce qu['’]\s*/i,
    /^est ce qu['’]\s*/i,
  ];

  for (const prefix of prefixes) {
    if (prefix.test(claim)) {
      claim = claim.replace(prefix, '');
      break;
    }
  }

  if (!claim) {
    return '';
  }

  return claim.charAt(0).toUpperCase() + claim.slice(1);
}

function getValidatedClaim(memory, question) {
  /*
   * Une validation utilisateur représente désormais une
   * confirmation factuelle.
   *
   * On ne reprend PAS aveuglément description/facts,
   * car ceux-ci peuvent contenir une formulation ancienne
   * comme :
   *
   * "Chloe pourrait être..."
   *
   * Si la validation répond directement à la question,
   * la question devient la formulation canonique du fait.
   */

  const questionClaim =
    questionToConfirmedClaim(question);

  if (questionClaim) {
    return questionClaim;
  }

  if (
    Array.isArray(memory.facts) &&
    memory.facts.length > 0
  ) {
    return memory.facts.join(' ');
  }

  return memory.description || '';
}

function isValidatedMemoryRelevant(
  memory,
  normalizedQuestion
) {
  const memoryText = normalizeText(
    [
      memory.description,
      ...(Array.isArray(memory.facts)
        ? memory.facts
        : []),
      ...(Array.isArray(memory.people)
        ? memory.people
        : []),
      ...(Array.isArray(memory.places)
        ? memory.places
        : []),
      ...(Array.isArray(memory.subjects)
        ? memory.subjects
        : []),
      ...(Array.isArray(memory.objects)
        ? memory.objects
        : []),
    ]
      .filter(Boolean)
      .join(' ')
  );

  const stopWords = [
    'est-ce',
    'est',
    'cette',
    'cela',
    'dont',
    'sont',
    'dans',
    'avec',
    'pour',
    'quelle',
    'quelles',
    'quels',
    'quel',
    'comment',
    'les',
    'des',
    'une',
    'un',
    'qui',
    'que',
    'la',
    'le',
    'et',
    'ou',
    'de',
    'du',
    'ma',
    'mon',
    'mes',
    'ta',
    'ton',
    'tes',
    'ses',
    'son',
    'sa',
    'mes',
    'être',
    'sont',
  ];

  const words = normalizedQuestion
    .split(/\s+/)
    .map((word) =>
      word.replace(
        /^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu,
        ''
      )
    )
    .filter(
      (word) =>
        word.length >= 4 &&
        !stopWords.includes(word)
    );

  if (words.length === 0) {
    return false;
  }

  const matchingWords = words.filter(
    (word) =>
      memoryText.includes(word)
  );

  /*
   * Pour les validations, on reste volontairement
   * permissif : si au moins deux éléments significatifs
   * de la question apparaissent dans le souvenir, celui-ci
   * peut être considéré comme candidat.
   *
   * Pour une question très courte, un seul élément suffit.
   */

  const required =
    words.length <= 2
      ? 1
      : Math.min(2, words.length);

  return (
    matchingWords.length >= required
  );
}

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

    const response =
      await openai.responses.create({
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
      result = JSON.parse(
        response.output_text
      );
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
      event.created_at =
        new Date().toISOString();
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

    const validatedMemories =
      memories.filter(
        (memory) =>
          memory &&
          memory.validated_by_user === true
      );

    console.log(
      `✅ ${validatedMemories.length} événement(s) validé(s) par l'utilisateur`
    );

    if (
      validatedMemories.length > 0
    ) {
      console.log(
        '📌 Validations trouvées :',
        validatedMemories.map(
          (memory) => ({
            id: memory.id,
            description:
              memory.description,
            facts:
              memory.facts,
          })
        )
      );
    }

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
logiquement de plusieurs informations.

Une conclusion déduite doit rester "implied".

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
RÈGLE ABSOLUE : VALIDATION UTILISATEUR
============================================================

Certains événements peuvent contenir :

"validated_by_user": true

Cela signifie que l'utilisateur a explicitement confirmé
le contenu factuel correspondant.

Une validation utilisateur est TOUJOURS prioritaire.

Si un événement contient :

validated_by_user: true

alors :

- son contenu est considéré comme confirmé ;
- evidence.status DOIT être "explicit" ;
- il ne doit JAMAIS être classé "implied" ;
- il ne doit JAMAIS être classé "not_confirmed" ;
- aucune formulation comme "pourrait", "probablement",
  "semble", "peut-être" ne doit apparaître dans la réponse
  lorsqu'elle affirme le contenu validé.

IMPORTANT :

Si un événement validé contient une ancienne formulation
prudente ou déductive dans description, facts ou source_text,
cette formulation ne doit PAS annuler la validation.

La validation utilisateur représente la confirmation finale.

============================================================
RÈGLE DES DÉDUCTIONS
============================================================

Si tu construis une conclusion qui n'est pas directement
présente dans un événement NON VALIDÉ :

evidence DOIT contenir :

"status": "implied"

Les preuves utilisées pour construire cette conclusion
restent explicit.

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

La personne peut donc être considérée comme probablement vue.

Mais cette conclusion reste :

"implied"

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

En revanche :

"J'ai rejoint Marc chez lui."

implique que Marc était présent.

Cette conclusion est :

"implied"

============================================================
RÈGLE DU TEMPS
============================================================

Respecte exactement la précision temporelle.

"J'ai vu Paul hier."

ne permet pas de répondre :

"Paul était avec toi hier soir."

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

Il faut une relation logique claire.

created_at sert à déterminer l'ordre chronologique.

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
VALIDATIONS UTILISATEUR
============================================================

${JSON.stringify(
  validatedMemories,
  null,
  2
)}

============================================================
RÈGLE FINALE
============================================================

Avant de répondre :

1. Cherche d'abord les validations utilisateur.

2. Si une validation utilisateur répond directement
   à la question :
   → réponds OUI ou NON selon la validation ;
   → status = "explicit" ;
   → confidence = 1.

3. Ne reprends jamais une formulation prudente présente
   dans source_text pour affaiblir une validation.

4. Une information validée ne doit jamais être décrite
   comme une simple déduction.

5. Les autres déductions restent "implied".

6. Ne fabrique jamais d'information.

7. Ne crée jamais de nouveau souvenir pendant le rappel.

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

answer :

Réponse naturelle à la question.

event_ids :

Identifiants des événements utilisés.

confidence :

Nombre entre 0 et 1.

evidence :

Liste des éléments ayant permis de construire la réponse.

Chaque élément doit avoir exactement :

{
  "event_id": "",
  "status": "",
  "claim": ""
}

status doit être exactement :

"explicit"
"implied"
"not_confirmed"
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

    result.evidence =
      result.evidence.filter(
        (item) =>
          validEventIds.has(
            item.event_id
          )
      );

    /* ===================================================== */
    /* SÉCURITÉ DES VALIDATIONS                              */
    /* ===================================================== */

    const validatedById =
      new Map(
        validatedMemories.map(
          (memory) => [
            memory.id,
            memory,
          ]
        )
      );

    result.evidence =
      result.evidence.map(
        (item) => {
          const validatedMemory =
            validatedById.get(
              item.event_id
            );

          if (
            validatedMemory
          ) {
            /*
             * Une validation reste explicit.
             *
             * Mais on ne reprend pas automatiquement
             * la formulation potentiellement mauvaise
             * de l'ancien souvenir.
             */

            return {
              ...item,
              status:
                'explicit',
            };
          }

          return item;
        }
      );

    /* ===================================================== */
    /* DÉTECTION DIRECTE D'UNE VALIDATION                   */
    /* ===================================================== */

    const normalizedQuestion =
      normalizeText(question);

    const relevantValidatedMemory =
      validatedMemories.find(
        (memory) =>
          isValidatedMemoryRelevant(
            memory,
            normalizedQuestion
          )
      );

    if (
      relevantValidatedMemory
    ) {
      /*
       * ===================================================
       * IMPORTANT
       * ===================================================
       *
       * La validation utilisateur est maintenant
       * considérée comme la confirmation finale.
       *
       * On transforme directement la question en
       * affirmation.
       *
       * Exemple :
       *
       * Question :
       * "Est-ce que Chloe est la fille dont Mireille
       * et Élise sont les marraines ?"
       *
       * devient :
       *
       * "Chloe est la fille dont Mireille et Élise
       * sont les marraines."
       *
       * Cela évite de ressortir :
       *
       * "Chloe pourrait être..."
       */

      const validatedClaim =
        getValidatedClaim(
          relevantValidatedMemory,
          question
        );

      if (validatedClaim) {
        console.log(
          '🔐 Validation utilisateur prioritaire :',
          relevantValidatedMemory.id
        );

        console.log(
          '🔐 Fait confirmé :',
          validatedClaim
        );

        result.answer =
          `Oui. Tu as confirmé que ${validatedClaim}.`;

        result.event_ids = [
          relevantValidatedMemory.id,
        ];

        result.confidence = 1;

        result.evidence = [
          {
            event_id:
              relevantValidatedMemory.id,

            status:
              'explicit',

            claim:
              validatedClaim,
          },
        ];
      }
    }

    /* ===================================================== */
    /* NETTOYAGE FINAL DES FORMULATIONS INVALIDES           */
    /* ===================================================== */

    /*
     * Si un événement validé est utilisé, son evidence
     * doit absolument rester explicit.
     */

    result.evidence =
      result.evidence.map(
        (item) => {
          if (
            validatedById.has(
              item.event_id
            )
          ) {
            const memory =
              validatedById.get(
                item.event_id
              );

            const validatedClaim =
              getValidatedClaim(
                memory,
                question
              );

            return {
              event_id:
                item.event_id,

              status:
                'explicit',

              claim:
                validatedClaim ||
                item.claim,
            };
          }

          return item;
        }
      );

    /*
     * Si une validation est utilisée,
     * la confiance doit être maximale.
     */

    const containsValidatedEvidence =
      result.evidence.some(
        (item) =>
          validatedById.has(
            item.event_id
          )
      );

    if (
      containsValidatedEvidence
    ) {
      const validatedItem =
        result.evidence.find(
          (item) =>
            validatedById.has(
              item.event_id
            )
        );

      if (validatedItem) {
        result.confidence = 1;

        /*
         * Si GPT a malgré tout produit une formulation
         * prudente, on la remplace par la formulation
         * canonique de la validation.
         */

        const memory =
          validatedById.get(
            validatedItem.event_id
          );

        const confirmedClaim =
          getValidatedClaim(
            memory,
            question
          );

        if (confirmedClaim) {
          result.answer =
            `Oui. Tu as confirmé que ${confirmedClaim}.`;

          result.evidence =
            result.evidence.map(
              (item) => {
                if (
                  item.event_id ===
                  validatedItem.event_id
                ) {
                  return {
                    event_id:
                      item.event_id,

                    status:
                      'explicit',

                    claim:
                      confirmedClaim,
                  };
                }

                return item;
              }
            );
        }
      }
    }

    /* ===================================================== */
    /* COHÉRENCE DES EVENT IDS                              */
    /* ===================================================== */

    const evidenceIds =
      result.evidence.map(
        (item) =>
          item.event_id
      );

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