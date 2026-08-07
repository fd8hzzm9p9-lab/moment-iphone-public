import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import MomentThinkingAnimation from '../../components/MomentThinkingAnimation';
import { SERVER_URL } from '../../config/server';
import { STORAGE_KEY } from '../../config/storage';

import {
  APP_NAME,
  APP_TAGLINE,
  APP_VERSION,
} from '../../config/app';

import {
  MEMORY_PLACEHOLDER,
  MEMORY_PROCESSING_STEPS,
} from '../../config/text';

/* ========================================================= */
/* TEXTES                                                    */
/* ========================================================= */

const MEMORY_BUTTON = 'Souviens-toi';
const CANCEL_BUTTON = 'Annuler';
const MEMORY_TITLE = 'Ma mémoire';

const UNDERSTOOD_LABEL =
  '🧠 Moment a compris';

const CLEAR_MEMORY_LABEL =
  'Effacer la mémoire';

const FORGET_MEMORY_LABEL =
  '🗑️ Oublier ce souvenir';

const CLEAR_INPUT_LABEL = '×';

/* ========================================================= */
/* TYPES                                                     */
/* ========================================================= */

type Relation = {
  from: string;
  relation: string;
  to: string;
};

type ChangeHistoryEntry =
  | string
  | {
      type?: string;
      old_description?: string;
      new_description?: string;
      old_value?: string;
      new_value?: string;
      old_time?: string;
      new_time?: string;
      old_time_start?: string;
      old_time_end?: string;
      new_time_start?: string;
      new_time_end?: string;
      date_reference?: string;
      corrected_at?: string;
      message?: string;
      [key: string]: unknown;
    };

type MemoryEvent = {
  id: string;
  type: string;
  description: string;
  date_reference: string;
  date_precision: string;
  temporal_direction?: string;
  calendar_date?: string;
  date_confirmation?: {
    confirmed: boolean;
    confirmed_date?: string;
  };
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

  processing_time?: number;
  change_history?: ChangeHistoryEntry[];
  was_corrected?: boolean;
  previous_description?: string;
  previous_location?: string;

  corrected?: boolean;
  correction_note?: string;
  correction_type?: string;
  corrected_person?: string;
  corrected_old_value?: string;
  corrected_new_value?: string;
  corrected_old_time?: string | {
    start: string;
    end: string | null;
  };
  corrected_new_time?: string | {
    start: string;
    end: string | null;
  };
};

type MemoryInput = {
  input: string;

  events: Partial<MemoryEvent>[];

  date_confirmation?: {
    required: boolean;

    type?: string;

    proposed_date?: string;

    original_reference?: string;

    source_text?: string;

    events?: Partial<MemoryEvent>[];

    message?: string;
  };

  correction_request?: {
    detected: boolean;

    type?: string;

    person?: string;

    date_reference?: string;

    day?: string;

    context?: string;

    event_ids?: string[];

    memories?: Array<{
      id: string;
      description: string;
    }>;

    old_memory?: {
      id: string;
      description: string;
    };

    new_memory?: Partial<MemoryEvent>;

    new_description?: string;

    old_value?: string;
    new_value?: string;

    old_time?: string | {
      start: string;
      end: string | null;
    };

    new_time?: string | {
      start: string;
      end: string | null;
    };

    old_time_range?: {
      start: string;
      end: string;
    } | null;

    new_time_range?: {
      start: string;
      end: string;
    } | null;

    message?: string;

    ambiguous?: boolean;

    requires_selection?: boolean;
  };
};

type Conflict = {
  existingEvent: MemoryEvent;
  newEvent: MemoryEvent;
};

/* ========================================================= */
/* NORMALISATION                                             */
/* ========================================================= */

function createUniqueMemoryId() {
  return `memory_${Date.now()}_${Math.random()
    .toString(36)
    .substring(2, 10)}`;
}

function normalizeEvent(
  event: Partial<MemoryEvent>,
  input: string
): MemoryEvent {
  const normalizedRelations: Relation[] =
    Array.isArray(event.relations)
      ? event.relations
          .filter(
            relation =>
              relation &&
              typeof relation.from === 'string' &&
              relation.from.trim() &&
              typeof relation.relation === 'string' &&
              relation.relation.trim() &&
              typeof relation.to === 'string' &&
              relation.to.trim()
          )
          .map(relation => ({
            from: relation.from.trim(),
            relation: relation.relation.trim(),
            to: relation.to.trim(),
          }))
      : [];

  return {
    id: createUniqueMemoryId(),

    type:
      event.type ||
      'event',

    description:
      event.description ||
      input,

    date_reference:
      event.date_reference ||
      '',

    date_precision:
      event.date_precision ||
      'unknown',

    temporal_direction:
      event.temporal_direction ||
      'unknown',

    /*
     * IMPORTANT :
     * La date calendaire résolue par le serveur doit être
     * conservée après confirmation.
     *
     * Exemple :
     * "vendredi" + confirmation
     * =>
     * calendar_date = "2026-08-07"
     */
    ...(event.calendar_date
      ? {
          calendar_date:
            event.calendar_date,
        }
      : {}),

    ...(event.date_confirmation
      ? {
          date_confirmation:
            event.date_confirmation,
        }
      : {}),

    context:
      event.context ||
      '',

    people:
      Array.isArray(event.people)
        ? event.people
        : [],

    places:
      Array.isArray(event.places)
        ? event.places
        : [],

    objects:
      Array.isArray(event.objects)
        ? event.objects
        : [],

    subjects:
      Array.isArray(event.subjects)
        ? event.subjects
        : [],

    thoughts:
      Array.isArray(event.thoughts)
        ? event.thoughts
        : [],

    actions:
      Array.isArray(event.actions)
        ? event.actions
        : [],

    intentions:
      Array.isArray(event.intentions)
        ? event.intentions
        : [],

    facts:
      Array.isArray(event.facts)
        ? event.facts
        : [],

    relations:
      normalizedRelations,

    source_text:
      event.source_text ||
      input,

    confidence:
      typeof event.confidence === 'number'
        ? event.confidence
        : 0,

    created_at:
      new Date().toISOString(),

    change_history:
      Array.isArray(event.change_history)
        ? event.change_history
        : [],

    was_corrected:
      event.was_corrected === true,

    previous_description:
      event.previous_description ||
      '',

    previous_location:
      event.previous_location ||
      '',

    corrected:
      event.corrected === true,

    ...(event.correction_note
      ? {
          correction_note:
            event.correction_note,
        }
      : {}),

    ...(event.correction_type
      ? {
          correction_type:
            event.correction_type,
        }
      : {}),

    ...(event.corrected_person
      ? {
          corrected_person:
            event.corrected_person,
        }
      : {}),

    ...(event.corrected_old_value !== undefined
      ? {
          corrected_old_value:
            event.corrected_old_value,
        }
      : {}),

    ...(event.corrected_new_value !== undefined
      ? {
          corrected_new_value:
            event.corrected_new_value,
        }
      : {}),

    ...(event.corrected_old_time !== undefined
      ? {
          corrected_old_time:
            event.corrected_old_time,
        }
      : {}),

    ...(event.corrected_new_time !== undefined
      ? {
          corrected_new_time:
            event.corrected_new_time,
        }
      : {}),
  };
}
/* ========================================================= */
/* NORMALISATION TEXTE                                       */
/* ========================================================= */

function normalizeText(
  value: string
) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(
      /[\u0300-\u036f]/g,
      ''
    )
    .trim();
}

/* ========================================================= */
/* FORMATAGE HISTORIQUE                                      */
/* ========================================================= */

function formatChangeHistoryEntry(
  entry: ChangeHistoryEntry
): string {
  if (
    typeof entry === 'string'
  ) {
    return entry;
  }

  if (
    !entry ||
    typeof entry !== 'object'
  ) {
    return '';
  }

  const oldValue =
    typeof entry.old_value === 'string'
      ? entry.old_value.trim()
      : '';

  const newValue =
    typeof entry.new_value === 'string'
      ? entry.new_value.trim()
      : '';

  const oldTime =
    typeof entry.old_time === 'string'
      ? entry.old_time.trim()
      : '';

  const newTime =
    typeof entry.new_time === 'string'
      ? entry.new_time.trim()
      : '';

  const oldTimeStart =
    typeof entry.old_time_start === 'string'
      ? entry.old_time_start.trim()
      : '';

  const oldTimeEnd =
    typeof entry.old_time_end === 'string'
      ? entry.old_time_end.trim()
      : '';

  const newTimeStart =
    typeof entry.new_time_start === 'string'
      ? entry.new_time_start.trim()
      : '';

  const newTimeEnd =
    typeof entry.new_time_end === 'string'
      ? entry.new_time_end.trim()
      : '';

  let message = '';

  if (
    typeof entry.message === 'string' &&
    entry.message.trim()
  ) {
    message =
      entry.message.trim();
  } else if (
    oldTime &&
    newTime &&
    oldTime !== newTime
  ) {
    message =
      `Horaire corrigé : ${oldTime} → ${newTime}.`;
  } else if (
    oldTimeStart &&
    oldTimeEnd &&
    newTimeStart &&
    newTimeEnd
  ) {
    message =
      `Horaire corrigé : ${oldTimeStart} à ${oldTimeEnd} → ${newTimeStart} à ${newTimeEnd}.`;
  } else if (
    oldValue &&
    newValue &&
    oldValue !== newValue
  ) {
    message =
      `Information corrigée : ${oldValue} → ${newValue}.`;
  } else {
    const oldDescription =
      typeof entry.old_description === 'string'
        ? entry.old_description.trim()
        : '';

    const newDescription =
      typeof entry.new_description === 'string'
        ? entry.new_description.trim()
        : '';

    if (
      oldDescription &&
      newDescription &&
      oldDescription !== newDescription
    ) {
      message =
        'Information corrigée.';
    } else {
      message =
        'Information corrigée.';
    }
  }

  /*
   * Une correction possède normalement corrected_at.
   *
   * On affiche la date uniquement lorsque cette information
   * est réellement disponible.
   */
  const correctedAt =
    typeof entry.corrected_at === 'string'
      ? entry.corrected_at.trim()
      : '';

  if (
    correctedAt
  ) {
    const date =
      new Date(
        correctedAt
      );

    if (
      !Number.isNaN(
        date.getTime()
      )
    ) {
      const formattedDate =
        new Intl.DateTimeFormat(
          'fr-FR',
          {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          }
        ).format(
          date
        );

      return `${message} (${formattedDate})`;
    }
  }

  return message;
}
/* ========================================================= */
/* EXTRACTION PERSONNE                                       */
/* ========================================================= */

function getPerson(
  event: MemoryEvent
) {
  if (
    Array.isArray(event.people) &&
    event.people.length > 0
  ) {
    return normalizeText(
      event.people[0]
    );
  }

  const text =
    normalizeText(
      event.description
    );

  const match =
    text.match(
      /\b(marc|leo|chloe|julien|sophie|axelle)\b/
    );

  return match
    ? match[1]
    : '';
}

/* ========================================================= */
/* EXTRACTION JOUR                                           */
/* ========================================================= */

const DAYS = [
  'lundi',
  'mardi',
  'mercredi',
  'jeudi',
  'vendredi',
  'samedi',
  'dimanche',
];

function getDay(
  event: MemoryEvent
) {
  const reference =
    normalizeText(
      event.date_reference
    );

  for (
    const day of DAYS
  ) {
    if (
      reference.includes(day)
    ) {
      return day;
    }
  }

  const text =
    normalizeText(
      event.description
    );

  for (
    const day of DAYS
  ) {
    if (
      text.includes(day)
    ) {
      return day;
    }
  }

  return '';
}

/* ========================================================= */
/* TRAVAIL                                                   */
/* ========================================================= */

function isWorkEvent(
  event: MemoryEvent
) {
  const values = [
    ...(event.subjects || []),
    ...(event.actions || []),
    ...(event.facts || []),
    event.description || '',
  ];

  const text =
    normalizeText(
      values.join(' ')
    );

  return (
    text.includes('travail') ||
    text.includes('travaille') ||
    text.includes('travailler') ||
    text.includes('planning') ||
    text.includes('horaire')
  );
}

/* ========================================================= */
/* LIEU                                                      */
/* ========================================================= */

function getLocation(
  event: MemoryEvent
) {
  if (
    Array.isArray(event.places) &&
    event.places.length > 0
  ) {
    return String(
      event.places[0]
    ).trim();
  }

  if (
    event.context &&
    event.context.trim()
  ) {
    return event.context.trim();
  }

  const text =
    normalizeText(
      event.description
    );

  const knownPlaces = [
    'bernay',
    'marolles',
    'evreux',
    'serquigny',
    'beaumont le roger',
  ];

  for (
    const place of knownPlaces
  ) {
    if (
      text.includes(place)
    ) {
      return place
        .split(' ')
        .map(
          word =>
            word.charAt(0).toUpperCase() +
            word.slice(1)
        )
        .join(' ');
    }
  }

  return '';
}

/* ========================================================= */
/* EXTRACTION DES HORAIRES                                  */
/* ========================================================= */

function getWorkTimeRange(
  event: MemoryEvent
) {
  const text = normalizeText(
    [
      event.date_reference || '',
      event.description || '',
      ...(event.facts || []),
      ...(event.actions || []),
      ...(event.subjects || []),
    ].join(' ')
  );

  const rangeMatch = text.match(
    /\b(\d{1,2})h(?:\s*(\d{1,2}))?\s*(?:a|à|-|–|—)\s*(\d{1,2})h(?:\s*(\d{1,2}))?\b/i
  );

  if (rangeMatch) {
    const startHour = Number(rangeMatch[1]);
    const startMinute = Number(rangeMatch[2] || 0);
    const endHour = Number(rangeMatch[3]);
    const endMinute = Number(rangeMatch[4] || 0);

    return {
      start: startHour * 60 + startMinute,
      end: endHour * 60 + endMinute,
      text: `${rangeMatch[1]}h${
        rangeMatch[2] ? rangeMatch[2] : ''
     }-${rangeMatch[3]}h${
        rangeMatch[4] ? rangeMatch[4] : ''
      }`,
    };
  }

  const singleMatch = text.match(
    /\b(\d{1,2})h(?:\s*(\d{1,2}))?\b/i
  );

  if (singleMatch) {
    const hour = Number(singleMatch[1]);
    const minute = Number(singleMatch[2] || 0);

    return {
      start: hour * 60 + minute,
      end: null,
      text: `${singleMatch[1]}h${
        singleMatch[2] ? singleMatch[2] : ''
      }`,
    };
  }

  return null;
}

/* ========================================================= */
/* EXTRACTION DES JOURS                                     */
/* ========================================================= */

function getDays(
  event: MemoryEvent
): string[] {
  const text = normalizeText(
    [
      event.date_reference || '',
      event.description || '',
      ...(event.facts || []),
      ...(event.actions || []),
      ...(event.subjects || []),
    ].join(' ')
  );

  const result: string[] = [];

  const hasWeekdayRange =
    text.includes('lundi au vendredi') ||
    text.includes('lundi a vendredi') ||
    text.includes('du lundi au vendredi') ||
    text.includes('du lundi a vendredi');

  if (hasWeekdayRange) {
    return [
      'lundi',
      'mardi',
      'mercredi',
      'jeudi',
      'vendredi',
    ];
  }

  for (const day of DAYS) {
    if (text.includes(day)) {
      result.push(day);
    }
  }

  return result;
}

/* ========================================================= */
/* TYPE DE SOUVENIR                                         */
/* ========================================================= */

function isAppointmentEvent(
  event: MemoryEvent
) {
  const text = normalizeText(
    [
      event.type || '',
      event.description || '',
      event.context || '',
      ...(event.subjects || []),
      ...(event.actions || []),
      ...(event.facts || []),
    ].join(' ')
  );

  return (
    text.includes('rendez-vous') ||
    text.includes('rendez vous') ||
    text.includes('rdv') ||
    text.includes('appointment')
  );
}

/* ========================================================= */
/* RECHERCHE CONFLIT                                        */
/* ========================================================= */

function findConflict(
  currentMemories: MemoryEvent[],
  newEvent: MemoryEvent
): Conflict | null {
  const newPerson =
    getPerson(newEvent);

  const newDays =
    getDays(newEvent);

  const newLocation =
    normalizeText(
      getLocation(newEvent)
    );

  const newTime =
    getWorkTimeRange(newEvent);

  if (
    !newPerson ||
    newDays.length === 0 ||
    !isWorkEvent(newEvent) ||
    !newLocation
  ) {
    return null;
  }

  for (
    const existingEvent of currentMemories
  ) {
    const existingPerson =
      getPerson(existingEvent);

    const existingDays =
      getDays(existingEvent);

    const existingLocation =
      normalizeText(
        getLocation(existingEvent)
      );

    const existingTime =
      getWorkTimeRange(
        existingEvent
      );

    if (
      existingPerson !==
      newPerson
    ) {
      continue;
    }

    if (
      !isWorkEvent(
        existingEvent
      )
    ) {
      continue;
    }

    if (
      !existingLocation ||
      existingLocation !==
        newLocation
    ) {
      continue;
    }

    const sameDay =
      existingDays.some(
        day =>
          newDays.includes(day)
      );

    if (!sameDay) {
      continue;
    }

    if (
      existingTime &&
      newTime &&
      existingTime.start === newTime.start &&
      existingTime.end === newTime.end
    ) {
      continue;
    }

    if (
      existingTime ||
      newTime
    ) {
      return {
        existingEvent,
        newEvent,
      };
    }
  }

  return null;
}

/* ========================================================= */
/* CONSTRUCTION MÉMOIRE CORRIGÉE                            */
/* ========================================================= */

function buildCorrectedMemory(
  existingEvent: MemoryEvent,
  newEvent: MemoryEvent
): MemoryEvent {
  const oldDescription =
    existingEvent.description;

  const newDescription =
    newEvent.description;

  const previousHistory =
    Array.isArray(
      existingEvent.change_history
    )
      ? existingEvent.change_history
      : [];

  let newDateReference =
    existingEvent.date_reference;

  const oldTimeMatch =
    existingEvent.date_reference.match(
      /\b\d{1,2}h(?:\d{1,2})?\b/i
    );

  const newTimeMatch =
    newDescription.match(
      /\b\d{1,2}h(?:\d{1,2})?\b/i
    );

  if (
    oldTimeMatch &&
    newTimeMatch
  ) {
    newDateReference =
      existingEvent.date_reference.replace(
        oldTimeMatch[0],
        newTimeMatch[0]
      );
  }

  const updatedFacts =
    (existingEvent.facts || []).map(
      fact => {
        if (
          oldTimeMatch &&
          newTimeMatch
        ) {
          return fact.replace(
            new RegExp(
              oldTimeMatch[0]
                .replace(
                  /([.*+?^${}()|[\]\\])/g,
                  '\\$1'
                ),
              'gi'
            ),
            newTimeMatch[0]
          );
        }

        return fact;
      }
    );

  const updatedRelations =
    Array.isArray(
      newEvent.relations
    )
      ? newEvent.relations.filter(
          relation =>
            relation &&
            typeof relation.from === 'string' &&
            relation.from.trim() &&
            typeof relation.relation === 'string' &&
            relation.relation.trim() &&
            typeof relation.to === 'string' &&
            relation.to.trim()
        )
      : (
          Array.isArray(
            existingEvent.relations
          )
            ? existingEvent.relations
            : []
        );

  return {
    ...existingEvent,

    description:
      newDescription,

    date_reference:
      newDateReference,

    facts:
      updatedFacts,

    relations:
      updatedRelations,

    change_history: [
      ...previousHistory,
      {
        type: 'correction',
        old_description:
          oldDescription,
        new_description:
          newDescription,
        message:
          'Information corrigée.',
        corrected_at:
          new Date().toISOString(),
      },
    ],

    was_corrected:
      true,

    previous_description:
      oldDescription,

    created_at:
      new Date().toISOString(),
  };
}

/* ========================================================= */
/* DÉTAILS                                                   */
/* ========================================================= */


function EventDetails({
  event,
}: {
  event: MemoryEvent;
}) {
  const validRelations =
    Array.isArray(event.relations)
      ? event.relations.filter(
          relation =>
            relation &&
            typeof relation.from === 'string' &&
            relation.from.trim() &&
            typeof relation.relation === 'string' &&
            relation.relation.trim() &&
            typeof relation.to === 'string' &&
            relation.to.trim()
        )
      : [];

  const changeHistory =
    Array.isArray(event.change_history) &&
    event.change_history.length > 0
      ? event.change_history
          .map(formatChangeHistoryEntry)
          .filter(text => text.trim())
      : [];

  const description =
    typeof event.description === 'string'
      ? event.description.trim().toLowerCase()
      : '';

  const isRedundantDetail = (
    value: string
  ) => {
    const normalizedValue =
      value.trim().toLowerCase();

    if (!normalizedValue) {
      return true;
    }

    return (
      description.includes(normalizedValue) ||
      normalizedValue.includes(description)
    );
  };

  const visibleThoughts =
    Array.isArray(event.thoughts)
      ? event.thoughts.filter(
          thought =>
            typeof thought === 'string' &&
            thought.trim() &&
            !isRedundantDetail(thought)
        )
      : [];

  const visibleFacts =
    Array.isArray(event.facts)
      ? event.facts.filter(
          fact =>
            typeof fact === 'string' &&
            fact.trim() &&
            !isRedundantDetail(fact)
        )
      : [];

  const visibleActions =
    Array.isArray(event.actions)
      ? event.actions.filter(
          action =>
            typeof action === 'string' &&
            action.trim() &&
            !isRedundantDetail(action)
        )
      : [];

  return (
    <View style={styles.eventDetails}>
      {event.date_reference && (
        <Text style={styles.detail}>
          🕐 {event.date_reference}
        </Text>
      )}

      {event.context && (
        <Text style={styles.detail}>
          📍 {event.context}
        </Text>
      )}

      {event.people.length > 0 && (
        <Text style={styles.detail}>
          👤 {event.people.join(', ')}
        </Text>
      )}

      {event.places.length > 0 && (
        <Text style={styles.detail}>
          📌 {event.places.join(', ')}
        </Text>
      )}

      {event.subjects.length > 0 && (
        <Text style={styles.detail}>
          🎯 {event.subjects.join(', ')}
        </Text>
      )}

      {visibleThoughts.length > 0 && (
        <Text style={styles.detail}>
          💭 {visibleThoughts.join(' ; ')}
        </Text>
      )}

      {visibleActions.length > 0 && (
        <Text style={styles.detail}>
          🔨 {visibleActions.join(' ; ')}
        </Text>
      )}

      {event.intentions.length > 0 && (
        <Text style={styles.detail}>
          📋 {event.intentions.join(' ; ')}
        </Text>
      )}

      {event.objects.length > 0 && (
        <Text style={styles.detail}>
          📦 {event.objects.join(', ')}
        </Text>
      )}

      {visibleFacts.length > 0 && (
        <Text style={styles.detail}>
          ℹ️ {visibleFacts.join(' ; ')}
        </Text>
      )}

      {validRelations.length > 0 && (
        <Text style={styles.detail}>
          🔗{' '}
          {validRelations
            .map(
              relation =>
                `${relation.from} ${relation.relation} ${relation.to}`
            )
            .join(' ; ')}
        </Text>
      )}

      {event.was_corrected &&
        changeHistory.length > 0 && (
          <View style={styles.correctionContainer}>
            <Text style={styles.correctionTitle}>
              🔄 Modification
            </Text>

            {changeHistory.map(
              (change, index) => (
                <Text
                  key={`${event.id}_change_${index}`}
                  style={styles.correctionText}
                >
                  {change}
                </Text>
              )
            )}
          </View>
        )}
    </View>
  );
}


/* ========================================================= */
/* EXTRACTION HEURE                                         */
/* ========================================================= */

function getCorrectionTime(
  value:
    | string
    | {
        start: string;
        end: string | null;
      }
    | undefined
): string {
  if (
    typeof value === 'string'
  ) {
    return value.trim();
  }

  if (
    value &&
    typeof value.start === 'string'
  ) {
    return value.start.trim();
  }

  return '';
}

/* ========================================================= */
/* ÉCRAN                                                     */
/* ========================================================= */

export default function MemoryScreen() {
  const [
    souvenir,
    setSouvenir,
  ] = useState('');

  const [
    evenements,
    setEvenements,
  ] = useState<MemoryEvent[]>([]);

  const [
    expandedMemoryIds,
    setExpandedMemoryIds,
  ] = useState<Set<string>>(
    new Set()
  );

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    souvenirEnCours,
    setSouvenirEnCours,
  ] = useState(false);

  const [
    tempsTraitement,
    setTempsTraitement,
  ] = useState(0);

  const [
    tempsFinal,
    setTempsFinal,
  ] = useState<number | null>(null);

  const [
    etapeTraitement,
    setEtapeTraitement,
  ] = useState('');

  const [
    indexEtapeTraitement,
    setIndexEtapeTraitement,
  ] = useState(0);

  const [
    conflit,
    setConflit,
  ] = useState<Conflict | null>(
    null
  );

  const [
    correctionModalVisible,
    setCorrectionModalVisible,
  ] = useState(false);

  const [
    correctionText,
    setCorrectionText,
  ] = useState('');

  /*
   * Nouvelle gestion des ambiguïtés.
   *
   * Lorsque le serveur trouve plusieurs mémoires
   * pouvant correspondre à une correction, on ne choisit
   * plus arbitrairement la première.
   */

  const [
    memoriesCandidates,
    setMemoriesCandidates,
  ] = useState<MemoryEvent[]>([]);

  const [
    ambiguityModalVisible,
    setAmbiguityModalVisible,
  ] = useState(false);

  const [
    ambiguityMessage,
    setAmbiguityMessage,
  ] = useState('');

  const [
    pendingCorrection,
    setPendingCorrection,
  ] = useState<{
    correction: NonNullable<
      MemoryInput['correction_request']
    >;
    inputText: string;
  } | null>(null);

    const [
    dateConfirmation,
    setDateConfirmation,
  ] = useState<
    NonNullable<
      MemoryInput['date_confirmation']
    > | null
  >(null);

/* ======================================================= */
/* CONTRÔLE REQUÊTE                                       */
/* ======================================================= */

const abortControllerRef =
  useRef<AbortController | null>(
    null);

const requestIdRef =
  useRef(0);

const processingStartTimeRef =
  useRef<number | null>(
    null);

const tempsTraitementCumuleRef =
  useRef(0);

/* ======================================================= */
/* CHRONOMÈTRE                                             */
/* ======================================================= */

useEffect(() => {
  if (!souvenirEnCours) {
    return;
  }

  const debut =
    processingStartTimeRef.current ??
    Date.now();

  processingStartTimeRef.current =
    debut;

  const interval =
    setInterval(() => {
      const secondesPhase =
        (Date.now() - debut) /
        1000;

      const secondesTotal =
        tempsTraitementCumuleRef.current +
        secondesPhase;

      setTempsTraitement(
        secondesTotal
      );
    }, 100);

  return () =>
    clearInterval(interval);
}, [
  souvenirEnCours,
]);

  /* ======================================================= */
  /* PROGRESSION                                             */
  /* ======================================================= */

  useEffect(() => {
    if (!souvenirEnCours) {
      return;
    }

    setIndexEtapeTraitement(0);

    setEtapeTraitement(
      MEMORY_PROCESSING_STEPS[0]
    );

    const interval =
      setInterval(() => {
        setIndexEtapeTraitement(
          current => {
            const next =
              Math.min(
                current + 1,
                MEMORY_PROCESSING_STEPS.length - 2
              );

            setEtapeTraitement(
              MEMORY_PROCESSING_STEPS[next]
            );

            return next;
          }
        );
      }, 1800);

    return () =>
      clearInterval(interval);
  }, [
    souvenirEnCours,
  ]);

  /* ======================================================= */
  /* CHARGEMENT                                              */
  /* ======================================================= */

  useEffect(() => {
    const loadMemory =
      async () => {
        try {
          const saved =
            await AsyncStorage.getItem(
              STORAGE_KEY
            );

          if (saved) {
            const parsed =
              JSON.parse(saved);

            const seen =
              new Set<string>();

            const cleaned =
              Array.isArray(parsed)
                ? parsed.map(
                    (
                      event: MemoryEvent
                    ) => {
                      let id =
                        event.id;

                      if (
                        !id ||
                        seen.has(id)
                      ) {
                        id =
                          createUniqueMemoryId();
                      }

                      seen.add(id);

                      const validRelations =
                        Array.isArray(
                          event.relations
                        )
                          ? event.relations.filter(
                              relation =>
                                relation &&
                                typeof relation.from === 'string' &&
                                relation.from.trim() &&
                                typeof relation.relation === 'string' &&
                                relation.relation.trim() &&
                                typeof relation.to === 'string' &&
                                relation.to.trim()
                            )
                          : [];

                      const validChangeHistory =
                        Array.isArray(
                          event.change_history
                        )
                          ? event.change_history
                          : [];

                      return {
                        ...event,
                        id,
                        relations:
                          validRelations,
                        change_history:
                          validChangeHistory,
                      };
                    }
                  )
                : [];

            setEvenements(
              cleaned
            );
          }
        } catch (error) {
          console.log(
            '❌ Erreur de chargement de la mémoire :',
            error
          );
        } finally {
          setLoading(false);
        }
      };

    loadMemory();
  }, []);

  /* ======================================================= */
  /* SAUVEGARDE                                              */
  /* ======================================================= */

  useEffect(() => {
    if (loading) {
      return;
    }

    const saveMemory =
      async () => {
        try {
          await AsyncStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(
              evenements
            )
          );
        } catch (error) {
          console.log(
            '❌ Erreur de sauvegarde :',
            error
          );
        }
      };

    saveMemory();
  }, [
    evenements,
    loading,
  ]);

  /* ======================================================= */
  /* ENREGISTREMENT                                          */
  /* ======================================================= */

  const enregistrerNouvelEvenement =
    (
      nouvelEvenement: MemoryEvent
    ) => {
      setEvenements(
        current => [
          nouvelEvenement,
          ...current,
        ]
      );
    };
    
    const toggleMemoryExpanded =
      (
        eventId: string
      ) => {
        setExpandedMemoryIds(
          current => {
            const next =
              new Set(current);

            if (
              next.has(eventId)
            ) {
              next.delete(eventId);
            } else {
              next.add(eventId);
            }

            return next;
          }
        );
      };

  /* ======================================================= */
  /* ANNULATION                                              */
  /* ======================================================= */

  const annulerSouviensToi =
    () => {
      if (!souvenirEnCours) {
        return;
      }

      requestIdRef.current += 1;

      if (
        abortControllerRef.current
      ) {
        abortControllerRef.current.abort();
        abortControllerRef.current =
          null;
      }

      setSouvenirEnCours(false);
      setTempsFinal(null);
      setTempsTraitement(0);
      processingStartTimeRef.current =
        null;
      setEtapeTraitement(
        '↩️ Enregistrement annulé'
      );
    };

  /* ======================================================= */
  /* APPLICATION CORRECTION SERVEUR                         */
  /* ======================================================= */

const appliquerCorrectionServeur =
  (
    existingEvent: MemoryEvent,
    correction: NonNullable<
      MemoryInput['correction_request']
    >
  ) => {
    const correctedMemory =
      correction.new_memory || {};

    const oldDescription =
      existingEvent.description;

    const newDescription =
      correctedMemory.description ||
      correction.new_description ||
      existingEvent.description;

    const newDateReference =
      correctedMemory.date_reference ||
      existingEvent.date_reference;

    const correctedEvent: MemoryEvent = {
      ...existingEvent,

      id:
        existingEvent.id,

      description:
        newDescription,

      source_text:
        correctedMemory.source_text ||
        existingEvent.source_text,

      date_reference:
        newDateReference,

      date_precision:
        correctedMemory.date_precision ||
        existingEvent.date_precision,

      temporal_direction:
        correctedMemory.temporal_direction ||
        existingEvent.temporal_direction ||
        '',

      ...(correctedMemory.calendar_date
        ? {
            calendar_date:
              correctedMemory.calendar_date,
          }
        : existingEvent.calendar_date
          ? {
              calendar_date:
                existingEvent.calendar_date,
            }
          : {}),

      ...(correctedMemory.date_confirmation
        ? {
            date_confirmation:
              correctedMemory.date_confirmation,
          }
        : existingEvent.date_confirmation
          ? {
              date_confirmation:
                existingEvent.date_confirmation,
            }
          : {}),

      people:
        Array.isArray(
          correctedMemory.people
        )
          ? correctedMemory.people
          : existingEvent.people,

      places:
        Array.isArray(
          correctedMemory.places
        )
          ? correctedMemory.places
          : existingEvent.places,

      objects:
        Array.isArray(
          correctedMemory.objects
        )
          ? correctedMemory.objects
          : existingEvent.objects,

      subjects:
        Array.isArray(
          correctedMemory.subjects
        )
          ? correctedMemory.subjects
          : existingEvent.subjects,

      thoughts:
        Array.isArray(
          correctedMemory.thoughts
        )
          ? correctedMemory.thoughts
          : existingEvent.thoughts,

      actions:
        Array.isArray(
          correctedMemory.actions
        )
          ? correctedMemory.actions
          : existingEvent.actions,

      intentions:
        Array.isArray(
          correctedMemory.intentions
        )
          ? correctedMemory.intentions
          : existingEvent.intentions,

      context:
        correctedMemory.context ??
        existingEvent.context,

      facts:
        Array.isArray(
          correctedMemory.facts
        )
          ? correctedMemory.facts
          : existingEvent.facts,

      relations:
        Array.isArray(
          correctedMemory.relations
        )
          ? correctedMemory.relations
              .filter(
                relation =>
                  relation &&
                  typeof relation.from === 'string' &&
                  relation.from.trim() &&
                  typeof relation.relation === 'string' &&
                  relation.relation.trim() &&
                  typeof relation.to === 'string' &&
                  relation.to.trim()
              )
              .map(
                relation => ({
                  from:
                    relation.from.trim(),
                  relation:
                    relation.relation.trim(),
                  to:
                    relation.to.trim(),
                })
              )
          : existingEvent.relations,

      corrected:
        true,

      was_corrected:
        true,

      previous_description:
        oldDescription,

      change_history:
        Array.isArray(
          correctedMemory.change_history
        )
          ? correctedMemory.change_history as ChangeHistoryEntry[]
          : [
              ...(Array.isArray(
                existingEvent.change_history
              )
                ? existingEvent.change_history
                : []),
              {
                type:
                  correction.type ||
                  'correction',

                old_description:
                  oldDescription,

                new_description:
                  newDescription,

                old_value:
                  correction.old_value,

                new_value:
                  correction.new_value,

                old_time:
                  getCorrectionTime(
                    correction.old_time
                  ),

                new_time:
                  getCorrectionTime(
                    correction.new_time
                  ),

                message:
                  correction.message ||
                  'Information corrigée.',

                corrected_at:
                  new Date().toISOString(),
              },
            ],

      ...(correctedMemory.correction_note
        ? {
            correction_note:
              correctedMemory.correction_note,
          }
        : {}),

      ...(correctedMemory.correction_type
        ? {
            correction_type:
              correctedMemory.correction_type,
          }
        : {}),

      ...(correctedMemory.corrected_person
        ? {
            corrected_person:
              correctedMemory.corrected_person,
          }
        : {}),

      ...(correctedMemory.corrected_old_value !==
        undefined
        ? {
            corrected_old_value:
              correctedMemory.corrected_old_value,
          }
        : {}),

      ...(correctedMemory.corrected_new_value !==
        undefined
        ? {
            corrected_new_value:
              correctedMemory.corrected_new_value,
          }
        : {}),

      ...(correctedMemory.corrected_old_time !==
        undefined
        ? {
            corrected_old_time:
              correctedMemory.corrected_old_time,
          }
        : {}),

      ...(correctedMemory.corrected_new_time !==
        undefined
        ? {
            corrected_new_time:
              correctedMemory.corrected_new_time,
          }
        : {}),
    };

    setEvenements(
      current =>
        current.map(
          event =>
            event.id ===
            existingEvent.id
              ? correctedEvent
              : event
        )
    );

    setEtapeTraitement(
      '✅ Mémoire corrigée et enregistrée'
    );

    setTempsFinal(
      null
    );

    setSouvenir('');
  };
  /* ======================================================= */
  /* ACCEPTATION CORRECTION LOCALE                          */
  /* ======================================================= */

  const accepterCorrection =
    (conflict: Conflict) => {
      const corrected =
        buildCorrectedMemory(
          conflict.existingEvent,
          conflict.newEvent
        );

      setEvenements(
        current =>
          current.map(
            event =>
              event.id ===
              conflict.existingEvent.id
                ? corrected
                : event
          )
      );

      setConflit(null);

      setEtapeTraitement(
        '✅ Mémoire corrigée et mise à jour'
      );

      setSouvenir('');
    };

  /* ======================================================= */
  /* REFUS CORRECTION                                       */
  /* ======================================================= */

  const refuserCorrection =
    () => {
      if (!conflit) {
        return;
      }

      setCorrectionText(
        souvenir ||
        conflit.newEvent.source_text ||
        ''
      );

      setConflit(null);

      setCorrectionModalVisible(
        true
      );

      setEtapeTraitement(
        '✏️ Corrigez votre souvenir puis relancez Souviens-toi'
      );
    };

  /* ======================================================= */
  /* PROPOSITION CORRECTION LOCALE                          */
  /* ======================================================= */

  const proposerCorrection =
    (
      conflict: Conflict
    ) => {
      setConflit(
        conflict
      );

      setSouvenirEnCours(
        false
      );

      const oldLocation =
        getLocation(
          conflict.existingEvent
        );

      const newLocation =
        getLocation(
          conflict.newEvent
        );

      const oldTime =
        getWorkTimeRange(
          conflict.existingEvent
        );

      const newTime =
        getWorkTimeRange(
          conflict.newEvent
        );

      const person =
        getPerson(
          conflict.newEvent
        );

      const days =
        getDays(
          conflict.newEvent
        );

      const dayLabel =
        days.length === 1
          ? days[0]
          : days.join(', ');

      let message = '';

      if (
        oldTime &&
        newTime
      ) {
        message =
          `${person
            .charAt(0)
            .toUpperCase() +
            person.slice(1)} travaille à ${oldLocation} ` +
          `le ${dayLabel} avec l'horaire ${oldTime.text}, ` +
          `mais votre nouvelle information indique ${newTime.text}.`;
      } else if (
        newTime
      ) {
        message =
          `${person
            .charAt(0)
            .toUpperCase() +
            person.slice(1)} travaille à ${newLocation} ` +
          `le ${dayLabel}, mais aucun horaire n'était enregistré. ` +
          `Votre nouvelle information indique ${newTime.text}.`;
      } else {
        message =
          `${person
            .charAt(0)
            .toUpperCase() +
            person.slice(1)} travaille à ${oldLocation} ` +
          `le ${dayLabel}, mais votre nouvelle information apporte une information différente.`;
      }

      setEtapeTraitement(
        '⚠️ Moment a détecté une information différente pour la même situation'
      );

      if (
        Platform.OS === 'web'
      ) {
        const confirmation =
          window.confirm(
            `⚠️ Information différente\n\n${message}\n\n` +
            `Voulez-vous remplacer l'ancienne information par la nouvelle ?`
          );

        if (
          confirmation
        ) {
          accepterCorrection(
            conflict
          );
        } else {
          refuserCorrection();
        }

        return;
      }

      Alert.alert(
        '⚠️ Information différente',
        message,
        [
          {
            text:
              'Pas OK',
            style:
              'cancel',
            onPress:
              refuserCorrection,
          },
          {
            text:
              'OK',
            onPress:
              () =>
                accepterCorrection(
                  conflict
                ),
          },
        ]
      );
    };

  /* ======================================================= */
  /* AMBIGUÏTÉ SERVEUR                                     */
  /* ======================================================= */

  const ouvrirAmbiguiteCorrection =
    (
      correction: NonNullable<
        MemoryInput['correction_request']
      >,
      inputText: string
    ) => {
      const ids =
        Array.isArray(
          correction.event_ids
        )
          ? correction.event_ids
          : [];

      const memories =
        Array.isArray(
          correction.memories
        )
          ? correction.memories
          : [];

      const candidateIds =
        new Set(
          ids
        );

      const candidates =
        evenements.filter(
          event =>
            candidateIds.has(
              event.id
            )
        );

      const candidatesFromDescriptions =
        memories
          .map(
            memory =>
              evenements.find(
                event =>
                  event.id ===
                  memory.id
              )
          )
          .filter(
            (
              event
            ): event is MemoryEvent =>
              !!event
          );

      const combined =
        [
          ...candidates,
          ...candidatesFromDescriptions,
        ].filter(
          (
            event,
            index,
            array
          ) =>
            array.findIndex(
              candidate =>
                candidate.id ===
                event.id
            ) === index
        );

      if (
        combined.length === 1
      ) {
        appliquerCorrectionServeur(
          combined[0],
          correction
        );

        return;
      }

      setMemoriesCandidates(
        combined
      );

      setPendingCorrection({
        correction,
        inputText,
      });

      setAmbiguityMessage(
        correction.message ||
        'Moment a trouvé plusieurs souvenirs pouvant correspondre à cette correction. Choisissez celui que vous souhaitez modifier.'
      );

      setAmbiguityModalVisible(
        true
      );

      setSouvenirEnCours(
        false
      );
    };

  /* ======================================================= */
  /* CHOIX MÉMOIRE AMBIGUË                                  */
  /* ======================================================= */

  const choisirMemoireCorrection =
    (
      event: MemoryEvent
    ) => {
      if (
        !pendingCorrection
      ) {
        return;
      }

      console.log(
        '🎯 Mémoire sélectionnée pour correction :',
        event
      );

      const correction =
        pendingCorrection.correction;

      setAmbiguityModalVisible(
        false
      );

      setMemoriesCandidates(
        []
      );

      setPendingCorrection(
        null
      );

      appliquerCorrectionServeur(
        event,
        correction
      );
    };

  /* ======================================================= */
  /* ANNULATION AMBIGUÏTÉ                                   */
  /* ======================================================= */

  const annulerAmbiguite =
    () => {
      setAmbiguityModalVisible(
        false
      );

      setMemoriesCandidates(
        []
      );

      setPendingCorrection(
        null
      );

      setEtapeTraitement(
        '✏️ Aucune mémoire n’a été modifiée'
      );
    };

  /* ======================================================= */
  /* ANALYSE                                                */
  /* ======================================================= */

  const analyserSouvenir =
  async (
    texte: string,
    confirmedCalendarDate?: string
  ) => {
      if (
        !texte.trim()
      ) {
        return;
      }

      const requestId =
        ++requestIdRef.current;

      const abortController =
        new AbortController();

      abortControllerRef.current =
        abortController;

      const debut =
        processingStartTimeRef.current ??
        Date.now();

      processingStartTimeRef.current =
        debut;

      setSouvenirEnCours(
        true
      );

      setTempsFinal(
        null
      );

      setTempsTraitement(
        0
      );

      setIndexEtapeTraitement(
        0
      );

      setEtapeTraitement(
        MEMORY_PROCESSING_STEPS[0]
      );

      try {
        const response =
          await fetch(
            `${SERVER_URL}/understand`,
            {
              method:
                'POST',

              headers: {
                'Content-Type':
                  'application/json',
              },

body:
  JSON.stringify({
    text:
      texte.trim(),

    memories:
      evenements,

    confirmed_calendar_date:
      confirmedCalendarDate || '',
  }),

              signal:
                abortController.signal,
            }
          );

        if (
          requestId !==
          requestIdRef.current
        ) {
          return;
        }

if (
  !response.ok
) {
  let errorData: {
    error?: string;
    code?: string;
    message?: string;
  } = {};

  try {
    errorData =
      await response.json();
  } catch {
    // Le serveur n'a pas renvoyé de JSON exploitable.
  }

  if (
    errorData.code ===
    'OPENAI_CREDIT_EXHAUSTED'
  ) {
    throw new Error(
      'OPENAI_CREDIT_EXHAUSTED'
    );
  }

  if (
    errorData.code ===
    'OPENAI_RATE_LIMIT'
  ) {
    throw new Error(
      'OPENAI_RATE_LIMIT'
    );
  }

  throw new Error(
    errorData.message ||
      errorData.error ||
      `Serveur Moment : ${response.status}`
  );
}
        setIndexEtapeTraitement(
          2
        );

        setEtapeTraitement(
          MEMORY_PROCESSING_STEPS[2]
        );

        const data:
          MemoryInput =
          await response.json();

        if (
          requestId !==
          requestIdRef.current
        ) {
          return;
        }

         /* =================================================== */
        /* CONFIRMATION DE DATE                                */
        /* =================================================== */

        if (
          data.date_confirmation?.required
        ) {
          console.log(
            '📅 CONFIRMATION DE DATE DEMANDÉE :',
            data.date_confirmation
          );

setSouvenirEnCours(
  false
);

const dureePhase =
  (Date.now() - debut) /
  1000;

tempsTraitementCumuleRef.current +=
  dureePhase;

setTempsFinal(
  tempsTraitementCumuleRef.current
);

/*
 * Le traitement est terminé pour cette étape.
 * Le temps d'attente de la confirmation utilisateur
 * ne doit pas être compté dans le temps de traitement.
 */
processingStartTimeRef.current =
  null;

/*
 * On transmet la demande de confirmation à
 * l'interface sans enregistrer le souvenir.
 *
 * Le souvenir ne doit être ajouté à la mémoire
 * qu'après confirmation explicite de l'utilisateur.
 */

          setDateConfirmation(
            data.date_confirmation
          );

          return;
        }

        /* =================================================
         * CORRECTION SERVEUR
         * ================================================= */

        if (
          data.correction_request?.detected
        ) {
          const correction =
            data.correction_request;

          const eventIds =
            Array.isArray(
              correction.event_ids
            )
              ? correction.event_ids.filter(
                  id =>
                    typeof id === 'string' &&
                    id.trim()
                )
              : [];

          const memoryCandidates =
            Array.isArray(
              correction.memories
            )
              ? correction.memories
              : [];

          /*
           * Si le serveur a explicitement indiqué
           * plusieurs possibilités, on demande à
           * l'utilisateur de choisir.
           */

          if (
            correction.ambiguous ||
            correction.requires_selection ||
            eventIds.length > 1 ||
            memoryCandidates.length > 1
          ) {
            setSouvenirEnCours(
              false
            );

            ouvrirAmbiguiteCorrection(
              correction,
              texte
            );

            return;
          }

          /*
           * Une seule mémoire explicitement identifiée.
           */

          let eventId =
            eventIds[0] ||
            correction.old_memory?.id ||
            '';

          /*
           * Si aucun ID n'est fourni mais que le serveur
           * fournit une seule mémoire candidate, on utilise
           * cette mémoire.
           */

          if (
            !eventId &&
            memoryCandidates.length === 1
          ) {
            eventId =
              memoryCandidates[0].id;
          }

          const existingEvent =
            eventId
              ? evenements.find(
                  event =>
                    event.id ===
                    eventId
                )
              : undefined;

          if (
            !existingEvent
          ) {
            /*
             * Si Moment ne peut pas identifier avec certitude
             * la mémoire à modifier, surtout ne pas modifier
             * arbitrairement un souvenir.
             */

            if (
              memoryCandidates.length > 0 ||
              eventIds.length > 0
            ) {
              ouvrirAmbiguiteCorrection(
                correction,
                texte
              );

              return;
            }

            throw new Error(
              'Moment n’a pas identifié la mémoire à corriger'
            );
          }

          setIndexEtapeTraitement(
            3
          );

          setEtapeTraitement(
            '💾 J’enregistre la correction...'
          );

          appliquerCorrectionServeur(
            existingEvent,
            correction
          );

          const duree =
            (Date.now() -
              debut) /
            1000;

          setTempsFinal(
            duree
          );

          setSouvenir('');

          return;
        }

        /* =================================================
         * NOUVEAUX ÉVÉNEMENTS
         * ================================================= */

        const nouveauxEvenements =
          (
            data.events ||
            []
          ).map(
            event =>
              normalizeEvent(
                event,
                texte
              )
          );

        if (
          nouveauxEvenements.length ===
          0
        ) {
          throw new Error(
            'Moment n’a produit aucun événement'
          );
        }

        /* =================================================
         * CONTRÔLE CONFLITS
         * ================================================= */

        for (
          const nouvelEvenement of
            nouveauxEvenements
        ) {
          if (
            requestId !==
            requestIdRef.current
          ) {
            return;
          }

          const conflict =
            findConflict(
              evenements,
              nouvelEvenement
            );

          if (
            conflict
          ) {
            setSouvenirEnCours(
              false
            );

            const duree =
              (Date.now() -
                debut) /
              1000;

            setTempsFinal(
              duree
            );

            proposerCorrection(
              conflict
            );

            return;
          }
        }

        if (
          requestId !==
          requestIdRef.current
        ) {
          return;
        }

        setIndexEtapeTraitement(
          3
        );

        setEtapeTraitement(
          MEMORY_PROCESSING_STEPS[3]
        );

        await new Promise(
          resolve =>
            setTimeout(
              resolve,
              350
            )
        );

        if (
          requestId !==
          requestIdRef.current
        ) {
          return;
        }

const dureePhase =
  (Date.now() -
    debut) /
  1000;

const duree =
  tempsTraitementCumuleRef.current +
  dureePhase;

tempsTraitementCumuleRef.current =
  duree;

for (
  const nouvelEvenement of
    nouveauxEvenements
) {
  if (
    requestId !==
    requestIdRef.current
  ) {
    return;
  }

  enregistrerNouvelEvenement({
    ...nouvelEvenement,
    processing_time:
      duree,
  });
}

setSouvenir('');

setTempsFinal(
  duree
);

setEtapeTraitement(
  '✅ Souvenir enregistré dans la mémoire de Moment'
);

processingStartTimeRef.current =
  null;

tempsTraitementCumuleRef.current =
  0;


      } catch (error) {
        if (
          error instanceof Error &&
          error.name ===
            'AbortError'
        ) {
          return;
        }

        if (
          requestId !==
          requestIdRef.current
        ) {
          return;
        }

console.log(
  '❌ Impossible de contacter Moment :',
  error
);

const duree =
  (Date.now() -
    debut) /
  1000;

setTempsFinal(
  duree
);

let messageErreur =
  '❌ Moment n’a pas pu enregistrer ce souvenir';

if (
  error instanceof Error &&
  error.message ===
    'OPENAI_CREDIT_EXHAUSTED'
) {
  messageErreur =
    '⚠️ Crédit API OpenAI épuisé. Moment ne peut plus analyser de nouveaux souvenirs.';

  if (
    Platform.OS === 'web'
  ) {
    window.alert(
      'Crédit API OpenAI épuisé.\n\nMoment ne peut plus analyser de nouveaux souvenirs tant que le crédit API n’a pas été rechargé.'
    );
  } else {
    Alert.alert(
      'Crédit API OpenAI épuisé',
      'Moment ne peut plus analyser de nouveaux souvenirs tant que le crédit API n’a pas été rechargé.'
    );
  }
}

if (
  error instanceof Error &&
  error.message ===
    'OPENAI_RATE_LIMIT'
) {
  messageErreur =
    '⏳ Limite API OpenAI atteinte. Réessayez dans quelques instants.';
}

setEtapeTraitement(
  messageErreur
);
      } finally {
        if (
          requestId ===
          requestIdRef.current
        ) {
          setSouvenirEnCours(
            false
          );

          if (
            abortControllerRef.current ===
            abortController
          ) {
            abortControllerRef.current =
              null;
          }
        }
      }
    };

  /* ======================================================= */
  /* BOUTON                                                  */
  /* ======================================================= */

const souviensToi =
  async () => {
    if (
      !souvenir.trim() ||
      souvenirEnCours
    ) {
      return;
    }

    await analyserSouvenir(
      souvenir.trim()
    );
  };

  /* ======================================================= */
  /* VALIDATION CORRECTION                                  */
  /* ======================================================= */

  const validerCorrection =
    async () => {
      const texte =
        correctionText.trim();

      if (!texte) {
        return;
      }

      setCorrectionModalVisible(
        false
      );

      setSouvenir(
        texte
      );

      await analyserSouvenir(
        texte
      );
    };

const confirmerDate =
  async () => {
    if (
      !dateConfirmation ||
      !dateConfirmation.proposed_date
    ) {
      return;
    }

    const texte =
      dateConfirmation.source_text?.trim();

    const confirmedDate =
      dateConfirmation.proposed_date;

    if (!texte) {
      setDateConfirmation(
        null
      );

      processingStartTimeRef.current =
        null;

      return;
    }

setDateConfirmation(
  null
);

/*
 * La première phase a déjà été ajoutée
 * à tempsTraitementCumuleRef.
 *
 * On démarre maintenant une nouvelle phase
 * de traitement, sans compter le temps passé
 * à attendre la confirmation de l'utilisateur.
 */
processingStartTimeRef.current =
  Date.now();

setSouvenir(
  texte
);

await analyserSouvenir(
  texte,
  confirmedDate
);

  };
  /* ======================================================= */
  /* OUBLIER                                                 */
  /* ======================================================= */

  const oublierSouvenir =
    (
      eventId: string
    ) => {
      const supprimer =
        () => {
          setEvenements(
            current =>
              current.filter(
                event =>
                  event.id !==
                  eventId
              )
          );
        };

      if (
        Platform.OS === 'web'
      ) {
        const confirmation =
          window.confirm(
            'Ce souvenir sera supprimé de la mémoire de Moment. Cette action est irréversible.'
          );

        if (
          confirmation
        ) {
          supprimer();
        }

        return;
      }

      Alert.alert(
        'Oublier ce souvenir ?',
        'Cette information sera supprimée de la mémoire de Moment. Cette action est irréversible.',
        [
          {
            text:
              'Annuler',
            style:
              'cancel',
          },
          {
            text:
              'Oublier',
            style:
              'destructive',
            onPress:
              supprimer,
          },
        ]
      );
    };

  /* ======================================================= */
  /* EFFACER MÉMOIRE                                        */
  /* ======================================================= */

  const effacerMemoire =
    async () => {
      const supprimer =
        async () => {
          try {
            await AsyncStorage.removeItem(
              STORAGE_KEY
            );

            setEvenements([]);
            setSouvenir('');

            if (
              Platform.OS ===
              'web'
            ) {
              window.alert(
                'Mémoire effacée'
              );
            } else {
              Alert.alert(
                'Mémoire effacée',
                'Tous les souvenirs ont été supprimés.'
              );
            }
          } catch (error) {
            console.log(
              '❌ Erreur lors de l’effacement :',
              error
            );
          }
        };

      if (
        Platform.OS ===
        'web'
      ) {
        const confirmation =
          window.confirm(
            'Tous les souvenirs enregistrés sur cet appareil seront supprimés. Cette action est irréversible.'
          );

        if (
          confirmation
        ) {
          await supprimer();
        }

        return;
      }

      Alert.alert(
        'Effacer la mémoire',
        'Tous les souvenirs enregistrés sur cet appareil seront supprimés. Cette action est irréversible.',
        [
          {
            text:
              'Annuler',
            style:
              'cancel',
          },
          {
            text:
              'Effacer',
            style:
              'destructive',
            onPress:
              supprimer,
          },
        ]
      );
    };
/* ======================================================= */
/* AFFICHAGE                                               */
/* ======================================================= */

return (
  <View
    style={
      styles.container
    }
  >
    <ScrollView
      contentContainerStyle={
        styles.content
      }
      keyboardShouldPersistTaps="handled"
    >
      <View
        style={
          styles.header
        }
      >
        <Text
          style={
            styles.logo
          }
        >
          {APP_NAME}
        </Text>

        <View
          style={
            styles.versionContainer
          }
        >
          <Text
            style={
              styles.version
            }
          >
            {APP_VERSION}
          </Text>
        </View>

        <Text
          style={
            styles.subtitle
          }
        >
          {APP_TAGLINE}
        </Text>

        <Image
          source={require(
            '../../assets/images/moment-memory-banner.png'
          )}
          style={
            styles.memoryBanner
          }
          resizeMode="cover"
        />
      </View>

      <View
        style={
          styles.memoryInputContainer
        }
      >
        <TextInput
          style={[
            styles.input,
            souvenirEnCours && {
              opacity: 0.3,
            },
          ]}
          placeholder={
            MEMORY_PLACEHOLDER
          }
          placeholderTextColor="#999999"
          value={
            souvenir
          }
          onChangeText={
            setSouvenir
          }
          multiline
          editable={
            !souvenirEnCours
          }
        />

        {souvenir.length >
          0 &&
          !souvenirEnCours && (
            <Pressable
              style={
                styles.clearMemoryInputButton
              }
              onPress={() =>
                setSouvenir('')
              }
            >
              <Text
                style={
                  styles.clearMemoryInputText
                }
              >
                {
                  CLEAR_INPUT_LABEL
                }
              </Text>
            </Pressable>
          )}
      </View>

      <View
        style={
          styles.memoryActions
        }
      >
        <Pressable
          style={[
            styles.button,
            souvenirEnCours &&
              styles.cancelButton,
          ]}
          onPress={
            souvenirEnCours
              ? annulerSouviensToi
              : souviensToi
          }
        >
          <Text
            style={
              styles.buttonText
            }
          >
            {souvenirEnCours
              ? CANCEL_BUTTON
              : MEMORY_BUTTON}
          </Text>
        </Pressable>

        <Pressable
          style={
            styles.microButton
          }
          onPress={() => {}}
          disabled={
            souvenirEnCours
          }
        >
          <Text
            style={
              styles.microIcon
            }
          >
            🎙️
          </Text>
        </Pressable>
      </View>

      {souvenirEnCours && (
        <View
          style={
            styles.processingContainer
          }
        >
          <Text
            style={
              styles.thinkingTitle
            }
          >
            🧠 Moment réfléchit…
          </Text>

          <Text
            style={[
              styles.processingText,
              {
                width: '100%',
                textAlign: 'center',
              },
            ]}
          >
            {
              etapeTraitement
            }
          </Text>

          <Text
            style={
              styles.processingTime
            }
          >
            ⏱️ Temps de traitement :{' '}
            {tempsTraitement.toFixed(
              1
            )}{' '}
            s
          </Text>
        </View>
      )}

      <Pressable
        style={
          styles.clearMemoryButton
        }
        onPress={
          effacerMemoire
        }
        disabled={
          souvenirEnCours
        }
      >
        <Text
          style={
            styles.clearMemoryButtonText
          }
        >
          {
            CLEAR_MEMORY_LABEL
          }
        </Text>
      </Pressable>

      {!loading &&
        evenements.length >
          0 && (
          <View
            style={
              styles.memorySection
            }
          >
            <Text
              style={
                styles.memoryTitle
              }
            >
              {
                MEMORY_TITLE
              }
            </Text>

            {evenements.map(
              event => {
                const isExpanded =
                  expandedMemoryIds.has(
                    event.id
                  );

                return (
                  <View
                    style={
                      styles.memoryCard
                    }
                    key={
                      event.id
                    }
                  >
                    <Text
                      style={
                        styles.understoodLabel
                      }
                    >
                      🧠 Moment a compris
                    </Text>

                    <View
                      style={
                        styles.memorySummaryRow
                      }
                    >
                      <View
                        style={
                          styles.memorySummaryTextContainer
                        }
                      >
                        <Text
                          style={
                            styles.memoryText
                          }
                        >
                          {
                            event.description
                          }
                        </Text>
                      </View>

                      <Pressable
                        style={
                          styles.expandMemoryButton
                        }
                        onPress={() =>
                          toggleMemoryExpanded(
                            event.id
                          )
                        }
                      >
                        <Text
                          style={
                            styles.expandMemoryButtonText
                          }
                        >
                          {isExpanded
                            ? ' ▲ '
                            : ' ▼ '}
                        </Text>
                      </Pressable>
                    </View>

                    {isExpanded && (
                      <View
                        style={
                          styles.expandedMemory
                        }
                      >
                        <View
                          style={
                            styles.divider
                          }
                        />

                        <EventDetails
                          event={
                            event
                          }
                        />

                        {typeof event.processing_time ===
                          'number' && (
                          <Text
                            style={
                              styles.processingTimeMemory
                            }
                          >
                            ⏱️ Temps de traitement :{' '}
                            {event.processing_time.toFixed(
                              1
                            )}{' '}
                            s
                          </Text>
                        )}

                        <Pressable
                          style={
                            styles.forgetButton
                          }
                          onPress={() =>
                            oublierSouvenir(
                              event.id
                            )
                          }
                        >
                          <Text
                            style={
                              styles.forgetButtonText
                            }
                          >
                            {
                              FORGET_MEMORY_LABEL
                            }
                          </Text>
                        </Pressable>
                      </View>
                    )}
                  </View>
                );
              }
            )}
          </View>
        )}
    </ScrollView>

    {souvenirEnCours && (
      <View
        style={
          styles.fullScreenThinking
        }
        pointerEvents="none"
      >
        <MomentThinkingAnimation
          text={
            souvenir
          }
        />
      </View>
    )}

    {/* =================================================== */}
    {/* MODALE DE RESAISIE                                  */}
    {/* =================================================== */}

    <Modal
      visible={
        correctionModalVisible
      }
      transparent
      animationType="fade"
      onRequestClose={() =>
        setCorrectionModalVisible(
          false
        )
      }
    >
      <View
        style={
          styles.modalOverlay
        }
      >
        <View
          style={
            styles.modalContainer
          }
        >
          <Text
            style={
              styles.modalTitle
            }
          >
            ✏️ Corrigez votre souvenir
          </Text>

          <Text
            style={
              styles.modalDescription
            }
          >
            Moment a besoin d'une
            information corrigée avant
            de modifier votre mémoire.
          </Text>

          <TextInput
            style={
              styles.modalInput
            }
            value={
              correctionText
            }
            onChangeText={
              setCorrectionText
            }
            placeholder={
              MEMORY_PLACEHOLDER
            }
            placeholderTextColor="#999999"
            multiline
            autoFocus
          />

          <View
            style={
              styles.modalActions
            }
          >
            <Pressable
              style={
                styles.modalCancelButton
              }
              onPress={() => {
                setCorrectionModalVisible(
                  false
                );
              }}
            >
              <Text
                style={
                  styles.modalCancelText
                }
              >
                Annuler
              </Text>
            </Pressable>

            <Pressable
              style={
                styles.modalConfirmButton
              }
              onPress={
                validerCorrection
              }
            >
              <Text
                style={
                  styles.modalConfirmText
                }
              >
                Relancer
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>

    <Modal
      visible={
        dateConfirmation !== null
      }
      transparent
      animationType="fade"
      onRequestClose={() => {
        setDateConfirmation(
          null
        );
      }}
    >
      <View
        style={
          styles.modalOverlay
        }
      >
        <View
          style={
            styles.modalContainer
          }
        >
          <Text
            style={
              styles.modalTitle
            }
          >
            📅 Confirmer la date
          </Text>

          <Text
            style={
              styles.modalDescription
            }
          >
            {dateConfirmation?.message ||
              'Veux-tu confirmer cette date ?'}
          </Text>

          <View
            style={
              styles.modalActions
            }
          >
            <Pressable
              style={
                styles.modalCancelButton
              }
              onPress={() => {
                setDateConfirmation(
                  null
                );
              }}
            >
              <Text
                style={
                  styles.modalCancelText
                }
              >
                Annuler
              </Text>
            </Pressable>

            <Pressable
              style={
                styles.modalConfirmButton
              }
              onPress={
                confirmerDate
              }
            >
              <Text
                style={
                  styles.modalConfirmText
                }
              >
                Confirmer
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>

    {/* =================================================== */}
    {/* MODALE DE SÉLECTION D'UNE MÉMOIRE                   */}
    {/* =================================================== */}

    <Modal
      visible={
        ambiguityModalVisible
      }
      transparent
      animationType="fade"
      onRequestClose={
        annulerAmbiguite
      }
    >
      <View
        style={
          styles.modalOverlay
        }
      >
        <View
          style={
            styles.ambiguityModalContainer
          }
        >
          <Text
            style={
              styles.modalTitle
            }
          >
            🔎 Plusieurs souvenirs possibles
          </Text>

          <Text
            style={
              styles.modalDescription
            }
          >
            {ambiguityMessage}
          </Text>

          <ScrollView
            style={
              styles.candidateList
            }
            keyboardShouldPersistTaps="handled"
          >
            {memoriesCandidates.map(
              (event, index) => (
                <Pressable
                  key={
                    event.id
                  }
                  style={
                    styles.candidateButton
                  }
                  onPress={() =>
                    choisirMemoireCorrection(
                      event
                    )
                  }
                >
                  <Text
                    style={
                      styles.candidateNumber
                    }
                  >
                    {index + 1}
                  </Text>

                  <View
                    style={
                      styles.candidateContent
                    }
                  >
                    <Text
                      style={
                        styles.candidateDescription
                      }
                    >
                      {
                        event.description
                      }
                    </Text>

                    {event.date_reference && (
                      <Text
                        style={
                          styles.candidateDetail
                        }
                      >
                        🕐{' '}
                        {
                          event.date_reference
                        }
                      </Text>
                    )}

                    {event.people.length >
                      0 && (
                      <Text
                        style={
                          styles.candidateDetail
                        }
                      >
                        👤{' '}
                        {
                          event.people.join(
                            ', '
                          )
                        }
                      </Text>
                    )}

                    {event.places.length >
                      0 && (
                      <Text
                        style={
                          styles.candidateDetail
                        }
                      >
                        📍{' '}
                        {
                          event.places.join(
                            ', '
                          )
                        }
                      </Text>
                    )}
                  </View>
                </Pressable>
              )
            )}
          </ScrollView>

          <Pressable
            style={
              styles.modalCancelButton
            }
            onPress={
              annulerAmbiguite
            }
          >
            <Text
              style={
                styles.modalCancelText
              }
            >
              Annuler
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  </View>
);
}

/* ========================================================= */
/* STYLES                                                    */
/* ========================================================= */

const styles =
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#F7F5F2',
    },

    fullScreenThinking: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 5,
    },

    content: {
      flexGrow: 1,
      alignItems: 'center',
      padding: 25,
      paddingTop: 70,
      paddingBottom: 50,
    },

    header: {
      alignItems: 'center',
      width: '100%',
    },

    logo: {
      fontSize: 42,
      fontWeight: '700',
      textAlign: 'center',
      marginBottom: 0,
      letterSpacing: -1,
    },

    versionContainer: {
      width: '100%',
      maxWidth: 500,
      alignItems: 'flex-end',
      paddingRight: 55,
      marginTop: 2,
      marginBottom: 8,
    },

    version: {
      fontSize: 12,
      color: '#999999',
      fontWeight: '500',
    },

    subtitle: {
      fontSize: 17,
      color: '#666666',
      textAlign: 'center',
      lineHeight: 25,
      marginBottom: 30,
    },

    memoryBanner: {
      width: '100%',
      maxWidth: 500,
      height: 180,
      borderRadius: 24,
      marginBottom: 25,
    },

    memoryInputContainer: {
      width: '100%',
      maxWidth: 500,
      position: 'relative',
    },

    input: {
      width: '100%',
      minHeight: 160,
      backgroundColor: '#F8F7F4',
      borderRadius: 24,
      paddingHorizontal: 22,
      paddingTop: 20,
      paddingBottom: 20,
      paddingRight: 65,
      fontSize: 18,
      lineHeight: 27,
      color: '#24211D',
      textAlignVertical: 'top',
      borderWidth: 1,
      borderColor: '#E3DFD8',
    },

    clearMemoryInputButton: {
      position: 'absolute',
      right: 1,
      top: 1,
      bottom: 1,
      width: 48,
      backgroundColor: '#F0EFEC',
      borderTopRightRadius: 23,
      borderBottomRightRadius: 23,
      alignItems: 'center',
      justifyContent: 'center',
    },

    clearMemoryInputText: {
      fontSize: 23,
      color: '#888888',
      fontWeight: '400',
    },

    memoryActions: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      marginTop: 14,
      marginBottom: 12,
    },

    button: {
      backgroundColor: '#1F2937',
      paddingVertical: 16,
      paddingHorizontal: 45,
      borderRadius: 14,
      minWidth: 150,
      alignItems: 'center',
    },

    buttonDisabled: {
      opacity: 0.6,
    },

    cancelButton: {
      backgroundColor: '#B7791F',
    },

    buttonText: {
      color: '#FFFFFF',
      fontSize: 17,
      fontWeight: '600',
    },

    microButton: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: '#F8F7F4',
      borderWidth: 1,
      borderColor: '#E3DFD8',
      alignItems: 'center',
      justifyContent: 'center',
    },

    microIcon: {
      fontSize: 22,
    },

    /* ===================================================== */
    /* TRAITEMENT                                            */
    /* ===================================================== */

    processingContainer: {
      width: '100%',
      maxWidth: 500,
      marginTop: 4,
      marginBottom: 8,
      paddingHorizontal: 18,
      paddingVertical: 13,
      backgroundColor: '#F0EFEC',
      borderRadius: 14,
      borderWidth: 1,
      borderColor: '#E3DFD8',
    },

    processingHeader: {
      flexDirection: 'row',
      alignItems: 'center',
    },

    processingSpinner: {
      marginRight: 9,
    },

    processingText: {
      flex: 1,
      fontSize: 14,
      color: '#444444',
      lineHeight: 20,
    },

    thinkingTitle: {
      width: '100%',
      textAlign: 'center',
      fontSize: 15,
      color: '#6B7280',
      marginBottom: 6,
    },

    processingTime: {
      marginTop: 5,
      marginLeft: 25,
      fontSize: 12,
      color: '#888888',
    },

    /* ===================================================== */
    /* TEMPS DANS LA CARTE MÉMOIRE                           */
    /* ===================================================== */

    processingTimeMemory: {
      marginTop: 10,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: '#E5E1DC',
      fontSize: 13,
      color: '#888888',
    },

    clearMemoryButton: {
      marginTop: 4,
      paddingVertical: 12,
      alignItems: 'center',
    },

    clearMemoryButtonText: {
      fontSize: 14,
      color: '#999999',
    },

    /* ===================================================== */
    /* MA MÉMOIRE                                            */
    /* ===================================================== */

    memorySection: {
      width: '100%',
      maxWidth: 500,
      marginTop: 25,
    },

    memoryTitle: {
      fontSize: 21,
      fontWeight: '700',
      color: '#1F2937',
      marginBottom: 15,
    },

    memoryCard: {
      backgroundColor: '#FFFFFF',
      borderRadius: 18,
      padding: 20,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: '#E5E1DC',
    },

    understoodLabel: {
      fontSize: 15,
      fontWeight: '700',
      color: '#1F2937',
      marginBottom: 10,
    },

    memoryText: {
      fontSize: 18,
      fontWeight: '500',
      color: '#24211D',
      lineHeight: 27,
      marginBottom: 4,
    },

    expandedMemory: {
      backgroundColor: '#FFFFFF',
      borderRadius: 14,
      marginTop: 10,
      paddingHorizontal: 14,
      paddingBottom: 4,
      borderWidth: 1,
      borderColor: '#E5E1DC',
    },

    memorySummaryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      width: '100%',
    },

    memorySummaryTextContainer: {
      flex: 1,
      minWidth: 0,
    },

    expandMemoryButton: {
      marginLeft: 8,
      paddingHorizontal: 10,
      paddingVertical: 7,
      backgroundColor: '#F0EFEC',
      borderRadius: 9,
      borderWidth: 1,
      borderColor: '#E3DFD8',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },

    expandMemoryButtonText: {
      fontSize: 14,
      color: '#777777',
      fontWeight: '500',
    },

    expandMemoryIcon: {
      fontSize: 18,
      color: '#777777',
      marginLeft: 10,
    },

    divider: {
      height: 1,
      backgroundColor: '#E5E1DC',
      marginVertical: 16,
    },

    eventDetails: {
      marginTop: 2,
    },

    detail: {
      fontSize: 15,
      color: '#555555',
      lineHeight: 22,
      marginBottom: 7,
    },

    /* ===================================================== */
    /* CORRECTIONS                                           */
    /* ===================================================== */

    correctionContainer: {
      marginTop: 10,
      padding: 12,
      backgroundColor: '#F7F5F2',
      borderRadius: 10,
      borderWidth: 1,
      borderColor: '#E3DFD8',
    },

    correctionTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: '#555555',
      marginBottom: 5,
    },

    correctionText: {
      fontSize: 14,
      color: '#666666',
      lineHeight: 20,
    },

    /* ===================================================== */
    /* OUBLIER UN SOUVENIR                                  */
    /* ===================================================== */

    forgetButton: {
      marginTop: 14,
      paddingTop: 12,
      paddingBottom: 8,
      paddingHorizontal: 16,
      borderTopWidth: 1,
      borderTopColor: '#EAE7E3',
      alignItems: 'flex-end',
    },

    forgetButtonText: {
      fontSize: 13,
      color: '#A6A3A0',
      fontWeight: '500',
    },

    /* ===================================================== */
    /* MODALES                                               */
    /* ===================================================== */

    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
    },

    modalContainer: {
      width: '100%',
      maxWidth: 500,
      backgroundColor: '#FFFFFF',
      borderRadius: 22,
      padding: 22,
    },

    ambiguityModalContainer: {
      width: '100%',
      maxWidth: 500,
      maxHeight: '85%',
      backgroundColor: '#FFFFFF',
      borderRadius: 22,
      padding: 22,
    },

    modalTitle: {
      fontSize: 21,
      fontWeight: '700',
      color: '#1F2937',
      marginBottom: 10,
    },

    modalDescription: {
      fontSize: 15,
      color: '#666666',
      lineHeight: 22,
      marginBottom: 15,
    },

    modalInput: {
      width: '100%',
      minHeight: 140,
      backgroundColor: '#F8F7F4',
      borderRadius: 15,
      padding: 16,
      fontSize: 17,
      color: '#24211D',
      textAlignVertical: 'top',
      borderWidth: 1,
      borderColor: '#E3DFD8',
    },

    modalActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      alignItems: 'center',
      gap: 12,
      marginTop: 18,
    },

    modalCancelButton: {
      paddingVertical: 12,
      paddingHorizontal: 18,
      alignItems: 'center',
    },

    modalCancelText: {
      fontSize: 16,
      color: '#777777',
    },

    modalConfirmButton: {
      backgroundColor: '#1F2937',
      paddingVertical: 13,
      paddingHorizontal: 22,
      borderRadius: 12,
    },

    modalConfirmText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
    },

    candidateList: {
      maxHeight: 420,
      marginBottom: 10,
    },

    candidateButton: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      backgroundColor: '#F8F7F4',
      borderWidth: 1,
      borderColor: '#E3DFD8',
      borderRadius: 14,
      padding: 14,
      marginBottom: 10,
    },

    candidateNumber: {
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: '#1F2937',
      color: '#FFFFFF',
      textAlign: 'center',
      lineHeight: 30,
      fontSize: 15,
      fontWeight: '700',
      marginRight: 12,
    },

    candidateContent: {
      flex: 1,
    },

    candidateDescription: {
      fontSize: 16,
      lineHeight: 23,
      color: '#333333',
      fontWeight: '600',
      marginBottom: 6,
    },

    candidateDetail: {
      fontSize: 14,
      lineHeight: 20,
      color: '#666666',
      marginTop: 2,
    },
  });
