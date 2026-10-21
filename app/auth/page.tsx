
"use client";

import { useState } from "react";
import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";

export default function AuthPage() {
  const router = useRouter();

  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage("");
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        setMessage("Login successful!");
        router.push("/");
        router.refresh();
      } else {
        const cleanUsername = username.trim().toLowerCase();

        if (!/^[a-z0-9_]{3,20}$/.test(cleanUsername)) {
          throw new Error(
            "Username must be 3–20 characters and use only letters, numbers, or underscores."
          );
        }

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { username: cleanUsername },
          },
        });

        if (error) throw error;

        if (data.session && data.user) {
          const { error: profileError } = await supabase
            .from("profiles")
            .insert({
              id: data.user.id,
              username: cleanUsername,
            });

          if (profileError) {
            setMessage(
              `Account created, but profile creation failed: ${profileError.message}`
            );
            return;
          }

          setMessage("Account created successfully!");
          router.push("/");
          router.refresh();
        } else {
          setMessage(
            "Check your email to confirm your account, then log in. Your profile will be created after confirmation in our next setup step."
          );
        }
      }
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-10 text-white">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-900 p-8 shadow-2xl">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-500 via-purple-500 to-indigo-500 text-2xl font-black">
            C
          </div>
          <h1 className="text-3xl font-bold tracking-tight">
            ConnectSphere
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Connect through moments that matter.
          </p>
        </div>

        <div className="mb-6 grid grid-cols-2 rounded-xl bg-slate-800 p-1">
          <button
            type="button"
            onClick={() => {
              setIsLogin(true);
              setMessage("");
            }}
            className={`rounded-lg py-2 text-sm font-semibold ${
              isLogin ? "bg-white text-slate-900" : "text-slate-400"
            }`}
          >
            Login
          </button>

          <button
            type="button"
            onClick={() => {
              setIsLogin(false);
              setMessage("");
            }}
            className={`rounded-lg py-2 text-sm font-semibold ${
              !isLogin ? "bg-white text-slate-900" : "text-slate-400"
            }`}
          >
            Sign up
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div>
              <label
                htmlFor="username"
                className="mb-2 block text-sm text-slate-300"
              >
                Username
              </label>
              <input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. aryan_dev"
                minLength={3}
                maxLength={20}
                required
                autoComplete="username"
                className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 outline-none focus:border-purple-500"
              />
            </div>
          )}

          <div>
            <label
              htmlFor="email"
              className="mb-2 block text-sm text-slate-300"
            >
              Email address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 outline-none focus:border-purple-500"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-2 block text-sm text-slate-300"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              minLength={6}
              autoComplete={isLogin ? "current-password" : "new-password"}
              required
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 outline-none focus:border-purple-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 py-3 font-bold transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading
              ? "Please wait..."
              : isLogin
                ? "Login to ConnectSphere"
                : "Create account"}
          </button>
        </form>

        {message && (
          <p
            role="status"
            className="mt-5 rounded-xl bg-slate-800 p-3 text-sm text-slate-200"
          >
            {message}
          </p>
        )}

        <p className="mt-6 text-center text-xs text-slate-500">
          By continuing, you agree to use ConnectSphere responsibly.
        </p>
      </div>
    </main>
  );
}
