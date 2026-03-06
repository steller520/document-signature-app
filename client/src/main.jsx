import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { createBrowserRouter } from 'react-router-dom'
import { RouterProvider } from 'react-router'
import Dashboard from './pages/Dashboard.jsx'
import Home from './pages/Home.jsx'

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      {
        path: "/",
        element: <Home />
      },
      {

        path: "/dashboard",
        element: <Dashboard />
      }
    ]
  },
])

createRoot(document.getElementById('root')).render(
  
    < RouterProvider router={router} />
  
)
