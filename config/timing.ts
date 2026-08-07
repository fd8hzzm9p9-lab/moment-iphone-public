/* ========================================================= */
/* TIMING — MOMENT                                          */
/* ========================================================= */

/*
 * Délai maximal d'attente d'une requête /recall.
 *
 * 60 000 ms = 60 secondes.
 *
 * Au-delà de ce délai, la requête est automatiquement
 * annulée afin d'éviter que Moment reste bloqué
 * indéfiniment.
 */

export const RECALL_REQUEST_TIMEOUT = 60_000;

/*
 * Délais d'apparition des différentes étapes
 * du traitement de la recherche.
 *
 * 0 ms      → étape 1
 * 4 000 ms  → étape 2
 * 10 000 ms → étape 3
 * 20 000 ms → étape 4
 */

export const RECALL_PROCESSING_STEP_DELAYS = [
  0,
  4_000,
  10_000,
  20_000,
];