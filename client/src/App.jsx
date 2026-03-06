import { Outlet, Link } from 'react-router-dom'
import logo from './assets/logo.png'
import { NavLink } from "react-router-dom";

import './App.css'

function App() {

  return (
    <div className="min-h-screen bg-gray-50 max-w-full">
      <nav className="bg-white flex items-center  shadow-md sticky top-0 z-50 w-full">

        <Link to={"/"} className="text-2xl mx-4  font-bold text-gray-900">
          <img src={logo} alt="Logo" className="h-12 w-12" />
        </Link>

        <div className="w-full flex items-center justify-end mx-auto px-4 py-4">
          <ul className="nav-list flex   gap-8">
            <li className="nav-item">
              <NavLink
                to="/"
                className={({ isActive }) =>
                  isActive ? "text-blue-600 font-bold" : "text-gray-800"
                }
              >
                Home
              </NavLink>
            </li>
            <li className="nav-item">
              <NavLink
                to="/dashboard"
                className={({ isActive }) =>
                  isActive ? "bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold transition-all duration-200 transform hover:scale-105" : "bg-gray-200 text-gray-800 px-6 py-2 rounded-lg font-semibold transition-all duration-200 transform hover:scale-105"
                }
              >
                Dashboard
              </NavLink>
            </li>
          </ul>
        </div>
      </nav>
      <main>
        <Outlet />
      </main>
    </div>
  )
}

export default App
