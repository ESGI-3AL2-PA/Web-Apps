import { Outlet } from 'react-router-dom'
import Header from '../component/Header'

const MainLayout = () => {
  return (
    <>
      <Header />
      <main className='px-50'>
        <Outlet />
      </main>
    </>
  )
}

export default MainLayout