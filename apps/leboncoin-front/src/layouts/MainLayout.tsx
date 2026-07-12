import { Outlet } from "react-router-dom";
import Header from "../components/Header";

export default function MainLayout() {
  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
      <footer className="mt-12 border-t border-neutral-200 bg-white py-6 text-center text-xs text-neutral-400">
        Connected NeighBours — petites annonces entre voisins · les prix sont exprimés en points (tokens)
      </footer>
    </div>
  );
}
