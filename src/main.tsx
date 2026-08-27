import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import App from "./App";
import Login from "./Login";
import { auth, firebaseConfigured } from "./firebase";
import "./styles.css";

function Root() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(firebaseConfigured);

  useEffect(() => {
    if (!auth) { setLoading(false); return; }
    return onAuthStateChanged(auth, (nextUser) => { setUser(nextUser); setLoading(false); });
  }, []);

  if (loading) return <main className="auth-screen"><section className="auth-card"><p>Opening Posting Art…</p></section></main>;
  if (!user) return <Login />;
  return <App userEmail={user.email} onSignOut={() => auth && void signOut(auth)} />;
}

createRoot(document.getElementById("root")!).render(<StrictMode><Root /></StrictMode>);
