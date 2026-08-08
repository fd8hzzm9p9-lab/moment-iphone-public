/*
 * =========================================================
 * MOMENT — KNOWLEDGE REGISTRY
 * MEMENTO 002-07
 * =========================================================
 *
 * Registre central des familles de connaissances.
 *
 * IMPORTANT :
 * 002-07 définit uniquement l'architecture.
 * Les dictionnaires seront enrichis à partir de 002-08.
 */

const KNOWLEDGE_FAMILIES =
  Object.freeze({
    fundamental:
      Object.freeze({
        description:
          'Connaissances conceptuelles fondamentales et transversales',

        modules:
          Object.freeze([]),
      }),

    domains:
      Object.freeze({
        description:
          'Connaissances liées aux domaines fonctionnels de Moment',

        modules:
          Object.freeze([]),
      }),

    shared:
      Object.freeze({
        description:
          'Connaissances communes réutilisables entre plusieurs familles',

        modules:
          Object.freeze([]),
      }),
  });

function getKnowledgeFamilies() {
  return KNOWLEDGE_FAMILIES;
}

function getKnowledgeFamily(
  familyName
) {
  if (
    !familyName ||
    !Object.prototype
      .hasOwnProperty.call(
        KNOWLEDGE_FAMILIES,
        familyName
      )
  ) {
    return null;
  }

  return (
    KNOWLEDGE_FAMILIES[
      familyName
    ]
  );
}

module.exports = {
  KNOWLEDGE_FAMILIES,
  getKnowledgeFamilies,
  getKnowledgeFamily,
};
