import React, {
  useEffect,
  useRef,
} from 'react';

import {
  Animated,
  Easing,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';

const TRAIN_COUNT = 12;
const TRAJECTORY_STEPS = 31;

type MomentThinkingAnimationProps = {
  text: string;
};

type LetterConfig = {
  delay: number;
};

type Train = {
  value: Animated.Value;

  active: boolean;

  angle: number;
  radius: number;

  turns: number;
  direction: number;

  duration: number;

  ellipseX: number;
  ellipseY: number;

  rotation: number;

  spiralPower: number;

  size: number;
  color: string;

  text: string;

  letters: LetterConfig[];

};

const MomentThinkingAnimation = ({
  text,
}: MomentThinkingAnimationProps) => {
  const { width } =
    useWindowDimensions();

  const isPhone =
    width < 600;

  const brainScale =
    useRef(
      new Animated.Value(1)
    ).current;

  const trains =
    useRef(
      Array.from(
        {
          length:
            TRAIN_COUNT,
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

          ellipseX: 1,
          ellipseY: 1,

          rotation: 0,

          spiralPower: 0.8,

          size: 48,
          color: '#2563EB',

          text: '',

          letters: [],

        })
      )
    ).current;

  const mounted =
    useRef(true);

  useEffect(() => {
    mounted.current = true;

    const colors = [
      '#1E3A5F',
      '#2563EB',
      '#3B82F6',
      '#4F46E5',
      '#0369A1',
      '#1D4ED8',
      '#60A5FA',
      '#334155',
    ];

    const pulseBrain = () => {
      if (!mounted.current) {
        return;
      }

      Animated.sequence([
        Animated.timing(
          brainScale,
          {
            toValue: 1.1,
            duration: 150,
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
            toValue: 0.985,
            duration: 170,
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
            toValue: 1.035,
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
            duration: 210,
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
     * LANCEMENT D'UN TRAIN
     * --------------------------------------------------
     */

    const launchTrain = (
      train: Train,
      word: string
    ) => {
      if (
        !mounted.current ||
        train.active
      ) {
        return;
      }

      train.active = true;

      train.angle =
        Math.random() *
        Math.PI *
        2;

      train.radius =
        185 +
        Math.random() *
          175;

      train.turns =
        0.85 +
        Math.random() *
          1.75;

      train.direction =
        Math.random() < 0.5
          ? -1
          : 1;

      /*
       * ------------------------------------------------
       * ELLIPSE
       * ------------------------------------------------
       */

      const ellipseType =
        Math.floor(
          Math.random() * 4
        );

      if (
        ellipseType === 0
      ) {
        train.ellipseX =
          1.25 +
          Math.random() *
            0.35;

        train.ellipseY =
          0.55 +
          Math.random() *
            0.2;
      } else if (
        ellipseType === 1
      ) {
        train.ellipseX =
          0.55 +
          Math.random() *
            0.2;

        train.ellipseY =
          1.25 +
          Math.random() *
            0.35;
      } else if (
        ellipseType === 2
      ) {
        train.ellipseX =
          1.05 +
          Math.random() *
            0.25;

        train.ellipseY =
          0.75 +
          Math.random() *
            0.2;
      } else {
        train.ellipseX =
          0.75 +
          Math.random() *
            0.2;

        train.ellipseY =
          1.05 +
          Math.random() *
            0.25;
      }

      train.rotation =
        Math.random() *
        Math.PI *
        2;

      train.spiralPower =
        0.7 +
        Math.random() *
          0.45;

      train.duration =
        isPhone
          ? 8200 +
            Math.random() *
              1700
          : 6500 +
            Math.random() *
              1600;

      train.size =
        isPhone
          ? 46 +
            Math.random() *
              8
          : 48 +
            Math.random() *
              12;

      train.color =
        colors[
          Math.floor(
            Math.random() *
              colors.length
          )
        ];

      train.text = word;

      /*
       * ------------------------------------------------
       * LETTRES
       * ------------------------------------------------
       */

      train.letters =
        word
          .split('')
          .map(
            (
              _letter,
              index
            ) => {
              if (
                index === 0
              ) {
                return {
                  delay: 0,
                };
              }

              const spacing =
                isPhone
                  ? 0.055
                  : 0.05;

              const variation =
                Math.random() *
                  0.012;

              return {
                delay:
                  index *
                    spacing +
                  variation,
              };
            }
          );

      train.value.setValue(0);

      /*
       * ------------------------------------------------
       * ANIMATION
       * ------------------------------------------------
       */

      Animated.timing(
        train.value,
        {
          toValue: 1,

          duration:
            train.duration,

          easing:
            Easing.inOut(
              Easing.cubic
            ),

          useNativeDriver: true,
        }
      ).start(
        ({ finished }) => {
          if (
            !mounted.current
          ) {
            return;
          }

          train.active =
            false;

          train.value.setValue(0);

          if (finished) {
            pulseBrain();
          }
        }
      );
    };

    /*
     * --------------------------------------------------
     * MOTS
     * --------------------------------------------------
     */

    const words =
      text
        .split(/\s+/)
        .filter(
          word =>
            word.length > 0
        );

    let stopped = false;

    const timers: ReturnType<
      typeof setTimeout
    >[] = [];

    /*
     * --------------------------------------------------
     * SPAWNER
     * --------------------------------------------------
     *
     * Premier mot immédiatement.
     * Puis environ 1 mot/seconde.
     */
    let nextWordIndex = 0;
    const spawnTrain = () => {
      if (
        stopped ||
        !mounted.current
      ) {
        return;
      }

      const available =
        trains.filter(
          train =>
            !train.active
        );

      if (
        available.length >
          0 &&
        words.length > 0
      ) {
        const train =
          available[
            Math.floor(
              Math.random() *
                available.length
            )
          ];

const word =
  words[
    nextWordIndex %
      words.length
  ];

nextWordIndex += 1;

        launchTrain(
          train,
          word
        );
      }

      const nextDelay =
        950 +
        Math.random() *
          100;

      const timer =
        setTimeout(
          spawnTrain,
          nextDelay
        );

      timers.push(timer);
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
              duration: 2100,
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
              duration: 2100,
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
     * PREMIER MOT IMMÉDIATEMENT
     */

    spawnTrain();

    /*
     * --------------------------------------------------
     * CLEANUP
     * --------------------------------------------------
     */

    return () => {
      mounted.current =
        false;

      stopped = true;

      timers.forEach(
        timer =>
          clearTimeout(timer)
      );

      breathing.stop();

      brainScale.stopAnimation();

      trains.forEach(
        train => {
          train.active =
            false;

          train.value.stopAnimation();

          train.value.setValue(0);
        }
      );
    };
  }, [
    brainScale,
    trains,
    isPhone,
    text,
    width,
  ]);

  /*
   * ====================================================
   * TRAJECTOIRE ELLIPTIQUE VERS LE CERVEAU
   * ====================================================
   */

  const getSpiralPosition =
    (
      progress: number,
      train: Train
    ) => {
      const p =
        Math.max(
          0,
          Math.min(
            1,
            progress
          )
        );

      const angle =
        train.angle +
        train.direction *
          Math.PI *
          2 *
          train.turns *
          p;

      const radius =
        train.radius *
        Math.pow(
          1 - p,
          train.spiralPower
        );

      const x =
        Math.cos(angle) *
        radius *
        train.ellipseX;

      const y =
        Math.sin(angle) *
        radius *
        train.ellipseY;

      const cosRotation =
        Math.cos(
          train.rotation
        );

      const sinRotation =
        Math.sin(
          train.rotation
        );

      return {
        x:
          x * cosRotation -
          y * sinRotation,

        y:
          x * sinRotation +
          y * cosRotation,
      };
    };

  /*
   * ====================================================
   * RENDU D'UN TRAIN
   * ====================================================
   */

  const renderTrain =
    (
      train: Train,
      trainIndex: number
    ) => {
      if (
        train.text.length ===
        0
      ) {
        return null;
      }

      const inputRange =
        Array.from(
          {
            length:
              TRAJECTORY_STEPS,
          },
          (
            _,
            index
          ) =>
            index /
            (TRAJECTORY_STEPS -
              1)
        );

      return (
        <View
          key={`train-${trainIndex}`}
          pointerEvents="none"
          style={
            StyleSheet.absoluteFill
          }
        >
          {train.text
            .split('')
            .map(
              (
                letter,
                letterIndex
              ) => {
                const delay =
                  train
                    .letters[
                      letterIndex
                    ]?.delay ??
                  0;

                const xValues =
                  inputRange.map(
                    point => {
                      const position =
                        getSpiralPosition(
                          Math.max(
                            0,
                            point -
                              delay
                          ),
                          train
                        );

                      return position.x;
                    }
                  );

                const yValues =
                  inputRange.map(
                    point => {
                      const position =
                        getSpiralPosition(
                          Math.max(
                            0,
                            point -
                              delay
                          ),
                          train
                        );

                      return position.y;
                    }
                  );

                const translateX =
                  train.value.interpolate(
                    {
                      inputRange,

                      outputRange:
                        xValues,

                      extrapolate:
                        'clamp',
                    }
                  );

                const translateY =
                  train.value.interpolate(
                    {
                      inputRange,

                      outputRange:
                        yValues,

                      extrapolate:
                        'clamp',
                    }
                  );

                const opacity =
                  train.value.interpolate(
                    {
                      inputRange: [
                        0,
                        0.08,
                        0.16,
                        0.82,
                        0.94,
                        1,
                      ],

                      outputRange: [
                        0,
                        0.25,
                        1,
                        1,
                        0.8,
                        0,
                      ],

                      extrapolate:
                        'clamp',
                    }
                  );

                const scale =
                  train.value.interpolate(
                    {
                      inputRange: [
                        0,
                        0.12,
                        0.78,
                        0.94,
                        1,
                      ],

                      outputRange: [
                        0.7,
                        1,
                        1,
                        0.88,
                        0.08,
                      ],

                      extrapolate:
                        'clamp',
                    }
                  );

                return (
                  <Animated.Text
                    key={`${trainIndex}-${letterIndex}`}
                    style={[
                      styles.letter,

                      {
                        left:
                          '50%',

                        top:
                          '50%',

                        fontSize:
                          train.size,

                        color:
                          train.color,

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
                    {letter}
                  </Animated.Text>
                );
              }
            )}
        </View>
      );
    };

  /*
   * ====================================================
   * RENDU FINAL
   * ====================================================
   */

  return (
    <View
      style={
        styles.container
      }
      pointerEvents="none"
    >
      {trains.map(
        (
          train,
          index
        ) =>
          renderTrain(
            train,
            index
          )
      )}

      <Animated.Text
        style={[
          styles.brain,

          {
            fontSize:
              isPhone
                ? 56
                : 62,

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

      overflow:
        'hidden',
    },

    brain: {
      position:
        'absolute',

      zIndex: 50,
    },

    letter: {
      position:
        'absolute',

      fontWeight:
        '800',

      textAlign:
        'center',

      minWidth: 18,

      zIndex: 30,
    },
  });

export default
  MomentThinkingAnimation;
