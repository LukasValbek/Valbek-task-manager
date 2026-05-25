import { useLocation } from 'react-router-dom'
import { Navbar } from './Navbar'
import { BackgroundScene } from './BackgroundScene'

interface PageLayoutProps {
  children: React.ReactNode
}

export function PageLayout({ children }: PageLayoutProps) {
  const { pathname } = useLocation()

  return (
    <div className="app-grid app-bg min-h-screen md:pl-56 pt-14 md:pt-0 relative">
      <BackgroundScene />
      <Navbar />
      <main key={pathname} className="page-enter max-w-screen-xl mx-auto px-6 py-6 relative" style={{ zIndex: 1 }}>
        {children}
      </main>
    </div>
  )
}
