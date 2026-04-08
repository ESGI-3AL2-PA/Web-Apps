import { useState } from "react";
import { RegisterFormI } from '../../../types/authType';

const RegisterForm = () => {
  const [data, setData] = useState<RegisterFormI>({
    firstName: "",
    lastName: "",
    email: "",
    password: ""
  });
  const [message, setMessage] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setData({ ...data, [e.target.name]: e.target.value})
  }

  const hanldeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('data ', data);
    setMessage("Sucess register")

    setData({
      firstName: "",
      lastName: "",
      email: "",
      password: "",
    })
  }


  return (
    <div className="flex justify-center items-center h-screen">
      <h1 className="text-red-500" >RegisterForm</h1>
      <form action="submit" onSubmit={hanldeSubmit}>
        <label>FirstName : </label>
        <input type="text" name="firstName" value={data.firstName} onChange={handleChange} placeholder="FirstName" required/>
        <label>LastName : </label>
        <input type="text" name="lastName" value={data.lastName} onChange={handleChange} placeholder="LastName" required/>
        <label>Email : </label>
        <input type="text" name="email" value={data.email} onChange={handleChange} placeholder="Email" required/>
        <label>Password : </label>
        <input type="text" name="password" value={data.password} onChange={handleChange} placeholder="Password" required/>
      </form>

      {message && <p style={{color: message.startsWith("Sucess") ? "green" : "red"}}>{message}</p>}
    </div>
  )
}

export default RegisterForm