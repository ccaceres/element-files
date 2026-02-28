import { TokenEntryScreen } from "@/auth/TokenEntryScreen";
import { useTokenContext } from "@/auth/TokenContext";
import { AppShell } from "@/components/layout/AppShell";

function App() {
  const { initializing, token, user, status, wasAuthenticated } = useTokenContext();

  if (initializing) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-app-bg text-text-secondary">
        Loading...
      </div>
    );
  }

  if (!token && !user && !wasAuthenticated) {
    return <TokenEntryScreen />;
  }

  if (!user && status === "expired") {
    return <TokenEntryScreen forceExpired />;
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-app-bg text-text-secondary">
        Loading profile...
      </div>
    );
  }

  return <AppShell />;
}

export default App;

