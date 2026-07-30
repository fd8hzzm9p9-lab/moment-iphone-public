require('dotenv').config({ path: __dirname + '/.env' });

const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');

const app = express();

app.use(cors());
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.get('/', (req, res) => {
  res.json({
    message: 'Le cerveau de Moment fonctionne !',
  });
});

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

IMPORTANT :

Une saisie de l'utilisateur peut contenir UN ou PLUSIEURS événements.

Tu dois donc découper la saisie en événements distincts lorsque
plusieurs événements différents sont racontés.

Exemple :

"Lundi dernier, j'ai vu Paul. Le soir, j'ai pensé que l'éclairage
du bassin était vraiment mauvais."

Cette saisie contient deux événements :

ÉVÉNEMENT 1 :
J'ai vu Paul lundi dernier.

ÉVÉNEMENT 2 :
Le soir, j'ai pensé que l'éclairage du bassin était mauvais.

Ces deux événements doivent rester séparés.

Ils peuvent provenir de la même saisie, mais cela ne signifie PAS
qu'ils sont liés.

RÈGLE ABSOLUE SUR LES RELATIONS :

Ne crée une relation entre deux éléments QUE si cette relation est
explicitement exprimée ou clairement établie par le texte.

Ne crée JAMAIS une relation simplement parce que :
- deux éléments apparaissent dans la même saisie ;
- ils se produisent le même jour ;
- ils se produisent au même endroit ;
- ils sont proches dans le texte ;
- ils semblent logiquement liés.

Exemple :

"J'ai vu Paul. Plus tard j'ai pensé à l'éclairage."

Paul et l'éclairage ne sont PAS liés.

En revanche :

"J'ai parlé avec Paul de l'éclairage."

établit une relation explicite.

OBJECTIF :

Créer une mémoire fiable.

Il vaut mieux oublier une relation incertaine que créer un faux
souvenir.

Retourne UNIQUEMENT un objet JSON valide.
Aucun markdown.
Aucune explication.

Structure obligatoire :

{
  "input": "",
  "events": []
}

Chaque événement doit avoir exactement cette structure :

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

RÈGLES :

id :
Identifiant unique à l'intérieur de cette saisie.
Utilise "event_1", "event_2", "event_3", etc.

type :
Utilise l'un des types suivants :
"event"
"thought"
"idea"
"action"
"intention"
"fact"
"feeling"
"mixed"

description :
Résumé très court et fidèle de l'événement.

date_reference :
Référence temporelle réellement présente.
Exemples :
"lundi dernier"
"le soir"
"hier"
"ce matin"
"demain"

Si aucune référence temporelle :
""

date_precision :
Utilise :
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
Pensées ou réflexions réellement exprimées.

actions :
Actions réellement effectuées ou en cours.

intentions :
Actions envisagées mais pas encore réalisées.

facts :
Informations présentées comme des faits.

relations :
Uniquement les relations explicitement présentes.

Chaque relation doit avoir :

Chaque relation doit avoir exactement :

{
  "from": "",
  "relation": "",
  "to": "",
  "evidence": ""
}

evidence doit être exactement l'une des valeurs suivantes :

"explicit"
"implied"

"explicit" signifie que la relation est directement exprimée
dans le texte de l'utilisateur.

Exemple :
"J'ai mangé avec Marc."

→

{
  "from": "moi",
  "relation": "a mangé avec",
  "to": "Marc",
  "evidence": "explicit"
}

"implied" signifie que la relation n'est pas directement exprimée
mais peut être déduite logiquement.

IMPORTANT :

Ne crée normalement PAS de relation "implied" lors de
l'enregistrement du souvenir.

Les relations "implied" seront calculées plus tard par le moteur
de raisonnement.

La mémoire enregistrée doit donc principalement contenir
les relations explicitement exprimées par l'utilisateur.

S'il n'existe aucune relation :
[]

created_at :
Laisse ce champ vide.
Il sera rempli automatiquement par Moment
au moment où le souvenir est enregistré.

source_text :
La partie exacte du texte utilisateur correspondant à cet événement.

confidence :
Nombre entre 0 et 1.

RÈGLE ABSOLUE :

N'INVENTE RIEN.

Ne transforme jamais :
- une proximité temporelle en relation ;
- une proximité géographique en relation ;
- une cooccurrence en relation ;
- une supposition en fait ;
- une intention en action réalisée.

Si plusieurs événements sont présents, crée plusieurs objets
dans "events".

Si un seul événement est présent, crée un seul objet.

Texte utilisateur :

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
        error: 'Le cerveau de Moment a produit une réponse invalide',
      });
    }

  result.events?.forEach(event => {
    event.created_at = new Date().toISOString();
  });

  console.log(
    `🧠 ${result.events?.length || 0} événement(s) compris`
  );

    console.log(JSON.stringify(result, null, 2));

    res.json(result);

  } catch (error) {
    console.error('❌ Erreur OpenAI :', error);

    res.status(500).json({
      error: 'Erreur lors de la compréhension de la mémoire',
    });
  }
});


app.post('/recall', async (req, res) => {
  console.log('🔎 Question reçue');

  try {
    const { question, memories } = req.body;

    if (!question || !Array.isArray(memories)) {
      return res.status(400).json({
        error: 'Question ou mémoire absente',
      });
    }

    console.log('🧠 Recherche dans la mémoire...');

    const response = await openai.responses.create({
      model: 'gpt-5-mini',
      input: `
Tu es le moteur de rappel de Moment.

Moment possède une mémoire personnelle composée d'événements
indépendants.

L'utilisateur pose une question concernant sa propre mémoire.

Ta mission est de retrouver les événements qui permettent
de répondre à la question et de formuler une réponse naturelle.

RÈGLE ABSOLUE SUR LA CERTITUDE :

Pour répondre à une question, distingue toujours quatre niveaux
d'information :

1. EXPLICITE

L'information est directement présente dans l'événement.

Exemple :
"J'ai vu Paul."

→ Il est certain que l'utilisateur a vu Paul.

2. IMPLIQUÉ

L'information n'est pas écrite explicitement, mais elle découle
logiquement de l'événement.

Exemple :
"J'ai mangé avec Marc."

→ Il est raisonnable de déduire que Marc était présent avec
l'utilisateur et qu'il a probablement été vu.

Cette information doit être présentée comme une implication,
jamais comme un fait explicitement mémorisé.

RÈGLE IMPORTANTE SUR LES IMPLICATIONS :

Une implication doit découler directement de l'action ou de
l'affirmation décrite dans l'événement.

Ne déduis jamais la présence d'une personne simplement parce
qu'un événement mentionne son domicile, son lieu de travail,
sa maison ou un autre lieu qui lui est associé.

Exemples :

"Je suis allé chez Marc."
→ Cela confirme que l'utilisateur est allé chez un lieu associé
à Marc.
→ Cela ne confirme PAS que Marc était présent.
→ Cela ne confirme PAS que l'utilisateur a vu Marc.

"Je suis retourné chez Marc."
→ Même règle : la présence de Marc n'est pas confirmée.

"J'ai rejoint Marc chez lui."
→ Le verbe "rejoindre" implique que Marc était présent au moment
de la rencontre.
→ Cela permet de considérer que l'utilisateur a probablement vu
Marc, même si le verbe "voir" n'est pas utilisé.

"J'ai mangé avec Marc."
→ Le fait de manger "avec Marc" implique que Marc était présent.
→ Dans le contexte ordinaire de cette formulation, cela implique
également que l'utilisateur l'a probablement vu.

"J'ai parlé avec Marc au téléphone."
→ Cela confirme une conversation téléphonique.
→ Cela ne confirme PAS que Marc était physiquement présent.
→ Cela ne confirme PAS que l'utilisateur l'a vu.

IMPORTANT :

Le simple fait qu'une personne soit mentionnée dans un lieu
ne suffit jamais à déduire sa présence.

Base toujours la déduction sur le sens de l'action exprimée,
et non uniquement sur le lieu, la proximité temporelle ou la
présence du nom d'une personne.

3. NON CONFIRMÉ

La mémoire contient une information proche mais qui ne permet
pas de confirmer le fait demandé.

Exemple :
"J'ai parlé avec Sophie au téléphone."

→ Cela confirme une conversation avec Sophie.
→ Cela ne confirme pas que l'utilisateur a vu Sophie en personne.

4. INCONNU

La mémoire ne contient aucune information permettant de répondre.

RÈGLE ABSOLUE SUR LES DÉDUCTIONS :

Certaines actions permettent de déduire logiquement la présence
physique d'une personne.

Par exemple :

"J'ai mangé avec Marc."
"J'ai dîné avec Marc."
"J'ai déjeuné avec Marc."
"J'ai bu un verre avec Marc."
"J'ai travaillé avec Marc."
"J'ai fait une activité avec Marc."

permettent de considérer que Marc était présent avec l'utilisateur.

Dans un contexte physique, il est également raisonnable de
considérer que l'utilisateur a probablement vu cette personne.

Cette information reste IMPLIQUÉE.

Elle ne devient jamais EXPLICITE.

RÈGLE DU TÉLÉPHONE :

Si l'événement indique :

"au téléphone"
"par téléphone"
"au téléphone avec"
"appelé"
"appel téléphonique"

alors la conversation est confirmée, mais la présence physique
et le fait d'avoir vu la personne restent NON CONFIRMÉS.

Ne déduis jamais qu'une personne a été vue parce que
l'utilisateur lui a parlé au téléphone.

RÈGLE DU TEMPS :

Les déductions doivent respecter exactement la précision
temporelle de l'événement.

"J'ai vu Paul hier."

ne permet pas de répondre :

"Paul était avec toi hier soir."

"Hier" et "hier soir" ne sont pas équivalents.

RÈGLE DES MISES À JOUR ET CORRECTIONS :

La mémoire peut contenir plusieurs informations concernant
la même personne, le même événement ou le même moment.

Ces informations ne sont pas nécessairement contradictoires.

Lorsqu'un événement plus récent apporte une correction,
une précision ou une évolution explicite d'un événement antérieur,
la nouvelle information doit être considérée comme l'état le plus
récent de la situation.

Certains mots ou expressions peuvent signaler cette évolution :

"finalement"
"ensuite"
"puis"
"après"
"plus tard"
"en fait"
"je me suis finalement..."
"j'ai finalement..."
"je l'ai finalement..."
"au final"

Exemple :

"Ce soir, je n'ai pas vu Marc, je lui ai seulement parlé
au téléphone."

Puis :

"Ce soir finalement, j'ai rejoint Marc chez lui."

La deuxième information ne doit pas être considérée comme une
simple contradiction sans contexte.

Elle indique que la situation a évolué.

Pour répondre à :

"Est-ce que j'ai vu Marc ce soir ?"

la réponse doit être :

"Oui. Tu avais d'abord indiqué ne pas avoir vu Marc ce soir,
mais tu as ensuite indiqué que tu l'avais finalement rejoint
chez lui."

IMPORTANT :

Ne supprime jamais l'ancien souvenir.

L'historique doit rester conservé.

Mais lorsqu'une information plus récente modifie explicitement
l'état de la situation, utilise cette information plus récente
pour répondre à une question portant sur l'état final.

Si aucune indication ne permet de déterminer qu'une information
corrige ou actualise une information précédente, considère les
deux informations comme potentiellement contradictoires et
signale l'incertitude.

RÈGLE DU CONTEXTE :

Une déduction ne doit pas être déplacée vers un autre contexte.

"J'ai mangé avec Marc au restaurant hier soir."

permet de déduire :

"Marc était présent au restaurant hier soir."

Cela ne permet pas de déduire :

"Marc était avec moi ce matin."

RÈGLE SUR LES QUESTIONS :

La réponse doit utiliser uniquement le niveau de certitude
nécessaire pour répondre à la question.

Si la question demande :

"Qu'est-ce que j'ai fait avec Marc ?"

répondre avec l'action mémorisée :

"Tu as mangé avec Marc hier soir."

Il n'est pas nécessaire d'ajouter que Marc était probablement
présent ou probablement vu.

Si la question demande :

"Est-ce que j'ai vu Marc ?"

alors une implication pertinente peut être utilisée :

"Tu as mangé avec Marc hier soir, ce qui implique probablement
que tu l'as vu."

Si la question demande :

"Qui ai-je vu récemment ?"

examiner les événements explicites ET les événements permettant
une implication logique.

Exemple :

"J'ai vu Paul."
"J'ai parlé avec Sophie au téléphone."
"J'ai mangé avec Marc."

Réponse attendue :

Paul est explicitement identifié comme ayant été vu.

Marc peut être inclus comme personne probablement vue.

Sophie ne doit pas être incluse comme personne vue.

RÈGLE ABSOLUE :

Ne transforme jamais une information IMPLIQUÉE en information
EXPLICITE.

Ne transforme jamais une information NON CONFIRMÉE en fait.

Ne fabrique aucune information.

Ne crée jamais un nouveau souvenir à partir d'une déduction.

QUESTION DE L'UTILISATEUR :

${question}

ÉVÉNEMENTS DISPONIBLES :

${JSON.stringify(memories, null, 2)}

Retourne UNIQUEMENT un objet JSON valide :

{
  "answer": "",
  "event_ids": [],
  "confidence": 0,
  "evidence": []
}

answer :
Réponse naturelle à la question.

event_ids :
Liste des identifiants des événements utilisés pour répondre.

confidence :
Nombre entre 0 et 1 représentant la confiance globale
dans la réponse.

evidence :
Liste des éléments utilisés pour construire la réponse.

Chaque élément doit avoir exactement cette structure :

{
  "event_id": "",
  "status": "",
  "claim": ""
}

status doit être exactement l'une des valeurs suivantes :

"explicit"
"implied"
"not_confirmed"

explicit :
Le fait est directement présent dans l'événement.

implied :
Le fait est logiquement déduit de l'événement.

not_confirmed :
L'événement contient une information proche, mais ne permet
pas de confirmer le fait demandé.

Exemple :

Question :
"Est-ce que j'ai vu Marc ?"

Événement :
"J'ai mangé avec Marc."

La réponse peut être :

{
  "answer": "Oui, tu as mangé avec Marc hier soir, ce qui implique qu'il était avec toi et que tu l'as probablement vu.",
  "event_ids": ["event_3"],
  "confidence": 0.9,
  "evidence": [
    {
      "event_id": "event_3",
      "status": "implied",
      "claim": "Marc était présent avec l'utilisateur."
    }
  ]
}

Ne présente jamais une information "implied" comme si elle était
explicitement mémorisée.

RÈGLE DES MISES À JOUR TEMPORELLES :

Chaque événement peut contenir un champ technique "created_at".
Il indique le moment où Moment a enregistré cet événement.

Lorsque plusieurs événements concernent la même personne,
le même fait ou le même contexte temporel, compare leur
"created_at" pour déterminer leur ordre d'enregistrement.

Si un événement plus récent apporte une correction, une précision
ou une évolution explicite concernant un événement plus ancien,
l'événement plus récent représente l'état le plus récent de la
situation.

Exemple :

Événement ancien :
"Je n'ai pas vu Marc ce soir, je lui ai seulement parlé
au téléphone."

Événement plus récent :
"J'ai finalement rejoint Marc chez lui ce soir."

Ces deux événements doivent rester dans la mémoire.

Mais pour répondre à :

"Est-ce que j'ai vu Marc ce soir ?"

l'information la plus récente doit être considérée comme
l'état final de la situation.

La réponse peut expliquer l'évolution :

"Tu avais d'abord indiqué ne pas avoir vu Marc ce soir,
mais tu as ensuite indiqué l'avoir rejoint chez lui.
La dernière information indique donc que tu l'as vu ce soir."

IMPORTANT :

Ne considère PAS automatiquement qu'un événement plus récent
annule un événement plus ancien.

Il doit exister une relation logique entre les deux informations :
même personne, même fait ou même contexte, et modification,
correction, précision ou évolution identifiable.

Si cette relation n'est pas suffisamment claire, conserve les
deux informations et signale la contradiction.

Ne supprime jamais l'historique.

Ne transforme jamais une simple différence de date d'enregistrement
en correction.

Le champ "created_at" sert à déterminer l'ordre des informations,
pas à décider à lui seul qu'une information est vraie ou fausse.

answer :
Réponse naturelle à la question.

event_ids :
Liste des identifiants des événements utilisés pour répondre.

confidence :
Nombre entre 0 et 1.

IMPORTANT :

Si plusieurs événements sont pertinents, tu peux en utiliser
plusieurs.

Mais ne crée jamais de lien entre eux qui n'existe pas.

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
      result = JSON.parse(response.output_text);
    } catch (parseError) {
      console.error(
        '❌ Réponse de rappel invalide :',
        response.output_text
      );

      return res.status(500).json({
        error: 'Réponse de rappel invalide',
      });
    }

    console.log('💡 Réponse :', result.answer);

    res.json(result);

  } catch (error) {
    console.error('❌ Erreur de rappel :', error);

    res.status(500).json({
      error: 'Erreur lors du rappel de la mémoire',
    });
  }
});

const PORT = 3000;

app.listen(PORT, () => {
  console.log(
    `🧠 Serveur Moment lancé sur http://localhost:${PORT}`
  );
});