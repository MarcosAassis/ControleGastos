import { createContext, useContext, useMemo, useState } from "react";

const MonthContext = createContext(null);

export function MonthProvider({ children }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const value = useMemo(() => {
    const shift = (delta) => {
      const date = new Date(year, month - 1 + delta, 1);
      setYear(date.getFullYear());
      setMonth(date.getMonth() + 1);
    };
    return { year, month, prev: () => shift(-1), next: () => shift(1) };
  }, [year, month]);

  return <MonthContext.Provider value={value}>{children}</MonthContext.Provider>;
}

export function useMonth() {
  const ctx = useContext(MonthContext);
  if (!ctx) throw new Error("useMonth precisa estar dentro de MonthProvider");
  return ctx;
}
