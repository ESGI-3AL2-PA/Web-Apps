import { useAuth } from "@repo/hooks";

const Points = () => {
  const { user, isLoading, isAuthenticated } = useAuth();

  if (isLoading) return <p>Chargement des données…</p>;
  if (!isAuthenticated) return <p>Vous n'êtes pas connecté</p>;

  return (
    <div className="card card-lg sm:max-w-sm bg-[#DA7758] p-5 mt-10 text-white">
      <h2 className="cad-title text-3xl">Mon Soldes</h2>
      <p>
        <span className="text-2xl">{user?.balance} </span>points
      </p>
    </div>
  );
};

export default Points;
