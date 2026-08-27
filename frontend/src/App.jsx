import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Ganhos from "./pages/Ganhos.jsx";
import Gastos from "./pages/Gastos.jsx";
import Metas from "./pages/Metas.jsx";
import Rotina from "./pages/Rotina.jsx";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/ganhos" element={<Ganhos />} />
        <Route path="/gastos" element={<Gastos />} />
        <Route path="/metas" element={<Metas />} />
        <Route path="/rotina" element={<Rotina />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
