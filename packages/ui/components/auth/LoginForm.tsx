import { useState } from "react";
import { LoginFormI } from '../../../types/authType';

const LoginForm = () => {
  const [data, setData] = useState<LoginFormI>({
    email: "",
    password: ""
  });
  const [message, setMessage] = useState("");

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    console.log(data);
    setMessage("Login succès");

    setData({
      email: "",
      password: "",
    })
  };


  return (
    <div className="loginForm">
      <h1>Login</h1>
      <form onSubmit={handleSubmit}>
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