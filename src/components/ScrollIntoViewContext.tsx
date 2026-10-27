import { createContext, useContext } from 'react';
import { View } from 'react-native';

// Lets a row deep inside the routine editor scroll itself back into view, for example when a tall form above
// the visible area collapses into that row and the screen would otherwise be left showing what was below it.
export const ScrollIntoViewContext = createContext<(target: View) => void>(() => {});

export function useScrollIntoView() {
  return useContext(ScrollIntoViewContext);
}
