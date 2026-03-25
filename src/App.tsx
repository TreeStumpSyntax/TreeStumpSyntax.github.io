import { BrowserRouter, Routes, Route } from "react-router";
import HomePage from "./components/HomePage";
import EditorPage from "./components/EditorPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/edit" element={<EditorPage />} />
      </Routes>
    </BrowserRouter>
  );
}
