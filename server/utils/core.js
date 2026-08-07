/*
 * =========================================================
 * MOMENT — OUTILS GÉNÉRAUX SERVEUR
 * MEMENTO 001
 * =========================================================
 *
 * Extraction structurelle depuis server/server.js.
 * Aucun comportement fonctionnel ne doit être modifié ici.
 */

function normalizeText(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function escapeRegExp(value) {
  return String(value).replace(
    /[.*+?^${}()|[\]\\]/g,
    '\\$&'
  );
}

function createId(prefix = 'memory') {
  return `${prefix}_${Date.now()}_${Math.random()
    .toString(36)
    .substring(2, 9)}`;
}

function getCreatedAt(memory) {
  const value = Date.parse(
    memory?.created_at || ''
  );

  return Number.isFinite(value)
    ? value
    : 0;
}

function getMemoryId(memory) {
  return memory?.id || '';
}

function getMemoryText(memory) {
  return [
    memory?.source_text,
    memory?.description,

    Array.isArray(memory?.facts)
      ? memory.facts.join(' ')
      : '',

    Array.isArray(memory?.actions)
      ? memory.actions.join(' ')
      : '',

    Array.isArray(memory?.intentions)
      ? memory.intentions.join(' ')
      : '',

    Array.isArray(memory?.subjects)
      ? memory.subjects.join(' ')
      : '',

    Array.isArray(memory?.thoughts)
      ? memory.thoughts.join(' ')
      : '',

    memory?.correction_note,

    Array.isArray(memory?.history)
      ? memory.history
          .map(item =>
            [
              item?.previous_description,
              item?.previous_location,
              item?.new_location,
              item?.previous_time,
              item?.new_time,
              item?.reason,
            ]
              .filter(Boolean)
              .join(' ')
          )
          .join(' ')
      : '',
  ]
    .filter(Boolean)
    .join(' ')
    .trim();
}

module.exports = {
  normalizeText,
  escapeRegExp,
  createId,
  getCreatedAt,
  getMemoryId,
  getMemoryText,
};