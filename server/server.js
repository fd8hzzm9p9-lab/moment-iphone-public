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
/* OUTILS                                                     */
/* ========================================================= */

function normalizeText(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[“”"']/g, '')
    .trim();
}

/*
 * Nettoie une conclusion implicite afin qu'elle ne contienne
 * pas elle-même le niveau d'incertitude.
 *
 * Le niveau de certitude est porté par :
 *
 * status: "implied"
 *
 * et non par des mots comme :
 *
 * "probablement"
 * "pourrait"
 * "semble"
 * "peut-être"
 */
function cleanInferenceClaim(claim) {
  if (typeof claim !== 'string') {
    return '';
  }

  let cleaned = claim.trim();

  cleaned = cleaned
    .replace(
      /^(probablement|peut[- ]être|peut etre|sans doute|vraisemblablement|il est probable que|il semble que|semble que|on peut penser que)\s*/i,
      ''
    )
    .replace(
      /\s*\((impliqué|implique|déduction|déduit|non confirmé|non confirmee|probable|probablement)[^)]*\)\s*$/i,
      ''
    )
    .trim();

  /*
   * Si le modèle a produit :
   *
   * "Chloe pourrait être la fille..."
   *
   * on transforme la formulation en :
   *
   * "Chloe est la fille..."
   *
   * Le statut "implied" indique déjà que cette conclusion
   * n'est pas explicitement enregistrée.
   */
  cleaned = cleaned.replace(
    /^(.+?)\s+(pourrait|pourrais|pourrait bien)\s+(être|etre)\s+/i,
    '$1 est '
  );

  cleaned = cleaned.replace(
    /^(.+?)\s+(semble être|semble etre)\s+/i,
    '$1 est '
  );

  return cleaned;
}

/* ========================================================= */
/* ACCUEIL                                                     */
/* ========================================================= */

app.get('/', (req, res) => {
  res.json({
    message: 'Le cerveau de Moment fonctionne !',
  });
});

/* ========================================================= */
/* COMPRÉHENSION                                               */
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

    const validatedMemories =
      memories.filter(
        (memory) =>
          memory &&
          memory.validated_by_user === true
      );

    console.log(
      `✅ ${validatedMemories.length} événement(s) validé(s) par l'utilisateur`
    );

    if (validatedMemories.length > 0) {
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

Exemple :

"Chloe est ma fille."

→ Chloe est explicitement la fille de l'utilisateur.

============================================================
2. IMPLIQUÉ
============================================================

L'information n'est pas directement écrite mais découle
logiquement de plusieurs informations.

Exemple :

Événement A :
"Chloe est ma fille."

Événement B :
"Mes deux sœurs sont les marraines de ma fille."

Événement C :
"Mireille est ma sœur."

Événement D :
"Élise est ma sœur."

Question :

"Est-ce que Chloe est la fille dont Mireille et Élise
sont les marraines ?"

La conclusion logique est :

"Chloe est la fille dont Mireille et Élise sont les marraines."

Cette conclusion n'est pas écrite explicitement dans un seul
événement.

Elle est donc :

"implied"

============================================================
RÈGLE TRÈS IMPORTANTE POUR LES CLAIMS IMPLIQUÉS
============================================================

Lorsqu'une conclusion est déduite, le champ "claim" doit
décrire directement la conclusion obtenue.

Il doit être formulé comme une phrase affirmative et claire.

BON :

"Chloe est la fille dont Mireille et Élise sont les marraines."

MAUVAIS :

"Chloe pourrait être la fille dont Mireille et Élise sont les marraines."

MAUVAIS :

"Chloe est probablement la fille dont Mireille et Élise sont les marraines."

MAUVAIS :

"Il semble que Chloe soit la fille dont Mireille et Élise sont les marraines."

MAUVAIS :

"Chloe est la fille dont Mireille et Élise sont les marraines (impliqué mais non confirmé)."

Le mot "implied" dans evidence.status indique déjà
que la conclusion est une déduction.

Le texte de claim ne doit donc PAS contenir :

- probablement ;
- pourrait ;
- peut-être ;
- semble ;
- vraisemblablement ;
- non confirmé ;
- impliqué ;
- déduction ;
- ou toute autre formule indiquant le niveau de certitude.

============================================================
3. NON CONFIRMÉ
============================================================

La mémoire contient une information proche mais ne permet
pas de confirmer le fait demandé.

Dans ce cas, ne fabrique pas une conclusion.

Utilise :

"not_confirmed"

============================================================
4. INCONNU
============================================================

La mémoire ne contient aucune information pertinente.

============================================================
RÈGLE ABSOLUE : VALIDATION UTILISATEUR
============================================================

Certains événements de la mémoire peuvent contenir :

"validated_by_user": true

Cela signifie que l'utilisateur a explicitement confirmé
le contenu factuel de cet événement.

Une telle validation est TOUJOURS prioritaire.

Si un événement contient :

validated_by_user: true

alors :

- son contenu factuel est EXPLICITE ;
- il doit être considéré comme confirmé ;
- evidence.status DOIT être "explicit" ;
- il ne doit JAMAIS être classé "implied" ;
- il ne doit JAMAIS être classé "not_confirmed".

Le champ source_text peut contenir l'historique de la
déduction ayant conduit à la validation.

source_text ne doit JAMAIS annuler la validation.

Le champ description et le champ facts de l'événement
validé représentent la formulation confirmée.

============================================================
RÈGLE DE VALIDATION
============================================================

Lorsqu'une déduction est proposée à l'utilisateur,
la phrase utilisée comme "claim" doit être une conclusion
factuelle propre.

Lorsque l'utilisateur valide cette conclusion, cette même
phrase devient une information explicitement confirmée.

Il ne faut JAMAIS conserver dans le souvenir validé des
mots comme :

- probablement ;
- pourrait ;
- peut-être ;
- semble ;
- non confirmé ;
- impliqué.

============================================================
EXEMPLE DE VALIDATION
============================================================

{
  "id": "validated_123",
  "description": "Chloe est la fille dont Mireille et Élise sont les marraines.",
  "facts": [
    "Chloe est la fille dont Mireille et Élise sont les marraines."
  ],
  "source_text": "Information validée par l'utilisateur : Chloe est la fille dont Mireille et Élise sont les marraines.",
  "validated_by_user": true
}

Question :

"Est-ce que Chloe est la fille dont Mireille et Élise
sont les marraines ?"

Réponse obligatoire :

{
  "answer": "Oui. Tu as confirmé que Chloe est la fille dont Mireille et Élise sont les marraines.",
  "event_ids": ["validated_123"],
  "confidence": 1,
  "evidence": [
    {
      "event_id": "validated_123",
      "status": "explicit",
      "claim": "Chloe est la fille dont Mireille et Élise sont les marraines."
    }
  ]
}

============================================================
RÈGLE DES DÉDUCTIONS
============================================================

Si tu construis une conclusion qui n'est pas directement
présente dans un événement :

evidence DOIT contenir au moins une entrée :

"status": "implied"

Le claim doit être une formulation affirmative de la
conclusion déduite.

Exemple :

{
  "event_id": "event_2",
  "status": "implied",
  "claim": "Chloe est la fille désignée par l'expression 'ta fille'."
}

IMPORTANT :

Une réponse peut contenir à la fois :

- des preuves explicit ;
- et une conclusion implied.

Les preuves sources restent explicit.

La conclusion construite reste implied.

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

Le claim doit néanmoins être formulé sans "probablement".

Exemple :

"Marc était présent lors du repas."

et non :

"Marc était probablement présent lors du repas."

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
RÈGLE DES RELATIONS ENTRE ÉVÉNEMENTS
============================================================

Plusieurs événements peuvent être utilisés ensemble.

Le fait qu'ils parlent :

- de la même personne ;
- du même jour ;
- du même lieu ;
- du même sujet ;

ne signifie pas automatiquement qu'ils décrivent
le même événement.

Une conclusion peut néanmoins être déduite
de plusieurs événements.

Dans ce cas :

- les informations sources restent "explicit" ;
- la conclusion construite est "implied".

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
RAPPEL IMPORTANT SUR LES VALIDATIONS
============================================================

Les événements suivants ont été identifiés par le serveur
comme ayant été explicitement validés par l'utilisateur :

${JSON.stringify(
  validatedMemories,
  null,
  2
)}

Si l'un de ces événements répond directement à la question,
utilise-le comme preuve EXPLICITE.

Ne le transforme jamais en "implied" ou "not_confirmed".

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

Si la réponse repose sur une déduction, tu peux expliquer
naturellement qu'il s'agit d'une déduction, mais ne modifie
PAS le claim de evidence pour y ajouter cette incertitude.

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

============================================================
RÈGLE FINALE
============================================================

Avant de répondre, vérifie :

1. Si l'information vient d'un événement
   validated_by_user: true
   → explicit.

2. Si la conclusion est déduite
   → implied obligatoire.

3. Si la mémoire ne permet pas de confirmer
   → not_confirmed.

4. Ne transforme jamais une déduction en fait
   sauf validation explicite de l'utilisateur.

5. Ne fabrique jamais d'information.

6. Ne crée jamais de nouveau souvenir pendant
   le rappel.

7. Une validation utilisateur est plus forte que
   toute ancienne formulation présente dans source_text.

8. Un claim implied doit être affirmatif et propre.
   Le mot "implied" est porté par le champ status,
   pas par le texte du claim.

Si un événement validé contient exactement l'information
demandée, réponds directement OUI et utilise cet événement
comme evidence explicit.

Si aucun événement ne permet de répondre :

{
  "answer": "Je n'ai pas suffisamment d'informations dans ma mémoire.",
  "event_ids": [],
  "confidence": 0,
  "evidence": []
}
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
    /* NETTOYAGE DES DÉDUCTIONS                             */
    /* ===================================================== */

    /*
     * Si une evidence est "implied", le claim doit rester
     * une conclusion affirmative.
     *
     * On nettoie ici les formulations d'incertitude que GPT
     * pourrait malgré tout produire.
     */

    result.evidence =
      result.evidence.map(
        (item) => {
          if (
            item.status ===
            'implied'
          ) {
            return {
              ...item,
              claim:
                cleanInferenceClaim(
                  item.claim
                ),
            };
          }

          return item;
        }
      );

    /* ===================================================== */
    /* SÉCURITÉ ABSOLUE DES VALIDATIONS                     */
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

    /*
     * Si GPT a utilisé un événement validé,
     * son evidence devient obligatoirement explicit.
     */

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
            const validatedClaim =
              Array.isArray(
                validatedMemory.facts
              ) &&
              validatedMemory.facts.length >
                0
                ? validatedMemory.facts.join(
                    ' '
                  )
                : validatedMemory.description;

            return {
              ...item,
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

    /* ===================================================== */
    /* DÉTECTION DIRECTE D'UNE VALIDATION                   */
    /* ===================================================== */

    const normalizedQuestion =
      normalizeText(question);

    const relevantValidatedMemory =
      validatedMemories.find(
        (memory) => {
          const text = [
            memory.description,
            ...(Array.isArray(
              memory.facts
            )
              ? memory.facts
              : []),
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
            .normalize('NFD')
            .replace(
              /[\u0300-\u036f]/g,
              '');

          const words =
            normalizedQuestion
              .split(/\s+/)
              .filter(
                (word) =>
                  word.length >= 4 &&
                  ![
                    'est-ce',
                    'cette',
                    'dont',
                    'sont',
                    'dans',
                    'avec',
                    'pour',
                    'quelle',
                    'quels',
                    'quel',
                    'comment',
                    'est',
                  ].includes(word)
              );

          const matchingWords =
            words.filter(
              (word) =>
                text.includes(word)
            );

          return (
            matchingWords.length >=
            Math.min(
              3,
              words.length
            )
          );
        }
      );

    if (
      relevantValidatedMemory
    ) {
      const validatedClaim =
        Array.isArray(
          relevantValidatedMemory.facts
        ) &&
        relevantValidatedMemory.facts.length >
          0
          ? relevantValidatedMemory.facts.join(
              ' '
            )
          : relevantValidatedMemory.description;

      if (
        validatedClaim
      ) {
        console.log(
          '🔐 Validation utilisateur prioritaire :',
          relevantValidatedMemory.id
        );

        result.answer =
          `Oui. Tu as confirmé que ${validatedClaim}`;

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