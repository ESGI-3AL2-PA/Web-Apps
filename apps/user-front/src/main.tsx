import { createRoot } from "react-dom/client";
import HomePage from './app/HomePage'

const App = () => (
  <div>
    <HomePage />
  </div>
);

createRoot(document.getElementById("app")!).render(<App />);
