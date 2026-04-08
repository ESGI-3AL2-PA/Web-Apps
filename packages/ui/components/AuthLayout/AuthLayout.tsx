interface AuthLayoutProps {
    children: React.ReactNode
}

const AuthLayout = ({children} : AuthLayoutProps) => {
  return (
    <div className="auth">
        <div className="panelLeft">
            <div className="logo">
                <p>LOGO</p>
                <p>Lorem ipsum dolor sit amet consectetur adipisicing elit. </p>
            </div>
        </div>
        <div className="panelRight">
            {children}
        </div>
    </div>
  )
}

export default AuthLayout