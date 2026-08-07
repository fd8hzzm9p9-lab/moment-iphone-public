import React from 'react';

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
            `Feedback ${APP_NAME}\n\n` +
            `Version : ${APP_VERSION}\n` +
            `Plateforme : ${Platform.OS}\n\n` +
            `Ce bouton sera enrichi prochainement avec le diagnostic automatique de la session de test.`,
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
