interface MainLayoutProps {
  children: React.ReactNode
}

const MainLayouts = ({ children }: MainLayoutProps) => {
  return (
    <>
      <div className="header">
        {children}
      </div>

    </>
  )
}

export default MainLayouts