const fs = require('fs');
const path = require('path');

const root =
  process.cwd();

const screenPath =
  path.join(
    root,
    'app',
    '(tabs)',
    'préviens-moi.tsx'
  );

const appConfigPath =
  path.join(
    root,
    'config',
    'app.ts'
  );

const screenBackupPath =
  path.join(
    root,
    'app',
    '(tabs)',
    'préviens-moi.tsx.memento002-04.bak'
  );

const appBackupPath =
  path.join(
    root,
    'config',
    'app.ts.memento002-04.bak'
  );

/* ========================================================= */
/* CONTRÔLES                                                  */
/* ========================================================= */

if (
  !fs.existsSync(
    screenPath
  )
) {
  console.error(
    '❌ app/(tabs)/préviens-moi.tsx introuvable.'
  );

  process.exit(1);
}

if (
  !fs.existsSync(
    appConfigPath
  )
) {
  console.error(
    '❌ config/app.ts introuvable.'
  );

  process.exit(1);
}

const originalScreen =
  fs.readFileSync(
    screenPath,
    'utf8'
  );

const originalApp =
  fs.readFileSync(
    appConfigPath,
    'utf8'
  );

/* ========================================================= */
/* SAUVEGARDES                                                */
/* ========================================================= */

if (
  !fs.existsSync(
    screenBackupPath
  )
) {
  fs.writeFileSync(
    screenBackupPath,
    originalScreen,
    'utf8'
  );
}

if (
  !fs.existsSync(
    appBackupPath
  )
) {
  fs.writeFileSync(
    appBackupPath,
    originalApp,
    'utf8'
  );
}

/* ========================================================= */
/* NOUVEL ÉCRAN PRÉVIENS-MOI                                  */
/* ========================================================= */

const newScreen =
`import React from 'react';

import {
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  APP_NAME,
  APP_VERSION,
} from '../../config/app';

export default function PreventMeScreen() {
  const sendFeedback =
    async () => {
      try {
        await Share.share({
          title:
            'Feedback Moment',

          message:
            \`Feedback \${APP_NAME}\\n\\n\` +
            \`Version : \${APP_VERSION}\\n\` +
            \`Plateforme : \${Platform.OS}\\n\\n\` +
            \`Ce bouton sera enrichi prochainement avec le diagnostic automatique de la session de test.\`,
        });
      } catch (error) {
        console.error(
          '❌ Impossible d’ouvrir le partage du feedback :',
          error
        );
      }
    };

  return (
    <View
      style={
        styles.container
      }
    >
      <View
        style={
          styles.content
        }
      >
        <Text
          style={
            styles.icon
          }
        >
          🔔
        </Text>

        <Text
          style={
            styles.title
          }
        >
          Préviens-moi
        </Text>

        <Text
          style={
            styles.status
          }
        >
          Fonctionnalité en cours de développement
        </Text>

        <Text
          style={
            styles.description
          }
        >
          Préviens-moi permettra bientôt à Moment de
          t’aider à anticiper les événements, échéances
          et informations importantes.
        </Text>

        <Text
          style={
            styles.alphaNotice
          }
        >
          Cet onglet n’est pas encore opérationnel dans
          cette version pré-alpha.
        </Text>

        <View
          style={
            styles.separator
          }
        />

        <Text
          style={
            styles.feedbackTitle
          }
        >
          Tu testes Moment ?
        </Text>

        <Text
          style={
            styles.feedbackText
          }
        >
          Si quelque chose ne fonctionne pas comme prévu,
          utilise ce bouton pour nous transmettre ton
          feedback.
        </Text>

        <Pressable
          onPress={
            sendFeedback
          }
          style={
            ({ pressed }) => [
              styles.feedbackButton,

              pressed &&
                styles.feedbackButtonPressed,
            ]
          }
        >
          <Text
            style={
              styles.feedbackButtonText
            }
          >
            Envoyer le feedback
          </Text>
        </Pressable>

        <Text
          style={
            styles.version
          }
        >
          {APP_NAME} — {APP_VERSION}
        </Text>
      </View>
    </View>
  );
}

const styles =
  StyleSheet.create({
    container: {
      flex: 1,

      backgroundColor:
        '#F8FAFC',

      alignItems:
        'center',

      justifyContent:
        'center',

      paddingHorizontal:
        24,
    },

    content: {
      width:
        '100%',

      maxWidth:
        520,

      alignItems:
        'center',

      backgroundColor:
        '#FFFFFF',

      borderRadius:
        24,

      paddingHorizontal:
        26,

      paddingVertical:
        32,

      shadowColor:
        '#000',

      shadowOpacity:
        0.08,

      shadowRadius:
        18,

      shadowOffset: {
        width: 0,
        height: 8,
      },

      elevation: 3,
    },

    icon: {
      fontSize:
        50,

      marginBottom:
        12,
    },

    title: {
      fontSize:
        30,

      fontWeight:
        '800',

      color:
        '#0F172A',

      textAlign:
        'center',
    },

    status: {
      marginTop:
        10,

      fontSize:
        17,

      fontWeight:
        '700',

      color:
        '#2563EB',

      textAlign:
        'center',
    },

    description: {
      marginTop:
        18,

      fontSize:
        16,

      lineHeight:
        23,

      color:
        '#475569',

      textAlign:
        'center',
    },

    alphaNotice: {
      marginTop:
        14,

      fontSize:
        14,

      lineHeight:
        20,

      color:
        '#64748B',

      textAlign:
        'center',
    },

    separator: {
      width:
        '100%',

      height: 1,

      backgroundColor:
        '#E2E8F0',

      marginVertical:
        26,
    },

    feedbackTitle: {
      fontSize:
        18,

      fontWeight:
        '700',

      color:
        '#0F172A',

      textAlign:
        'center',
    },

    feedbackText: {
      marginTop:
        8,

      fontSize:
        15,

      lineHeight:
        21,

      color:
        '#64748B',

      textAlign:
        'center',
    },

    feedbackButton: {
      marginTop:
        20,

      width:
        '100%',

      minHeight:
        50,

      borderRadius:
        14,

      backgroundColor:
        '#2563EB',

      alignItems:
        'center',

      justifyContent:
        'center',

      paddingHorizontal:
        20,
    },

    feedbackButtonPressed: {
      opacity:
        0.8,
    },

    feedbackButtonText: {
      color:
        '#FFFFFF',

      fontSize:
        16,

      fontWeight:
        '700',
    },

    version: {
      marginTop:
        20,

      fontSize:
        12,

      color:
        '#94A3B8',

      textAlign:
        'center',
    },
  });
`;

/* ========================================================= */
/* ÉCRITURE                                                   */
/* ========================================================= */

fs.writeFileSync(
  screenPath,
  newScreen,
  'utf8'
);

/* ========================================================= */
/* VERSION                                                    */
/* ========================================================= */

let updatedApp =
  originalApp;

const versionRegex =
  /export\s+const\s+APP_VERSION\s*=\s*'[^']*'\s*;/m;

if (
  !versionRegex.test(
    updatedApp
  )
) {
  console.error(
    '❌ APP_VERSION introuvable dans config/app.ts.'
  );

  fs.writeFileSync(
    screenPath,
    originalScreen,
    'utf8'
  );

  process.exit(1);
}

updatedApp =
  updatedApp.replace(
    versionRegex,
    "export const APP_VERSION =\n  'pré-alpha 0.2.4';"
  );

fs.writeFileSync(
  appConfigPath,
  updatedApp,
  'utf8'
);

/* ========================================================= */
/* CONTRÔLES                                                  */
/* ========================================================= */

const writtenScreen =
  fs.readFileSync(
    screenPath,
    'utf8'
  );

const checks = [
  [
    writtenScreen.includes(
      'Envoyer le feedback'
    ),
    'Bouton feedback absent',
  ],

  [
    writtenScreen.includes(
      'Fonctionnalité en cours de développement'
    ),
    'Message Préviens-moi absent',
  ],

  [
    writtenScreen.includes(
      'Share.share'
    ),
    'Partage feedback absent',
  ],

  [
    writtenScreen.includes(
      'APP_VERSION'
    ),
    'Version absente de l’écran',
  ],

  [
    fs
      .readFileSync(
        appConfigPath,
        'utf8'
      )
      .includes(
        'pré-alpha 0.2.4'
      ),
    'Version 0.2.4 non appliquée',
  ],
];

const failed =
  checks.find(
    ([valid]) =>
      !valid
  );

if (failed) {
  fs.writeFileSync(
    screenPath,
    originalScreen,
    'utf8'
  );

  fs.writeFileSync(
    appConfigPath,
    originalApp,
    'utf8'
  );

  console.error('');
  console.error(
    '❌ MEMENTO 002-04 a échoué.'
  );

  console.error(
    '❌',
    failed[1]
  );

  console.error(
    '🛟 Les fichiers ont été restaurés.'
  );

  process.exit(1);
}

/* ========================================================= */
/* RÉSULTAT                                                   */
/* ========================================================= */

console.log('');
console.log(
  '✅ MEMENTO 002-04 appliqué avec succès.'
);

console.log(
  '✅ Écran Préviens-moi remplacé.'
);

console.log(
  '✅ Message “fonctionnalité en cours de développement” ajouté.'
);

console.log(
  '✅ Bouton “Envoyer le feedback” ajouté.'
);

console.log(
  '✅ Feuille de partage iOS / Android activée.'
);

console.log(
  '✅ Version et plateforme incluses dans le feedback.'
);

console.log(
  '✅ Version visible passée à pré-alpha 0.2.4.'
);

console.log('');
console.log(
  'ℹ️ En 002-05 et 002-06, ce même bouton recevra les logs et le paquet diagnostic complet.'
);

console.log('');
console.log(
  '🛟 Sauvegarde écran :'
);

console.log(
  screenBackupPath
);