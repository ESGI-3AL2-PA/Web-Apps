import { Outlet } from "react-router-dom";
import Header from "../component/Header";
import MessengerDock from "../component/messenger/MessengerDock";

const MainLayout = () => {
  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <Outlet />
      </main>
      <MessengerDock />
    </>
  );
};

export default MainLayout;
