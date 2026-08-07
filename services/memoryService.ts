import AsyncStorage from '@react-native-async-storage/async-storage';
import { SERVER_URL } from "../config/server";
import { STORAGE_KEY } from '../config/storage';

export type Relation = {
  from: string;
  relation: string;
  to: string;
  evidence?: 'explicit' | 'implied';
};

export type ValidatedClaim = {
  claim: string;
  validated_at: string;
};

export type MemoryEvent = {
  id: string;
  type: string;
  description: string;
  date_reference: string;
  date_precision: string;
  context: string;
  people: string[];
  places: string[];
  objects: string[];
  subjects: string[];
  thoughts: string[];
  actions: string[];
  intentions: string[];
  facts: string[];
  relations: Relation[];
  source_text: string;
  confidence: number;
  created_at: string;

  // Déductions explicitement validées
  validated_claims?: ValidatedClaim[];
};

type MemoryInput = {
  input: string;
  events: Partial<MemoryEvent>[];
};

/* ========================================================= */
/* NORMALISATION                                             */
/* ========================================================= */

function normalizeEvent(
  event: Partial<MemoryEvent>,
  input: string
): MemoryEvent {
  return {
    id:
      event.id ||
      `memory_${Date.now()}_${Math.random()
        .toString(36)
        .substring(2, 9)}`,

    type: event.type || 'event',

    description:
      event.description || input,

    date_reference:
      event.date_reference || '',

    date_precision:
      event.date_precision || 'unknown',

    context:
      event.context || '',

    people:
      event.people || [],

    places:
      event.places || [],

    objects:
      event.objects || [],

    subjects:
      event.subjects || [],

    thoughts:
      event.thoughts || [],

    actions:
      event.actions || [],

    intentions:
      event.intentions || [],

    facts:
      event.facts || [],

    relations:
      event.relations || [],

    source_text:
      event.source_text || input,

    confidence:
      typeof event.confidence === 'number'
        ? event.confidence
        : 0,

    created_at:
      event.created_at ||
      new Date().toISOString(),

    validated_claims:
      event.validated_claims || [],
  };
}

/* ========================================================= */
/* LECTURE DE LA MÉMOIRE                                    */
/* ========================================================= */

export async function loadMemory(): Promise<
  MemoryEvent[]
> {
  try {
    const saved =
      await AsyncStorage.getItem(
        STORAGE_KEY
      );

    if (!saved) {
      return [];
    }

    return JSON.parse(saved);
  } catch (error) {
    console.log(
      'Erreur de chargement de la mémoire :',
      error
    );

    return [];
  }
}

/* ========================================================= */
/* SAUVEGARDE DE LA MÉMOIRE                                 */
/* ========================================================= */

export async function saveMemory(
  events: MemoryEvent[]
): Promise<void> {
  try {
    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(events)
    );
  } catch (error) {
    console.log(
      'Erreur de sauvegarde de la mémoire :',
      error
    );

    throw error;
  }
}

/* ========================================================= */
/* AJOUT D'UN SOUVENIR                                      */
/* ========================================================= */

export async function remember(
  text: string
): Promise<MemoryEvent[]> {
  const texte = text.trim();

  if (!texte) {
    return [];
  }

  console.log(
    '📤 Envoi à Moment...'
  );

  const response = await fetch(
    `${SERVER_URL}/understand`,
    {
      method: 'POST',

      headers: {
        'Content-Type':
          'application/json',
      },

      body: JSON.stringify({
        text: texte,
      }),
    }
  );

  if (!response.ok) {
    throw new Error(
      `Serveur Moment : ${response.status}`
    );
  }

  const data: MemoryInput =
    await response.json();

  console.log(
    '🧠 Événements reçus :',
    data.events
  );

  const nouveauxEvenements =
    (data.events || []).map(
      (event) =>
        normalizeEvent(
          event,
          texte
        )
    );

  if (
    nouveauxEvenements.length === 0
  ) {
    throw new Error(
      'Moment n’a produit aucun événement'
    );
  }

  const current =
    await loadMemory();

  const updated = [
    ...nouveauxEvenements,
    ...current,
  ];

  await saveMemory(updated);

  return updated;
}

/* ========================================================= */
/* VALIDATION D'UNE DÉDUCTION                               */
/* ========================================================= */

export async function validateClaim(
  eventId: string,
  claim: string
): Promise<MemoryEvent[]> {
  const current =
    await loadMemory();

  const updated =
    current.map((event) => {
      if (event.id !== eventId) {
        return event;
      }

      const existingClaims =
        event.validated_claims || [];

      const alreadyValidated =
        existingClaims.some(
          (item) =>
            item.claim === claim
        );

      if (alreadyValidated) {
        return event;
      }

      return {
        ...event,

        validated_claims: [
          ...existingClaims,
          {
            claim,
            validated_at:
              new Date().toISOString(),
          },
        ],
      };
    });

  await saveMemory(updated);

  return updated;
}

/* ========================================================= */
/* OUBLI D'UN SOUVENIR                                      */
/* ========================================================= */

export async function forgetMemory(
  eventId: string
): Promise<MemoryEvent[]> {
  const current =
    await loadMemory();

  const updated =
    current.filter(
      (event) =>
        event.id !== eventId
    );

  await saveMemory(updated);

  return updated;
}

/* ========================================================= */
/* EFFACEMENT COMPLET                                       */
/* ========================================================= */

export async function clearMemory(): Promise<void> {
  await AsyncStorage.removeItem(
    STORAGE_KEY
  );
}
