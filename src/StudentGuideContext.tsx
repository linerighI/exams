import { createContext, useContext, useState, type ReactNode } from 'react';
import type { GuideAction, GuideExam, HelpTopic } from './studentGuide';
type ExamActions = Partial<Record<GuideAction, () => void>>;
function createGuideStore() {
  let exam: GuideExam | null = null,
    actions: ExamActions = {},
    helper: ((topic: HelpTopic) => void) | null = null;
  const listeners = new Set<() => void>();
  return {
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot: () => exam,
    update: (value: GuideExam) => {
      exam = value;
      listeners.forEach((listener) => listener());
    },
    register: (value: ExamActions) => {
      actions = value;
    },
    run: (id: GuideAction) => actions[id]?.(),
    setHelper: (value: ((topic: HelpTopic) => void) | null) => {
      helper = value;
    },
    openHelp: (topic: HelpTopic) => helper?.(topic),
    clear: () => {
      exam = null;
      actions = {};
      listeners.forEach((listener) => listener());
    },
  };
}
const StudentGuideContext = createContext<ReturnType<typeof createGuideStore> | null>(null);
export function StudentGuideProvider({ children }: { children: ReactNode }) {
  const [store] = useState(createGuideStore);
  return <StudentGuideContext.Provider value={store}>{children}</StudentGuideContext.Provider>;
}
export function useStudentGuide() {
  return useContext(StudentGuideContext);
}
