import { useState, useEffect } from "react";

interface LoginFormI {
    firstName: string,
    lastName: string,
    email: string,
    password: string,
    //quartier: string, Utiliser un select pour les quartier
}

const LoginForm = () => {
  const [data, setData] = useState<LoginFormI>({
    firstName: "",
    lastName: "",
    email: "",
    password: ""
  });
  const [message, setMessage] = useState("");

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    console.log(data);
    setMessage("Login succès");

    data.firstName = "";
    data.lastName = "";
    data.email = "";
    data.password = "";
  };


  return (
    <div className="loginForm">
      <h1>Login</h1>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          name="firstName"
          value={data.firstName}
          onChange={e => setData({ ...data, firstName: e.target.value })}
          placeholder="Prénom"
          required
        />
        <input
          type="text"
          name="lastName"
          value={data.lastName}
          onChange={e => setData({ ...data, lastName: e.target.value })}
          placeholder="Nom"
          required
        />
        <input
          type="email"
          name="email"
          value={data.email}
          onChange={e => setData({ ...data, email: e.target.value })}
          placeholder="Email"
          required
        />
        <input
          type="password"
          name="password"
          value={data.password}
          onChange={e => setData({ ...data, password: e.target.value })}
          placeholder="Mot de passe"
          required
        />
        <button type="submit">Se connecter</button>
      </form>
      {message && <p>{message}</p>}
    </div>
  );
}

export default LoginForm