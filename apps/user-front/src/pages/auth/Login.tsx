import AuthLayout from '../../../../../packages/ui/components/AuthLayout/AuthLayout';
import LoginForm from '../../../../../packages/ui/components/auth/LoginForm';


const Login = () => {
  return (
    <div className="loginPage">
      <AuthLayout>
        <LoginForm/>
      </AuthLayout>
    </div>
  )
}

export default Login