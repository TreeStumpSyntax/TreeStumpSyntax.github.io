import { HashRouter, Routes, Route } from "react-router";
import HomePage from "./components/HomePage";
import EditorPage from "./components/EditorPage";

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/editor" element={<EditorPage />} />
      </Routes>
    </HashRouter>
  );
}
