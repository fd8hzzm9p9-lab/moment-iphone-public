/*
 * =========================================================
 * VERSION SERVEUR MOMENT
 * =========================================================
 *
 * Ce compteur est GLOBAL.
 *
 * Il ne repart pas à S1 à chaque Memento.
 *
 * Toute évolution réelle du comportement serveur
 * validée doit incrémenter cette valeur :
 *
 * S1 → S2 → S3 → ...
 */

const SERVER_VERSION =
  'S2';

const EXPECTED_APP_REVISION =
  'A1';

module.exports = {
  SERVER_VERSION,
  EXPECTED_APP_REVISION,
};
