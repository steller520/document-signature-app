import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import logo from "./assets/logo.png";
import { CgProfile } from "react-icons/cg";

import "./App.css";

function App() {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(() =>
    Boolean(localStorage.getItem("token")),
  );
  const dropdownRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const syncAuthState = () => {
      setIsLoggedIn(Boolean(localStorage.getItem("token")));
    };

    window.addEventListener("storage", syncAuthState);
    window.addEventListener("auth-changed", syncAuthState);

    return () => {
      window.removeEventListener("storage", syncAuthState);
      window.removeEventListener("auth-changed", syncAuthState);
    };
  }, []);

  useEffect(() => {
    setIsLoggedIn(Boolean(localStorage.getItem("token")));
  }, [location.pathname]);

  useEffect(() => {
    if (!isLoggedIn) {
      setIsDropdownOpen(false);
    }
  }, [isLoggedIn]);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const handleProfileClick = () => {
    setIsDropdownOpen((prev) => !prev);
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    window.dispatchEvent(new Event("auth-changed"));
    setIsLoggedIn(false);
    setIsDropdownOpen(false);
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-md sticky top-0 z-50 w-full">
        <div className="flex items-center justify-between px-4 py-4">
          <Link to={"/"} className="shrink-0">
            <img src={logo} alt="Logo" className="h-12 w-12" />
          </Link>

          <ul className="flex gap-8 items-center">
            <li>
              <NavLink
                to="/"
                className={({ isActive }) =>
                  isActive ? "text-blue-600 font-bold" : "text-gray-800 hover:text-blue-600"
                }
              >
                Home
              </NavLink>
            </li>
            {isLoggedIn ? (
              <li>
                <NavLink
                  to="/dashboard"
                  className={({ isActive }) =>
                    isActive
                      ? "bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-blue-700 transition-all"
                      : "text-gray-800 px-6 py-2 rounded-lg font-semibold hover:bg-gray-100 transition-all"
                  }
                >
                  Dashboard
                </NavLink>
              </li>
            ) : (
              <li>
                <NavLink
                  to="/login"
                  className={({ isActive }) =>
                    isActive
                      ? "bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold"
                      : "bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-blue-700 transition-all"
                  }
                >
                  Sign in
                </NavLink>
              </li>
            )}

            {isLoggedIn && (
              <li className="relative" ref={dropdownRef}>


              {/* button for profile page with icon and hover effect */}

              <button
                id="dropdownHoverButton"
                className="inline-flex items-center justify-center rounded-lg px-2 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300"
                type="button"
                onClick={handleProfileClick}
                aria-expanded={isDropdownOpen}
                aria-controls="profileDropdown"
              >

                <CgProfile size={40} className='text-gray-800 hover:text-blue-600 transition-all' />
                <svg className="w-4 h-4 ms-1.5 -me-0.5" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m19 9-7 7-7-7" /></svg>
              </button>

              {/* Dropdown menu */}
              <div
                id="profileDropdown"
                className={`${
                  isDropdownOpen ? "block" : "hidden"
                } absolute right-0 mt-2 z-10 w-44 rounded-lg border border-gray-200 bg-white shadow-lg`}
              >
                <ul className="p-2 text-sm text-body font-medium" aria-labelledby="dropdownHoverButton">
                  <li>
                    <NavLink to="/dashboard" onClick={() => setIsDropdownOpen(false)} className="inline-flex w-full items-center rounded p-2 text-gray-700 hover:bg-gray-100 hover:text-gray-900">Dashboard</NavLink>
                  </li>
                  <li>
                    <button
                      type="button"
                      disabled
                      aria-disabled="true"
                      className="inline-flex w-full items-center rounded p-2 text-gray-400 cursor-not-allowed"
                    >
                      Settings (coming soon)
                    </button>
                  </li>
                  <li>
                    <button onClick={handleLogout} className="inline-flex w-full items-center rounded p-2 text-gray-700 hover:bg-gray-100 hover:text-gray-900">Sign out</button>
                  </li>
                </ul>
              </div>

              </li>
            )}
          </ul>
        </div>
      </nav>
      <main>
        <Outlet />
      </main>
    </div>
  );
}

export default App;
