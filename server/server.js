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

La conclusion est logique mais n'est pas écrite explicitement.

Elle est donc :

"implied"

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
le contenu factuel de cet événement.

Une validation utilisateur est TOUJOURS prioritaire.

Si un événement contient :

validated_by_user: true

alors son contenu factuel est EXPLICITE.

Il doit être considéré comme confirmé.

evidence.status DOIT être "explicit".

Il ne doit JAMAIS être classé "implied".

Il ne doit JAMAIS être classé "not_confirmed".

source_text peut contenir l'historique de la déduction
ayant conduit à la validation.

source_text ne doit JAMAIS annuler la validation.

description et facts représentent la formulation confirmée.

============================================================
RÈGLE IMPORTANTE SUR LES QUESTIONS
============================================================

Une validation utilisateur ne signifie PAS que toutes les
questions contenant les mêmes mots doivent être automatiquement
considérées comme une confirmation.

Exemple de validation :

"Chloe est la fille dont Mireille et Élise sont les marraines."

Question :

"Est-ce que Chloe est la fille dont Mireille et Élise
sont les marraines ?"

→ EXPLICITE.

Mais :

"Qui sont les marraines de Chloe ?"

→ Il faut répondre à la question en recherchant l'information
dans la mémoire.

La validation peut servir de preuve pour construire la réponse,
mais il ne faut pas remplacer la question par le texte de
la question elle-même.

Autre exemple :

"Chloe est-elle la fille de Mireille ?"

→ La validation concernant les marraines ne permet PAS
de conclure que Mireille est la mère de Chloe.

Ne déduis jamais une relation différente de celle qui a
été validée.

============================================================
RÈGLE DES DÉDUCTIONS
============================================================

Si tu construis une conclusion qui n'est pas directement
présente dans un événement :

evidence DOIT contenir au moins une entrée :

"status": "implied"

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
ÉVÉNEMENTS VALIDÉS PAR L'UTILISATEUR
============================================================

${JSON.stringify(
  validatedMemories,
  null,
  2
)}

============================================================
INSTRUCTIONS FINALES
============================================================

Utilise les événements validés comme des faits confirmés.

Mais réponds TOUJOURS à la question réellement posée.

Ne remplace jamais une question par le texte de la question.

Si la question demande :

"Qui sont les marraines de Chloe ?"

et qu'un événement validé indique :

"Chloe est la fille dont Mireille et Élise sont les marraines."

alors réponds naturellement :

"Les marraines de Chloe sont Mireille et Élise."

avec une evidence explicit correspondant à l'événement validé.

Si la question demande :

"Chloe est-elle la fille dont Mireille et Élise
sont les marraines ?"

alors réponds :

"Oui. Tu as confirmé que Chloe est la fille dont
Mireille et Élise sont les marraines."

avec une evidence explicit.

Si la question demande une information différente
qui ne découle pas de la validation, ne l'invente pas.

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

8. Réponds toujours à la question réellement posée.

9. Ne considère jamais le simple partage de mots entre
   une question et un souvenir comme une preuve suffisante
   pour reformuler automatiquement la question.

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
    /* CORRECTION DES RÉPONSES DE VALIDATION                */
    /* ===================================================== */

    /*
     * IMPORTANT :
     *
     * Nous ne remplaçons PLUS automatiquement la réponse
     * de GPT simplement parce qu'un événement validé partage
     * plusieurs mots avec la question.
     *
     * Cela évite le bug :
     *
     * Question :
     * "Qui sont les marraines de Chloe ?"
     *
     * Réponse incorrecte :
     * "Oui. Tu as confirmé que Qui sont les marraines de Chloe."
     *
     * GPT reste responsable de répondre à la question.
     *
     * Le serveur intervient uniquement pour garantir qu'une
     * preuve provenant d'un événement validé reste explicit.
     */

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
