import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  PanResponder,
  Pressable,
  StyleSheet,
  View,
} from "react-native";

import { useSettings } from "@/contexts/SettingsContext";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.3;
const EDGE_WIDTH = 44;

type SlidePanelProps = {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
};

export default function SlidePanel({ visible, onClose, children }: SlidePanelProps) {
  const { colors, isArabic } = useSettings();

  // Arabic:  slides IN from LEFT  (-SCREEN_WIDTH), dismiss to LEFT  (-SCREEN_WIDTH)
  //          swipe starts from RIGHT edge, going LEFT
  // English: slides IN from RIGHT (+SCREEN_WIDTH), dismiss to LEFT  (-SCREEN_WIDTH)
  //          swipe starts from RIGHT edge, going LEFT  ← flipped from old behavior
  const offScreenIn = isArabic ? -SCREEN_WIDTH : SCREEN_WIDTH;
  const offScreenOut = -SCREEN_WIDTH; // both dismiss to the left

  const translateX = useRef(new Animated.Value(offScreenIn)).current;
  const [mounted, setMounted] = useState(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const touchStartX = useRef(0);

  useEffect(() => {
    if (visible) {
      translateX.setValue(offScreenIn);
      setMounted(true);
      Animated.spring(translateX, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
    } else if (mounted) {
      Animated.timing(translateX, {
        toValue: offScreenOut,
        duration: 250,
        useNativeDriver: true,
      }).start(() => {
        setMounted(false);
      });
    }
  }, [visible]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: (evt) => {
        touchStartX.current = evt.nativeEvent.pageX;
        return false;
      },
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Both Arabic and English: swipe starts from the RIGHT edge, going LEFT
        const startedAtEdge = touchStartX.current >= SCREEN_WIDTH - EDGE_WIDTH;
        const swipingLeft = gestureState.dx < -10;
        const moreHorizontal = Math.abs(gestureState.dy) < Math.abs(gestureState.dx);
        return startedAtEdge && swipingLeft && moreHorizontal;
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dx < 0) translateX.setValue(gestureState.dx);
      },
      onPanResponderRelease: (_, gestureState) => {
        const shouldClose =
          gestureState.dx < -SWIPE_THRESHOLD || gestureState.vx < -0.5;

        if (shouldClose) {
          Animated.timing(translateX, {
            toValue: offScreenOut,
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            setMounted(false);
            onCloseRef.current();
          });
        } else {
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
            tension: 65,
            friction: 11,
          }).start();
        }
      },
    })
  ).current;

  // Backdrop fades as panel slides left (dx goes negative)
  const backdropOpacity = translateX.interpolate({
    inputRange: [-SCREEN_WIDTH, 0],
    outputRange: [0, 0.4],
    extrapolate: "clamp",
  });

  if (!mounted) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCloseRef.current} />
      </Animated.View>
      <Animated.View
        style={[styles.panel, { backgroundColor: colors.background, transform: [{ translateX }] }]}
        {...panResponder.panHandlers}
      >
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000",
  },
  panel: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  },
});
