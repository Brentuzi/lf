import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";

type AuthPanelProps = {
  session: Session | null;
  onAuthError: (message: string | null) => void;
};

export const AuthPanel = ({ session, onAuthError }: AuthPanelProps) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [tab, setTab] = useState<"login" | "register">("login");
  const [isLoading, setIsLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [localSuccess, setLocalSuccess] = useState<string | null>(null);

  if (!supabase) {
    return (
      <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">
        Supabase не настроен. Укажите переменные окружения.
      </div>
    );
  }

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };
    document.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const resetFeedback = () => {
    setLocalError(null);
    setLocalSuccess(null);
    onAuthError(null);
  };

  const validate = () => {
    if (!email.includes("@")) {
      setLocalError("Введите корректный email");
      return false;
    }
    if (password.length < 8) {
      setLocalError("Пароль должен быть минимум 8 символов");
      return false;
    }
    return true;
  };

  const mapError = (message: string) => {
    if (message.includes("Invalid login credentials")) {
      return "Неверный email или пароль";
    }
    if (message.includes("User already registered")) {
      return "Пользователь уже зарегистрирован";
    }
    return message;
  };

  const signInWithEmail = async () => {
    resetFeedback();
    if (!validate()) return;
    if (!supabase) return;
    setIsLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      const message = mapError(error.message);
      setLocalError(message);
      onAuthError(message);
    } else {
      setIsOpen(false);
    }
    setIsLoading(false);
  };

  const signUpWithEmail = async () => {
    resetFeedback();
    if (!validate()) return;
    if (!supabase) return;
    setIsLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
    });
    if (error) {
      const message = mapError(error.message);
      setLocalError(message);
      onAuthError(message);
    } else {
      setLocalSuccess("Регистрация успешна. Проверьте почту.");
    }
    setIsLoading(false);
  };

  const signInWithProvider = async (provider: "google" | "github") => {
    resetFeedback();
    if (!supabase) return;
    setIsLoading(true);
    const redirectTo =
      typeof window !== "undefined" ? window.location.origin : undefined;
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo },
    });
    if (error) {
      const message = mapError(error.message);
      setLocalError(message);
      onAuthError(message);
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    onAuthError(null);
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) onAuthError(error.message);
  };

  if (session?.user) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-3 text-sm text-slate-200">
        <div>
          <p className="text-xs text-slate-400">Пользователь</p>
          <p className="font-semibold">{session.user.email}</p>
        </div>
        <button
          type="button"
          onClick={signOut}
          className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-200 transition hover:border-slate-500"
        >
          Выйти
        </button>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          resetFeedback();
          setIsOpen(true);
        }}
        className="rounded-full border border-slate-700 px-4 py-2 text-xs text-slate-200 transition hover:border-slate-500"
      >
        Войти / Регистрация
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl shadow-slate-950/50"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-100">
                {tab === "login" ? "Вход" : "Регистрация"}
              </h3>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-full border border-slate-700 px-2 py-1 text-xs text-slate-200"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  resetFeedback();
                  setTab("login");
                }}
                className={`flex-1 rounded-full px-3 py-2 text-xs font-semibold ${
                  tab === "login"
                    ? "bg-emerald-500 text-slate-950"
                    : "border border-slate-700 text-slate-200"
                }`}
              >
                Вход
              </button>
              <button
                type="button"
                onClick={() => {
                  resetFeedback();
                  setTab("register");
                }}
                className={`flex-1 rounded-full px-3 py-2 text-xs font-semibold ${
                  tab === "register"
                    ? "bg-emerald-500 text-slate-950"
                    : "border border-slate-700 text-slate-200"
                }`}
              >
                Регистрация
              </button>
            </div>

            <div className="mt-4 grid gap-3">
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100"
              />
              <input
                type="password"
                placeholder="Пароль"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100"
              />
              {localError && (
                <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-2 text-xs text-rose-200">
                  {localError}
                </div>
              )}
              {localSuccess && (
                <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-2 text-xs text-emerald-200">
                  {localSuccess}
                </div>
              )}
              <button
                type="button"
                onClick={tab === "login" ? signInWithEmail : signUpWithEmail}
                disabled={isLoading}
                className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-60"
              >
                {isLoading
                  ? tab === "login"
                    ? "Входим..."
                    : "Создаём..."
                  : tab === "login"
                    ? "Войти"
                    : "Зарегистрироваться"}
              </button>

              <div className="mt-2 text-center text-xs text-slate-500">
                или через соцсети
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => signInWithProvider("google")}
                  disabled={isLoading}
                  className="flex-1 rounded-full border border-slate-700 px-3 py-2 text-xs text-slate-200 transition hover:border-slate-500 disabled:opacity-60"
                >
                  Google
                </button>
                <button
                  type="button"
                  onClick={() => signInWithProvider("github")}
                  disabled={isLoading}
                  className="flex-1 rounded-full border border-slate-700 px-3 py-2 text-xs text-slate-200 transition hover:border-slate-500 disabled:opacity-60"
                >
                  GitHub
                </button>
              </div>
              <p className="text-center text-[11px] text-slate-500">
                После входа вы вернётесь в приложение.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
