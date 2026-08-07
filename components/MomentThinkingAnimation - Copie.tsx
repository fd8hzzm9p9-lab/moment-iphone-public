import React, {
  useEffect,
  useRef,
} from 'react';

import {
  Animated,
  Easing,
  StyleSheet,
  View,
} from 'react-native';

const PARTICLE_COUNT = 40;

type Particle = {
  value: Animated.Value;
  active: boolean;

  angle: number;
  radius: number;
  turns: number;
  direction: number;
  duration: number;

  size: number;
  symbol: string;
  color: string;
};

const MomentThinkingAnimation = () => {
  const brainScale =
    useRef(
      new Animated.Value(1)
    ).current;

  const particles =
    useRef<Particle[]>(
      Array.from(
        {
          length:
            PARTICLE_COUNT,
        },
        () => ({
          value:
            new Animated.Value(0),

          active: false,

          angle: 0,
          radius: 0,
          turns: 0,
          direction: 1,
          duration: 0,

          size: 40,
          symbol: '✦',
          color: '#6B7280',
        })
      )
    ).current;

  const mounted =
    useRef(true);

  const activeCount =
    useRef(0);

  useEffect(() => {
    mounted.current = true;

    const symbols = [
      '✦',
      '✧',
      '⋆',
      '·',
      '✦',
      '✧',
      '⋆',
      '✺',
      '✷',
    ];

    const colors = [
      '#6B7280',
      '#1E3A5F',
      '#3B82F6',
      '#60A5FA',
      '#93C5FD',
      '#4B5563',
      '#2563EB',
    ];

    /*
     * --------------------------------------------------
     * IMPULSION DU CERVEAU
     * --------------------------------------------------
     */

    const pulseBrain = () => {
      if (!mounted.current) {
        return;
      }

      Animated.sequence([
        Animated.timing(
          brainScale,
          {
            toValue: 1.14,
            duration: 130,
            easing:
              Easing.out(
                Easing.ease
              ),
            useNativeDriver: true,
          }
        ),

        Animated.timing(
          brainScale,
          {
            toValue: 0.98,
            duration: 150,
            easing:
              Easing.inOut(
                Easing.ease
              ),
            useNativeDriver: true,
          }
        ),

        Animated.timing(
          brainScale,
          {
            toValue: 1.04,
            duration: 130,
            easing:
              Easing.inOut(
                Easing.ease
              ),
            useNativeDriver: true,
          }
        ),

        Animated.timing(
          brainScale,
          {
            toValue: 1,
            duration: 200,
            easing:
              Easing.out(
                Easing.ease
              ),
            useNativeDriver: true,
          }
        ),
      ]).start();
    };

    /*
     * --------------------------------------------------
     * LANCEMENT D'UNE PARTICULE
     * --------------------------------------------------
     */

    const launchParticle = (
      particle: Particle
    ) => {
      if (
        !mounted.current ||
        particle.active
      ) {
        return;
      }

      particle.active = true;

      activeCount.current += 1;

      /*
       * Angle de départ aléatoire.
       */

      particle.angle =
        Math.random() *
        Math.PI *
        2;

      /*
       * Distance de départ aléatoire.
       */

      particle.radius =
        170 +
        Math.random() *
          230;

      /*
       * Nombre de tours :
       * entre 2 et 5.
       */

      particle.turns =
        2 +
        Math.random() * 3;

      /*
       * Sens de rotation aléatoire.
       */

      particle.direction =
        Math.random() < 0.5
          ? -1
          : 1;

      /*
       * Vitesse individuelle.
       *
       * Chaque étoile a sa propre durée.
       */

      particle.duration =
        2200 +
        Math.random() * 3200;

      /*
       * TAILLE DES ÉTOILES :
       *
       * 38 → 62 px
       */

      particle.size =
        38 +
        Math.random() * 24;

      /*
       * Forme aléatoire.
       */

      particle.symbol =
        symbols[
          Math.floor(
            Math.random() *
              symbols.length
          )
        ];

      /*
       * Couleur aléatoire.
       */

      particle.color =
        colors[
          Math.floor(
            Math.random() *
              colors.length
          )
        ];

      particle.value.setValue(0);

      Animated.timing(
        particle.value,
        {
          toValue: 1,

          duration:
            particle.duration,

          easing:
            Easing.linear,

          useNativeDriver: true,
        }
      ).start(
        ({ finished }) => {
          if (!mounted.current) {
            return;
          }

          particle.active = false;

          activeCount.current =
            Math.max(
              0,
              activeCount.current - 1
            );

          particle.value.setValue(0);

          /*
           * Le cerveau réagit à l'arrivée
           * d'une étoile.
           */

          if (finished) {
            pulseBrain();
          }
        }
      );
    };

    /*
     * --------------------------------------------------
     * GESTION DES VAGUES
     * --------------------------------------------------
     */

    let stopped = false;

    const spawnParticles = () => {
      if (
        stopped ||
        !mounted.current
      ) {
        return;
      }

      /*
       * Chaque vague contient
       * entre 5 et 15 étoiles.
       */

      const target =
        5 +
        Math.floor(
          Math.random() * 11
        );

      const available =
        particles.filter(
          particle =>
            !particle.active
        );

      const missing =
        target -
        activeCount.current;

      const amount =
        Math.min(
          Math.max(
            0,
            missing
          ),
          available.length
        );

      /*
       * Les étoiles d'une même vague
       * arrivent avec de légers décalages.
       */

      for (
        let i = 0;
        i < amount;
        i++
      ) {
        const particle =
          available[i];

        setTimeout(
          () => {
            if (
              !stopped &&
              mounted.current
            ) {
              launchParticle(
                particle
              );
            }
          },
          Math.random() * 500
        );
      }

      /*
       * NOUVELLE VAGUE :
       *
       * entre 0,5 et 1 seconde.
       */

      setTimeout(
        spawnParticles,
        500 +
          Math.random() * 500
      );
    };

    /*
     * --------------------------------------------------
     * RESPIRATION DU CERVEAU
     * --------------------------------------------------
     */

    const breathing =
      Animated.loop(
        Animated.sequence([
          Animated.timing(
            brainScale,
            {
              toValue: 1.035,
              duration: 1900,
              easing:
                Easing.inOut(
                  Easing.ease
                ),
              useNativeDriver: true,
            }
          ),

          Animated.timing(
            brainScale,
            {
              toValue: 1,
              duration: 1900,
              easing:
                Easing.inOut(
                  Easing.ease
                ),
              useNativeDriver: true,
            }
          ),
        ])
      );

    breathing.start();

    /*
     * Premier lancement.
     */

    const firstTimer =
      setTimeout(
        spawnParticles,
        300
      );

    /*
     * --------------------------------------------------
     * NETTOYAGE
     * --------------------------------------------------
     */

    return () => {
      stopped = true;

      mounted.current = false;

      clearTimeout(firstTimer);

      breathing.stop();

      brainScale.stopAnimation();

      particles.forEach(
        particle => {
          particle.active = false;

          particle.value.stopAnimation();

          particle.value.setValue(0);
        }
      );

      activeCount.current = 0;
    };
  }, [
    brainScale,
    particles,
  ]);

  /*
   * --------------------------------------------------
   * RENDU DE LA SPIRALE
   * --------------------------------------------------
   *
   * 32 points de contrôle permettent
   * d'obtenir une trajectoire très fluide.
   */

  const renderParticle = (
    particle: Particle,
    index: number
  ) => {
    const steps = 32;

    const inputRange =
      Array.from(
        {
          length:
            steps + 1,
        },
        (_, i) =>
          i / steps
      );

    /*
     * --------------------------------------------------
     * RAYON
     * --------------------------------------------------
     *
     * Le rayon diminue progressivement.
     *
     * La fonction smoothstep rend
     * l'accélération très douce.
     */

    const radiusValues =
      inputRange.map(
        progress => {
          const smooth =
            progress *
            progress *
            (3 - 2 * progress);

          const radiusFactor =
            Math.pow(
              1 - smooth,
              1.18
            );

          return (
            particle.radius *
            radiusFactor
          );
        }
      );

    /*
     * --------------------------------------------------
     * ANGLE
     * --------------------------------------------------
     *
     * Plusieurs rotations complètes
     * autour du cerveau.
     */

    const angleValues =
      inputRange.map(
        progress => {
          const smooth =
            progress *
            progress *
            (3 - 2 * progress);

          return (
            particle.angle +
            particle.direction *
              Math.PI *
              2 *
              particle.turns *
              smooth
          );
        }
      );

    /*
     * --------------------------------------------------
     * X
     * --------------------------------------------------
     */

    const xValues =
      inputRange.map(
        (_, i) =>
          Math.cos(
            angleValues[i]
          ) *
          radiusValues[i]
      );

    /*
     * --------------------------------------------------
     * Y
     * --------------------------------------------------
     */

    const yValues =
      inputRange.map(
        (_, i) =>
          Math.sin(
            angleValues[i]
          ) *
          radiusValues[i]
      );

    const translateX =
      particle.value.interpolate(
        {
          inputRange,
          outputRange:
            xValues,
        }
      );

    const translateY =
      particle.value.interpolate(
        {
          inputRange,
          outputRange:
            yValues,
        }
      );

    /*
     * --------------------------------------------------
     * TAILLE
     * --------------------------------------------------
     *
     * L'étoile apparaît petite,
     * atteint sa taille maximale,
     * puis se fond dans le cerveau.
     */

    const scale =
      particle.value.interpolate(
        {
          inputRange: [
            0,
            0.12,
            0.40,
            0.70,
            0.90,
            1,
          ],

          outputRange: [
            0.25,
            0.85,
            1,
            0.85,
            0.42,
            0.02,
          ],
        }
      );

    /*
     * --------------------------------------------------
     * OPACITÉ
     * --------------------------------------------------
     */

    const opacity =
      particle.value.interpolate(
        {
          inputRange: [
            0,
            0.07,
            0.16,
            0.72,
            0.90,
            1,
          ],

          outputRange: [
            0,
            0.30,
            0.95,
            0.85,
            0.40,
            0,
          ],
        }
      );

    return (
      <Animated.Text
        key={index}
        style={[
          styles.particle,

          {
            left: '50%',
            top: '50%',

            fontSize:
              particle.size,

            color:
              particle.color,

            opacity,

            transform: [
              {
                translateX,
              },
              {
                translateY,
              },
              {
                scale,
              },
            ],
          },
        ]}
      >
        {particle.symbol}
      </Animated.Text>
    );
  };

  /*
   * --------------------------------------------------
   * AFFICHAGE
   * --------------------------------------------------
   */

  return (
    <View
      style={
        styles.container
      }
      pointerEvents="none"
    >
      {particles.map(
        (
          particle,
          index
        ) =>
          renderParticle(
            particle,
            index
          )
      )}

      <Animated.Text
        style={[
          styles.brain,
          {
            transform: [
              {
                scale:
                  brainScale,
              },
            ],
          },
        ]}
      >
        🧠
      </Animated.Text>
    </View>
  );
};

const styles =
  StyleSheet.create({
    container: {
      position:
        'absolute',

      top: 0,
      left: 0,
      right: 0,
      bottom: 0,

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    brain: {
      position:
        'absolute',

      fontSize: 58,

      zIndex: 20,
    },

    particle: {
      position:
        'absolute',

      fontWeight:
        '400',

      zIndex: 10,
    },
  });

export default
  MomentThinkingAnimation;
