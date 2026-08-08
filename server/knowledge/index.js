/*
 * =========================================================
 * MOMENT — KNOWLEDGE
 * MEMENTO 002-07
 * =========================================================
 *
 * Point d'entrée unique des connaissances conceptuelles
 * partagées de Moment.
 *
 * Aucun comportement fonctionnel n'est activé ici en 002-07.
 */

const {
  KNOWLEDGE_FAMILIES,
  getKnowledgeFamilies,
  getKnowledgeFamily,
} = require('./registry');

const KNOWLEDGE_ARCHITECTURE_VERSION =
  '002-07';

module.exports = {
  KNOWLEDGE_ARCHITECTURE_VERSION,
  KNOWLEDGE_FAMILIES,
  getKnowledgeFamilies,
  getKnowledgeFamily,
};
