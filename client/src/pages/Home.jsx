import { Link } from 'react-router-dom'

function Home() {
  return (
    <div className="home min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <div className="max-w-6xl mx-auto px-4 py-20">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6 leading-tight">
            Welcome to the <span className="text-blue-600">Document Signature</span> App
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            Sign your documents with ease and security. Streamline your digital workflow with our intuitive platform.
          </p>
          <Link
            to="/dashboard"
            className="inline-block px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-lg transition-all duration-200 transform hover:scale-105"
          >
            Get Started
          </Link>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-16">
          {/* Feature 1 */}
          <div className="bg-white rounded-lg shadow-lg p-8 hover:shadow-xl transition-shadow duration-300 border border-gray-100">
            <div className="bg-blue-100 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
              <span className="text-blue-600 text-2xl">🔒</span>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Secure</h3>
            <p className="text-gray-600">
              Your documents are protected with industry-leading encryption and security standards.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="bg-white rounded-lg shadow-lg p-8 hover:shadow-xl transition-shadow duration-300 border border-gray-100">
            <div className="bg-purple-100 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
              <span className="text-purple-600 text-2xl">⚡</span>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Fast</h3>
            <p className="text-gray-600">
              Sign documents in seconds. Upload, review, and get signatures faster than ever before.
            </p>
          </div>

          {/* Feature 3 */}
          <div className="bg-white rounded-lg shadow-lg p-8 hover:shadow-xl transition-shadow duration-300 border border-gray-100">
            <div className="bg-indigo-100 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
              <span className="text-indigo-600 text-2xl">👥</span>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Collaborative</h3>
            <p className="text-gray-600">
              Invite multiple signatories and track the entire signing process in real-time.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Home