import { FormEvent, useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth, firebaseConfigured } from "./firebase";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!auth) return;
    setSubmitting(true); setMessage("");
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch {
      setMessage("That email or password was not accepted.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!firebaseConfigured) {
    return <main className="auth-screen"><section className="auth-card"><div className="brand-mark auth-mark">PA</div><p className="eyebrow">Setup required</p><h1>Posting Art</h1><p>The Firebase connection still needs to be added before this GitHub Pages version can be used.</p></section></main>;
  }

  return <main className="auth-screen"><section className="auth-card"><div className="brand-mark auth-mark">PA</div><p className="eyebrow">Private workspace</p><h1>Posting Art</h1><p>Sign in to prepare artwork and share posting history.</p><form onSubmit={submit}><label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></label><label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required /></label>{message && <p className="auth-error">{message}</p>}<button type="submit" disabled={submitting}>{submitting ? "Signing in…" : "Sign in"}</button></form><small>Posting Art · v1.2.1</small></section></main>;
}
