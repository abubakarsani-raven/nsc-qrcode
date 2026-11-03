"use client";

import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

/** Only same-site paths — never bounce a fresh login to another origin. */
function safeCallback(raw: string | null) {
  if (!raw) return "/staff";
  try {
    const url = new URL(raw, window.location.origin);
    if (url.origin !== window.location.origin || url.pathname.startsWith("/login")) {
      return "/staff";
    }
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/staff";
  }
}

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await signIn("credentials", {
        email: email.trim(),
        password,
        redirect: false,
      });
      if (!res || res.error) {
        setError("Invalid email or password");
        setLoading(false);
        return;
      }
      // Keep the button in its "Signing in…" state through the navigation.
      router.replace(safeCallback(params.get("callbackUrl")));
      router.refresh();
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div>
        <Label htmlFor="email" className="md-field-label">
          Email
        </Label>
        <input
          id="email"
          type="email"
          required
          autoComplete="username"
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="nsc-field"
        />
      </div>
      <div>
        <Label htmlFor="password" className="md-field-label">
          Password
        </Label>
        <input
          id="password"
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="nsc-field"
        />
      </div>
      {error ? (
        <p className="md-body-medium rounded-[var(--md-shape-xs)] bg-[var(--md-error-container)] px-3 py-2 text-[var(--md-on-error-container)]">
          {error}
        </p>
      ) : null}
      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
