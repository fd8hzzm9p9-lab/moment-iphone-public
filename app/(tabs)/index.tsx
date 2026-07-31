
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

type Relation = {
  from: string;
  relation: string;
  to: string;
};

type MemoryEvent = {
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
};

type MemoryInput = {
  input: string;
  events: MemoryEvent[];
};

const STORAGE_KEY = 'moment_memory_events';
const [reponseMemoire, setReponseMemoire] = useState('');
const [rappelEnCours, setRappelEnCours] = useState(false);
const SERVER_URL = 'https://moment-iphone.onrender.com';

function normalize(text: string) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function normalizeEvent(
  event: Partial<MemoryEvent>,
  input: string
): MemoryEvent {
  return {
    id: `memory_${Date.now()}_${Math.random()
  .toString(36)
  .substring(2, 9)}`,
    type: event.type || 'event',
    description: event.description || input,
    date_reference: event.date_reference || '',
    date_precision: event.date_precision || 'unknown',
    context: event.context || '',
    people: event.people || [],
    places: event.places || [],
    objects: event.objects || [],
    subjects: event.subjects || [],
    thoughts: event.thoughts || [],
    actions: event.actions || [],
    intentions: event.intentions || [],
    facts: event.facts || [],
    relations: event.relations || [],
    source_text: event.source_text || input,
    confidence:
      typeof event.confidence === 'number'
        ? event.confidence
        : 0,
    created_at: new Date().toISOString(),
  };
}

function searchableEvent(event: MemoryEvent): string {
  return normalize(
    [
      event.description,
      event.date_reference,
      event.context,
      ...event.people,
      ...event.places,
      ...event.objects,
      ...event.subjects,
      ...event.thoughts,
      ...event.actions,
      ...event.intentions,
      ...event.facts,
    ]
      .filter(Boolean)
      .join(' ')
  );
}

function searchMemoryEvents(
  events: MemoryEvent[],
  question: string
): MemoryEvent[] {
  const q = normalize(question);

  if (!q.trim()) {
    return events;
  }

  const words = q
    .split(/\s+/)
    .filter((word) => word.length > 2);

  const scored = events
    .map((event) => {
      const searchable = searchableEvent(event);

      let score = 0;

      for (const word of words) {
        if (searchable.includes(word)) {
          score++;
        }
      }

      return {
        event,
        score,
      };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.map((item) => item.event);
}

function EventDetails({
  event,
}: {
  event: MemoryEvent;
}) {
  return (
    <>
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

      {event.thoughts.length > 0 && (
        <Text style={styles.detail}>
          💭 {event.thoughts.join(' ; ')}
        </Text>
      )}

      {event.actions.length > 0 && (
        <Text style={styles.detail}>
          🔨 {event.actions.join(' ; ')}
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

      {event.facts.length > 0 && (
        <Text style={styles.detail}>
          ℹ️ {event.facts.join(' ; ')}
        </Text>
      )}

      {event.relations.length > 0 && (
        <Text style={styles.detail}>
          🔗{' '}
          {event.relations
            .map(
              (relation) =>
                `${relation.from} ${relation.relation} ${relation.to}`
            )
            .join(' ; ')}
        </Text>
      )}
    </>
  );
}

export default function HomeScreen() {
  const [souvenir, setSouvenir] = useState('');
  const [recherche, setRecherche] = useState('');
  const [evenements, setEvenements] = useState<MemoryEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [memorisationEnCours, setMemorisationEnCours] =
    useState(false);
  const [rechercheLancee, setRechercheLancee] =
    useState(false);
  const [reponseMemoire, setReponseMemoire] = useState('');
  const [rappelEnCours, setRappelEnCours] = useState(false);

  useEffect(() => {
    const loadMemory = async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);

        if (saved) {
          setEvenements(JSON.parse(saved));
        }
      } catch (error) {
        console.log(
          'Erreur de chargement de la mémoire :',
          error
        );
      } finally {
        setLoading(false);
      }
    };

    loadMemory();
  }, []);

  useEffect(() => {
    if (loading) {
      return;
    }

    const saveMemory = async () => {
      try {
        await AsyncStorage.setItem(
          STORAGE_KEY,
          JSON.stringify(evenements)
        );
      } catch (error) {
        console.log(
          'Erreur de sauvegarde de la mémoire :',
          error
        );
      }
    };

    saveMemory();
  }, [evenements, loading]);

  const memoriser = async () => {
    if (!souvenir.trim() || memorisationEnCours) {
      return;
    }

    const texte = souvenir.trim();

    setMemorisationEnCours(true);

    try {
      console.log('📤 Envoi à Moment...');

      const response = await fetch(
        `${SERVER_URL}/understand`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
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

      const data: MemoryInput = await response.json();

      console.log(
        '🧠 Événements reçus :',
        data.events
      );

      const nouveauxEvenements = (data.events || []).map(
        (event) => normalizeEvent(event, texte)
      );

      if (nouveauxEvenements.length === 0) {
        throw new Error(
          'Moment n’a produit aucun événement'
        );
      }

      setEvenements((current) => [
        ...nouveauxEvenements,
        ...current,
      ]);

      setSouvenir('');
      setRechercheLancee(false);

    } catch (error) {
      console.log(
        '❌ Impossible de contacter Moment :',
        error
      );
    } finally {
      setMemorisationEnCours(false);
    }
  };


const lancerRecherche = async () => {
  if (!recherche.trim() || rappelEnCours) {
    return;
  }

  setRechercheLancee(true);
  setRappelEnCours(true);
  setReponseMemoire('');

  try {
    console.log('🔎 Question envoyée à Moment...');

    const response = await fetch(
      `${SERVER_URL}/recall`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question: recherche.trim(),
          memories: evenements,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(
        `Serveur Moment : ${response.status}`
      );
    }

    const data = await response.json();

    console.log(
      '🧠 Réponse de Moment :',
      data
    );

    setReponseMemoire(
      data.answer ||
        "Je n'ai pas trouvé suffisamment d'informations."
    );

  } catch (error) {
    console.log(
      '❌ Erreur pendant le rappel :',
      error
    );

    setReponseMemoire(
      "Je n'arrive pas à consulter ma mémoire pour le moment."
    );

  } finally {
    setRappelEnCours(false);
  }
};


  const resultats = rechercheLancee
    ? searchMemoryEvents(evenements, recherche)
    : evenements;

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.logo}>Moment</Text>

        <Text style={styles.title}>
          Qu'est-ce que vous voulez mémoriser ?
        </Text>

        <Text style={styles.subtitle}>
          Racontez simplement ce qui vous passe par la tête.
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Parlez naturellement à Moment..."
          placeholderTextColor="#999999"
          value={souvenir}
          onChangeText={setSouvenir}
          multiline
        />

        <Pressable
          style={[
            styles.button,
            memorisationEnCours &&
              styles.buttonDisabled,
          ]}
          onPress={memoriser}
          disabled={memorisationEnCours}
        >
          {memorisationEnCours ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonText}>
              Mémoriser
            </Text>
          )}
        </Pressable>

        <View style={styles.searchSection}>
          <Text style={styles.searchTitle}>
            🔎 Parler à ma mémoire
          </Text>

          <View style={styles.searchInputContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder="Exemple : qu'est-ce que j'ai fait hier ?"
              placeholderTextColor="#999999"
              value={recherche}
              onChangeText={setRecherche}
              onSubmitEditing={lancerRecherche}
              returnKeyType="search"
            />

            {recherche.length > 0 && (
              <Pressable
                style={styles.clearSearchButton}
                onPress={() => {
                  setRecherche('');
                  setRechercheLancee(false);
                }}
              >
                <Text style={styles.clearSearchText}>
                  ×
                </Text>
              </Pressable>
            )}
          </View>

          <Pressable
            style={styles.searchButton}
            onPress={lancerRecherche}
          >
            <Text style={styles.searchButtonText}>
              Rechercher
            </Text>
          </Pressable>
        </View>

        {rechercheLancee && (
          <View style={styles.memorySection}>
<Text style={styles.memoryTitle}>
  {rappelEnCours
    ? '🧠 Moment réfléchit...'
    : reponseMemoire || 'Résultats'}
</Text>

            {resultats.map((event) => (
              <View
                style={styles.memoryCard}
                key={event.id}
              >
                <Text style={styles.memoryText}>
                  {event.description}
                </Text>

                <View style={styles.divider} />

                <EventDetails event={event} />
              </View>
            ))}
          </View>
        )}

        {!rechercheLancee && evenements.length > 0 && (
          <View style={styles.memorySection}>
            <Text style={styles.memoryTitle}>
              Ma mémoire
            </Text>

            {evenements.map((event) => (
              <View
                style={styles.memoryCard}
                key={event.id}
              >
                <Text style={styles.memoryText}>
                  {event.description}
                </Text>

                <View style={styles.divider} />

                <Text style={styles.understoodLabel}>
                  🧠 Moment a compris
                </Text>

                <EventDetails event={event} />
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  searchInputContainer: {
    width: '100%',
    position: 'relative',
  },

  clearSearchButton: {
    position: 'absolute',
    right: 12,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },

  clearSearchText: {
    fontSize: 20,
    color: '#999999',
  },

  container: {
    flex: 1,
    backgroundColor: '#F7F5F2',
  },

  content: {
    flexGrow: 1,
    alignItems: 'center',
    padding: 25,
    paddingTop: 70,
    paddingBottom: 50,
  },

  logo: {
    fontSize: 42,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 40,
  },

  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 15,
  },

  subtitle: {
    fontSize: 17,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 25,
    marginBottom: 30,
  },

  input: {
    width: '100%',
    maxWidth: 500,
    minHeight: 130,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    fontSize: 17,
    color: '#1F2937',
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: '#E5E1DC',
    marginBottom: 20,
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

  buttonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
  },

  searchSection: {
    width: '100%',
    maxWidth: 500,
    marginTop: 40,
  },

  searchTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 12,
  },

  searchInput: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    paddingRight: 45,
    fontSize: 16,
    color: '#1F2937',
    borderWidth: 1,
    borderColor: '#E5E1DC',
  },

  searchButton: {
    backgroundColor: '#4B5563',
    paddingVertical: 13,
    paddingHorizontal: 25,
    borderRadius: 12,
    marginTop: 10,
    alignSelf: 'flex-start',
  },

  searchButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },

  memorySection: {
    width: '100%',
    maxWidth: 500,
    marginTop: 35,
  },

  memoryTitle: {
    fontSize: 21,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 15,
  },

  memoryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#E5E1DC',
  },

  memoryText: {
    fontSize: 17,
    color: '#333333',
    lineHeight: 25,
  },

  divider: {
    height: 1,
    backgroundColor: '#E5E1DC',
    marginVertical: 16,
  },

  understoodLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 12,
  },

  detail: {
    fontSize: 16,
    color: '#555555',
    marginBottom: 7,
  },
});