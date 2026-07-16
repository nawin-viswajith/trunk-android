import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import { View } from "react-native";
import { Directions, Gesture, GestureDetector } from "react-native-gesture-handler";
import { useFocusEffect, useNavigation, useNavigationState } from "@react-navigation/native";

const TAB_ORDER = ["Home", "Models", "Projects", "Playground", "Inference"];

/** Lets a descendant screen (anything nested inside a tab's own stack, e.g.
 * the Flow Editor's pannable canvas) suppress the ancestor SwipeableScreen's
 * left/right fling-to-switch-tab gesture while it needs raw horizontal pan
 * gestures of its own — a fast canvas pan can otherwise register as a fling
 * and switch tabs out from under the user mid-drag. */
const SwipeDisableContext = createContext<((disabled: boolean) => void) | null>(null);

/** Call with `true` for the lifetime this screen wants tab-swipe suppressed.
 * Automatically re-enables on blur/unmount via useFocusEffect's cleanup, so
 * navigating away (even without explicitly calling this again) never leaves
 * swipe permanently disabled for every other tab. */
export function useSuppressTabSwipe(suppress: boolean): void {
  const setDisabled = useContext(SwipeDisableContext);
  useFocusEffect(
    useCallback(() => {
      if (!setDisabled) return;
      setDisabled(suppress);
      return () => setDisabled(false);
    }, [setDisabled, suppress])
  );
}

/** Wraps a root tab screen so a left/right fling switches to the
 * adjacent tab - calls the same navigation.navigate() a tab-bar tap
 * would, so cross-tab routes (returnTo, nested stacks) keep working
 * exactly as before; this only adds a gesture shortcut on top. */
export function SwipeableScreen({ children }: { children: React.ReactNode }) {
  const navigation = useNavigation<any>();
  const index = useNavigationState((state) => state.index);
  const [disabled, setDisabled] = useState(false);
  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;

  const flingLeft = Gesture.Fling()
    .direction(Directions.LEFT)
    .enabled(!disabled)
    .onEnd(() => {
      if (disabledRef.current) return;
      const next = TAB_ORDER[index + 1];
      if (next) navigation.navigate(next);
    });

  const flingRight = Gesture.Fling()
    .direction(Directions.RIGHT)
    .enabled(!disabled)
    .onEnd(() => {
      if (disabledRef.current) return;
      const prev = TAB_ORDER[index - 1];
      if (prev) navigation.navigate(prev);
    });

  const composed = Gesture.Race(flingLeft, flingRight);

  return (
    <SwipeDisableContext.Provider value={setDisabled}>
      <GestureDetector gesture={composed}>
        <View style={{ flex: 1 }}>{children}</View>
      </GestureDetector>
    </SwipeDisableContext.Provider>
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
