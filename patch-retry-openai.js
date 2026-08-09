const fs = require('fs');
const path = require('path');

const file = path.join(
  process.cwd(),
  'app',
  '(tabs)',
  'index.tsx'
);

const backup =
  file + '.before-retry-openai.bak';

if (!fs.existsSync(file)) {
  console.error(
    '❌ app/(tabs)/index.tsx introuvable'
  );
  process.exit(1);
}

const original =
  fs.readFileSync(
    file,
    'utf8'
  );

/*
 * Recherche indépendante de l'indentation,
 * des retours ligne et des commentaires.
 */
const regex =
  /local_only\s*:\s*true\s*,/g;

const matches =
  original.match(regex) || [];

console.log(
  `🔎 local_only:true trouvés : ${matches.length}`
);

if (matches.length !== 1) {
  console.error(
    '❌ Il faut exactement 1 occurrence.'
  );
  console.error(
    'Aucune modification effectuée.'
  );
  process.exit(1);
}

const modified =
  original.replace(
    regex,
    match =>
      match.replace(
        'true',
        'false'
      )
  );

/*
 * Contrôles AVANT écriture
 */
if (
  /local_only\s*:\s*true\s*,/.test(
    modified
  )
) {
  console.error(
    '❌ local_only:true existe encore.'
  );
  process.exit(1);
}

if (
  !/local_only\s*:\s*false\s*,/.test(
    modified
  )
) {
  console.error(
    '❌ local_only:false non créé.'
  );
  process.exit(1);
}

try {
  fs.copyFileSync(
    file,
    backup
  );

  fs.writeFileSync(
    file,
    modified,
    'utf8'
  );

  const verification =
    fs.readFileSync(
      file,
      'utf8'
    );

  const falseCount =
    (
      verification.match(
        /local_only\s*:\s*false\s*,/g
      ) || []
    ).length;

  const trueCount =
    (
      verification.match(
        /local_only\s*:\s*true\s*,/g
      ) || []
    ).length;

  if (
    falseCount !== 1 ||
    trueCount !== 0
  ) {
    throw new Error(
      `Contrôle final incorrect : false=${falseCount}, true=${trueCount}`
    );
  }

  console.log('');
  console.log(
    '✅ PATCH TERMINÉ'
  );

  console.log(
    '✅ local_only : true → false'
  );

  console.log(
    '✅ Réessai manuel : fallback OpenAI autorisé'
  );

  console.log(
    '✅ Local First reste prioritaire'
  );

  console.log(
    '✅ Quota OpenAI toujours contrôlé côté serveur'
  );

  console.log(
    '✅ Sauvegarde créée :'
  );

  console.log(
    '   app/(tabs)/index.tsx.before-retry-openai.bak'
  );

} catch (error) {

  fs.writeFileSync(
    file,
    original,
    'utf8'
  );

  console.error('');
  console.error(
    '❌ ÉCHEC :',
    error.message
  );

  console.error(
    '↩️ index.tsx restauré automatiquement'
  );

  process.exit(1);
}