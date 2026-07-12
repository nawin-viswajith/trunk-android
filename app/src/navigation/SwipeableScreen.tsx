import React from "react";
import { View } from "react-native";
import { Directions, Gesture, GestureDetector } from "react-native-gesture-handler";
import { useNavigation, useNavigationState } from "@react-navigation/native";

const TAB_ORDER = ["Home", "Models", "Projects", "Playground", "Inference"];

/** Wraps a root tab screen so a left/right fling switches to the
 * adjacent tab — calls the same navigation.navigate() a tab-bar tap
 * would, so cross-tab routes (returnTo, nested stacks) keep working
 * exactly as before; this only adds a gesture shortcut on top. */
export function SwipeableScreen({ children }: { children: React.ReactNode }) {
  const navigation = useNavigation<any>();
  const index = useNavigationState((state) => state.index);

  const flingLeft = Gesture.Fling()
    .direction(Directions.LEFT)
    .onEnd(() => {
      const next = TAB_ORDER[index + 1];
      if (next) navigation.navigate(next);
    });

  const flingRight = Gesture.Fling()
    .direction(Directions.RIGHT)
    .onEnd(() => {
      const prev = TAB_ORDER[index - 1];
      if (prev) navigation.navigate(prev);
    });

  const composed = Gesture.Race(flingLeft, flingRight);

  return (
    <GestureDetector gesture={composed}>
      <View style={{ flex: 1 }}>{children}</View>
    </GestureDetector>
  );
}

export function withSwipe<P extends object>(ScreenComponent: React.ComponentType<P>) {
  return function Wrapped(props: P) {
    return (
      <SwipeableScreen>
        <ScreenComponent {...props} />
      </SwipeableScreen>
    );
  };
}
