import { CalendarClock, LayoutDashboard, Receipt, Target, Wallet } from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";
import { useMonth } from "../context/MonthContext.jsx";
import { monthLabel } from "../utils/format.js";

const links = [
  { to: "/", label: "Início", icon: LayoutDashboard },
  { to: "/ganhos", label: "Ganhos", icon: Wallet },
  { to: "/gastos", label: "Gastos", icon: Receipt },
  { to: "/metas", label: "Metas", icon: Target },
  { to: "/rotina", label: "Rotina", icon: CalendarClock },
];

export default function Layout() {
  const { year, month, prev, next } = useMonth();

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col">
      <header className="sticky top-0 z-20 flex items-center justify-between px-4 pb-3 pt-[max(1rem,env(safe-area-inset-top))] backdrop-blur-xl">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-lime">
            Motorista Uber
          </p>
          <h1 className="font-display text-lg font-bold">Gestão Financeira</h1>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-white/10 bg-night-800 px-2 py-1">
          <button type="button" onClick={prev} className="px-2 text-lg leading-none">
            ‹
          </button>
          <span className="min-w-[8.5rem] text-center text-sm font-semibold capitalize">
            {monthLabel(year, month)}
          </span>
          <button type="button" onClick={next} className="px-2 text-lg leading-none">
            ›
          </button>
        </div>
      </header>

      <main className="flex-1 px-4 pb-28 pt-2">
        <Outlet />
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-20 border-t border-white/10 bg-night-900/95 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl">
        <div className="mx-auto grid max-w-lg grid-cols-5">
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 py-1 text-[11px] font-semibold ${
                  isActive ? "text-lime" : "text-emerald-200/50"
                }`
              }
            >
              <Icon size={20} />
              {label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
