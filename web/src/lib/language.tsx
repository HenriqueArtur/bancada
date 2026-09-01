import { createContext, useContext, useMemo, type ReactNode } from "react";
import { CATALOGUES } from "@/core/catalogue";
import { translator, type Language, type Translate } from "@/core/language";

/// English, always available, needing no catalogue.
const SOURCE = translator({});

const Speaking = createContext<Translate>(SOURCE);

export function Speaks({ language, children }: { language: Language; children: ReactNode }) {
  const t = useMemo(() => translator(CATALOGUES[language] ?? {}), [language]);
  return <Speaking value={t}>{children}</Speaking>;
}

/// The translator for whatever the window is speaking.
///
/// Defaults to English outside a provider rather than throwing. A component
/// rendered in a test has no provider and should still produce its own
/// words — a hook that throws would make every spec set one up to say
/// nothing.
export function useText(): Translate {
  return useContext(Speaking);
}
