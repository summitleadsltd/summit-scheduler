export function SplashScreen() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white">
      <div className="flex items-center justify-center h-20 w-20 rounded-2xl bg-violet-600 mb-6">
        <span className="text-4xl font-bold text-white">S</span>
      </div>
      <h1 className="text-2xl font-bold text-gray-900">Summit Scheduler</h1>
      <p className="text-sm text-gray-500 mt-2">Intelligent Field Service Platform</p>
      <div className="mt-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600" />
      </div>
    </div>
  );
}
