import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import Cadastro from "./pages/Cadastro.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Ganhos from "./pages/Ganhos.jsx";
import Gastos from "./pages/Gastos.jsx";
import Login from "./pages/Login.jsx";
import Metas from "./pages/Metas.jsx";
import RecuperarSenha from "./pages/RecuperarSenha.jsx";
import Rotina from "./pages/Rotina.jsx";
import Uber from "./pages/Uber.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/cadastro" element={<Cadastro />} />
      <Route path="/recuperar-senha" element={<RecuperarSenha />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/ganhos" element={<Ganhos />} />
          <Route path="/gastos" element={<Gastos />} />
          <Route path="/metas" element={<Metas />} />
          <Route path="/rotina" element={<Rotina />} />
          <Route path="/uber" element={<Uber />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
