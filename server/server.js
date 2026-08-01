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

    /*
     * Une validation peut désormais être stockée directement
     * dans l'événement source sous la forme :
     *
     * validated_claims: [
     *   {
     *     claim: "...",
     *     validated_at: "..."
     *   }
     * ]
     *
     * IMPORTANT :
     *
     * Cela ne modifie PAS l'événement source.
     *
     * Le claim validé devient un fait explicitement confirmé
     * indépendamment de la formulation originale de l'événement.
     */

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

    /*
     * Ancien système de compatibilité :
     *
     * Certains événements peuvent encore posséder
     * validated_by_user: true.
     *
     * On continue à les reconnaître afin de ne pas casser
     * les anciennes mémoires déjà enregistrées.
     */

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

    /*
     * On transmet à GPT les événements originaux.
     *
     * On ajoute séparément les claims validés afin que le modèle
     * comprenne qu'ils sont confirmés par l'utilisateur.
     *
     * On NE MODIFIE PAS les événements eux-mêmes.
     */

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

Exemple :

"Thierry est le parrain du fils de l'utilisateur."

Cette information est EXPLICITE.

============================================================
2. IMPLIQUÉ
============================================================

L'information n'est pas directement écrite mais découle
logiquement de plusieurs informations explicites.

Exemple :

Événement A :
"Thierry est le parrain de mon fils."

Événement B :
"Léo est mon enfant."

Question :

"Qui est le parrain de Léo ?"

Si les informations permettent de déterminer que Léo
est le fils de l'utilisateur, alors :

"Thierry est le parrain de Léo"

est une conclusion IMPLIQUÉE.

IMPORTANT :

Les événements A et B restent des preuves EXPLICITES.

La conclusion "Thierry est le parrain de Léo"
est une conclusion IMPLIQUÉE.

Ne transforme jamais une preuve source en conclusion.

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
RÈGLE ABSOLUE : DÉDUCTIONS VALIDÉES PAR L'UTILISATEUR
============================================================

Certaines déductions ont été explicitement validées
par l'utilisateur.

Elles sont fournies séparément dans :

ÉLÉMENTS EXPLICITEMENT VALIDÉS PAR L'UTILISATEUR

Un élément validé contient :

{
  "event_id": "...",
  "claim": "...",
  "validated_at": "...",
  "status": "explicitly_validated_by_user"
}

Lorsqu'un claim apparaît dans cette liste :

→ le CLAIM lui-même est EXPLICITEMENT CONFIRMÉ.

Il doit être considéré comme un fait confirmé.

Dans evidence :

→ status DOIT être "explicit".

L'événement source auquel event_id correspond
ne doit PAS être réécrit.

L'événement source ne devient pas automatiquement
une copie du claim.

IMPORTANT :

La validation porte sur le claim précis qui a été validé.

Elle ne signifie PAS que toutes les autres informations
contenues dans l'événement source sont validées.

Elle ne signifie PAS non plus que toutes les questions
contenant des mots similaires sont confirmées.

Réponds toujours à la question réellement posée.

============================================================
RÈGLE IMPORTANTE : CONSERVATION DES ÉVÉNEMENTS SOURCES
============================================================

La validation d'une déduction ne supprime jamais
les événements qui ont servi à la construire.

Elle ne les remplace jamais.

Elle ne modifie jamais leur description,
leur date, leur contexte ou leurs faits.

La mémoire conserve toujours l'historique original.

Un claim validé constitue une information supplémentaire
explicitement confirmée par l'utilisateur.

============================================================
RÈGLE DES DÉDUCTIONS
============================================================

Lorsqu'une conclusion est construite à partir de plusieurs
événements :

- les événements sources restent "explicit" ;
- la conclusion construite est "implied".

IMPORTANT :

Une evidence "implied" DOIT représenter la conclusion
déduite.

Elle ne doit PAS simplement recopier la phrase d'un événement
source.

Une evidence "implied" ne doit JAMAIS utiliser comme
event_id un événement source uniquement parce que cet
événement contient l'une des informations nécessaires.

Pour une conclusion "implied" :

"event_id": ""

Les event_id des sources doivent rester associés
uniquement aux preuves explicites.

============================================================
RÈGLE DES SOURCES ET DES CONCLUSIONS
============================================================

Lorsque tu utilises plusieurs événements pour construire
une conclusion :

Exemple :

Événement 1 :
{
  "id": "A",
  "description": "Thierry est le parrain du fils."
}

Événement 2 :
{
  "id": "B",
  "description": "Léo est mon enfant."
}

Tu peux produire :

{
  "event_id": "A",
  "status": "explicit",
  "claim": "Thierry est le parrain du fils de l'utilisateur."
}

{
  "event_id": "B",
  "status": "explicit",
  "claim": "Léo est l'enfant de l'utilisateur."
}

Puis :

{
  "event_id": "",
  "status": "implied",
  "claim": "Léo est le fils de l'utilisateur et Thierry est donc son parrain."
}

IMPORTANT :

Pour une conclusion "implied", event_id doit être vide.

N'invente JAMAIS un event_id.

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
ÉLÉMENTS EXPLICITEMENT VALIDÉS PAR L'UTILISATEUR
============================================================

${JSON.stringify(
  validatedClaimsForModel,
  null,
  2
)}

============================================================
ANCIENNES VALIDATIONS DE COMPATIBILITÉ
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

Une validation porte uniquement sur le claim validé.

Si un claim validé permet directement de répondre :

→ utilise-le comme information EXPLICITE.

Si la réponse est directement présente dans un événement :

→ evidence "explicit".

Si la réponse nécessite de combiner plusieurs événements :

→ les sources restent "explicit"
→ la conclusion est "implied".

Si la réponse utilise un claim validé :

→ evidence "explicit".

IMPORTANT :

Ne transforme jamais une déduction en fait simplement
parce qu'elle paraît logique.

Elle ne devient explicitement confirmée que si :

1. elle est directement présente dans un événement ;
OU
2. elle apparaît dans les claims explicitement validés
   par l'utilisateur.

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

Identifiants des événements réellement utilisés comme sources.

Pour une conclusion impliquée, ajoute les event_ids des
événements sources utilisés.

Si un claim validé est utilisé, ajoute son event_id.

N'ajoute jamais un event_id inventé.

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

Pour "explicit" :

event_id DOIT correspondre à un événement existant.

Pour "implied" :

event_id DOIT être une chaîne vide.

Pour "not_confirmed" :

event_id peut être l'identifiant d'un événement pertinent
ou une chaîne vide.

============================================================
RÈGLE FINALE
============================================================

Avant de répondre, vérifie :

1. Un claim explicitement validé par l'utilisateur
   est "explicit".

2. Une information directement présente dans un événement
   est "explicit".

3. Une conclusion nécessitant plusieurs événements
   est "implied".

4. Une evidence "implied" représente réellement
   la conclusion.

5. Une evidence "implied" a :
   "event_id": ""

6. Les sources utilisées pour une déduction sont présentes
   séparément comme "explicit" lorsque nécessaire.

7. Une déduction non validée ne devient jamais un fait
   simplement parce qu'elle semble probable.

8. Ne fabrique jamais d'information.

9. Ne crée jamais de nouveau souvenir pendant le rappel.

10. Une validation utilisateur porte sur le claim précis
    qui a été validé.

11. La validation ne modifie jamais l'événement source.

12. Ne considère jamais le simple partage de mots entre
    une question et un souvenir comme une preuve suffisante.

13. Respecte les dates et leur précision.

14. Conserve la distinction entre événements distincts.

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
    /* NETTOYAGE DES EVIDENCES                              */
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

    /*
     * Une conclusion implied ne peut jamais
     * être attribuée à un événement source.
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
              event_id: '',
            };
          }

          return item;
        }
      );

    /*
     * Les preuves explicit et not_confirmed
     * doivent référencer un véritable événement
     * lorsqu'un event_id est fourni.
     */

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

    /*
     * On reconstruit une table locale des claims
     * réellement validés dans la mémoire reçue.
     */

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
     * Si GPT référence un événement qui contient
     * un claim validé, ce claim doit rester explicit.
     *
     * IMPORTANT :
     *
     * On ne remplace pas automatiquement le claim
     * de GPT par toute la description de l'événement.
     *
     * La validation concerne le claim précis.
     */

    result.evidence =
      result.evidence.map(
        (item) => {
          if (
            item.status ===
            'implied'
          ) {
            return item;
          }

          if (
            !validatedClaimsByEvent.has(
              item.event_id
            )
          ) {
            return item;
          }

          const claims =
            validatedClaimsByEvent.get(
              item.event_id
            );

          const matchingClaim =
            claims.find(
              (claim) =>
                claim ===
                item.claim
            );

          /*
           * Si le modèle a utilisé un claim validé
           * exactement, on garantit son statut explicit.
           */

          if (
            matchingClaim
          ) {
            return {
              ...item,
              status:
                'explicit',
              claim:
                matchingClaim,
            };
          }

          /*
           * Si le modèle a utilisé l'événement mais
           * pas exactement le claim validé, on ne considère
           * PAS automatiquement cette nouvelle formulation
           * comme validée.
           */

          return item;
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