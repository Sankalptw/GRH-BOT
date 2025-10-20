import React from "react";
import ChatbotWidget from "./ChatbotWidget";

function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-gray-100">
      <header className="bg-white shadow-md border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">
                Global Research Hub
              </h1>
              <p className="text-gray-600 mt-2 text-lg">
                Excellence in Research and Innovation
              </p>
            </div>
          </div>
        </div>
      </header>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-16">
          <h2 className="text-5xl font-bold text-gray-900 mb-4">
            Welcome to GRH
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Advancing research and fostering innovation across various domains.
          </p>
        </div>

        <div className="bg-gradient-to-br from-blue-500 to-blue-700 rounded-2xl shadow-2xl p-8 mb-12 text-white">
          <h3 className="text-2xl font-bold mb-2">Ask Our AI Assistant</h3>
          <p className="text-blue-100 mb-4">
            Have questions about Global Research Hub? Click the chat icon in the bottom-right corner!
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <h3 className="text-2xl font-bold text-gray-900 mb-3">
              Research Excellence
            </h3>
            <p className="text-gray-600">
              Supporting cutting-edge research initiatives with world-class resources.
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-8">
            <h3 className="text-2xl font-bold text-gray-900 mb-3">
              Global Collaboration
            </h3>
            <p className="text-gray-600">
              Connecting researchers and institutions across the globe.
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-8">
            <h3 className="text-2xl font-bold text-gray-900 mb-3">
              Innovation Hub
            </h3>
            <p className="text-gray-600">
              Fostering breakthrough innovations through dedicated support.
            </p>
          </div>
        </div>
      </section>

      <ChatbotWidget />
    </div>
  );
}

export default App;