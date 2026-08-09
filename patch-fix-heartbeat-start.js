const fs = require('fs');
const path = require('path');

const file =
  path.join(
    process.cwd(),
    'app',
    '_layout.tsx'
  );

const backup =
  file + '.before-fix-heartbeat.bak';

if (!fs.existsSync(file)) {
  console.error(
    '❌ app/_layout.tsx introuvable'
  );
  process.exit(1);
}

const original =
  fs.readFileSync(
    file,
    'utf8'
  );

const oldBlock = `      if (
        AppState.currentState ===
        'active'
      ) {
        startHeartbeat();
      }

      const subscription =`;

const newBlock = `      /*
       * Au montage du RootLayout, on démarre
       * immédiatement le heartbeat.
       *
       * Sur Android, AppState.currentState peut
       * ne pas encore être "active" au tout premier
       * rendu. Attendre uniquement AppState pouvait
       * donc empêcher complètement le heartbeat.
       */
      startHeartbeat();

      const subscription =`;

if (
  original.includes(
    newBlock
  )
) {
  console.log(
    'ℹ️ Correction déjà installée. Aucun changement.'
  );
  process.exit(0);
}

if (
  !original.includes(
    oldBlock
  )
) {
  console.error(
    '❌ Bloc attendu introuvable.'
  );

  console.error(
    'Aucune modification effectuée.'
  );

  process.exit(1);
}

try {
  fs.copyFileSync(
    file,
    backup
  );

  const modified =
    original.replace(
      oldBlock,
      newBlock
    );

  if (
    !modified.includes(
      'startHeartbeat();'
    ) ||
    !modified.includes(
      '/alpha-presence/heartbeat'
    )
  ) {
    throw new Error(
      'Contrôle du résultat échoué'
    );
  }

  fs.writeFileSync(
    file,
    modified,
    'utf8'
  );

  console.log(
    '✅ HEARTBEAT CORRIGÉ'
  );

  console.log(
    '✅ Démarrage immédiat à l’ouverture de Moment'
  );

  console.log(
    '✅ Heartbeat toutes les 60 secondes conservé'
  );

  console.log(
    '✅ Gestion arrière-plan / premier plan conservée'
  );

  console.log(
    '✅ Sauvegarde : app/_layout.tsx.before-fix-heartbeat.bak'
  );

} catch (error) {
  fs.writeFileSync(
    file,
    original,
    'utf8'
  );

  console.error(
    '❌ ÉCHEC :',
    error.message
  );

  console.error(
    '↩️ Fichier original restauré'
  );

  process.exit(1);
}