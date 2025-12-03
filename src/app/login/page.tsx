"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Mail, Lock, LogIn, AlertCircle, Eye, EyeOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import { FcGoogle } from "react-icons/fc";
import { useAuth } from "@/contexts/AuthContext"; // Import useAuth
import Image from "next/image";

// Tipe untuk efek visual (sama seperti homepage)
interface BloodDrip {
  id: number;
  left: number;
  speed: number;
  delay: number;
  opacity: number;
}

interface FloatingIcon {
  id: number;
  left: number;
  top: number;
  fontSize: number;
  animationDelay: number;
  animationDuration: number;
  isSkull: boolean;
}

export default function LoginPage() {
  const { t } = useTranslation();
  const [identifier, setIdentifier] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isClient, setIsClient] = useState<boolean>(false);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const router = useRouter();
  const { user, profile, loading } = useAuth(); // Use the useAuth hook

  const registerUrl =
    typeof window !== "undefined" &&
    window.location.hostname.includes("gameforsmart.com")
      ? "https://gameforsmart.com/auth/register"
      : "https://gameforsmart2025.vercel.app/auth/register";

  useEffect(() => {
    if ((user || profile) && !loading) {
      router.replace("/");
    }
  }, [user, profile, loading, router]);

  // Efek visual sama seperti homepage
  const bloodDrips = useMemo(
    () =>
      Array.from({ length: typeof window !== "undefined" && window.innerWidth < 640 ? 4 : 8 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        speed: 2 + Math.random() * 1.5,
        delay: Math.random() * 5,
        opacity: 0.7 + Math.random() * 0.3,
      })),
    []
  );

  const floatingIcons = useMemo(
    () =>
      Array.from({ length: typeof window !== "undefined" && window.innerWidth < 640 ? 3 : 5 }, (_, i) => ({
        id: i,
        left: i * 20 + 10,
        top: i * 20 + 10,
        fontSize: 2 + (i % 3),
        animationDelay: i * 0.5,
        animationDuration: 15 + (i % 5),
        isSkull: i % 2 === 0,
      })),
    []
  );

  // Set flag client-side
  useEffect(() => {
    setIsClient(true);
  }, []);

  const resolveEmail = async (input: string) => {
    // Kalau input mengandung @ → berarti email
    if (input.includes("@")) return input.toLowerCase();

    // Kalau username → cari di tabel profiles
    const { data, error } = await supabase
      .from("profiles")
      .select("email")
      .eq("username", input)
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error(t("errorMessagesLogin.usernameNotFound")); // Use translation key

    return data.email.toLowerCase();
  };

  // Handler login dengan email/password
  const handleEmailLogin = useCallback(async () => {
    if (!identifier || !password) {
      setErrorMessage(t("errorMessagesLogin.missingInput"));
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const resolvedEmail = await resolveEmail(identifier.trim());

      const { error } = await supabase.auth.signInWithPassword({
        email: resolvedEmail,
        password,
      });

      if (error) {
        throw error; // Throw to be caught by the outer catch
      }

      toast.success(t("loginSuccess"));
      router.push("/");
    } catch (err: any) {
      console.error("Error login:", err);
      // Check if it's a specific error from resolveEmail or Supabase
      if (err.message === t("errorMessagesLogin.usernameNotFound")) {
        setErrorMessage(err.message);
      } else if (err.message.includes("invalid login credentials")) { // Specific Supabase error for invalid credentials
        setErrorMessage(t("errorMessagesLogin.invalidCredentials"));
      } else {
        setErrorMessage(t("errorMessagesLogin.loginFailed"));
      }
    } finally {
      setIsLoading(false);
    }
  }, [identifier, password, router, t]);

  // Handler login dengan Google
  const handleGoogleLogin = useCallback(async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}`,
        },
      });

      if (error) {
        setErrorMessage(t("errorMessagesLogin.googleLoginFailed"));
      }
    } catch (error) {
      console.error("Error Google login:", error);
      setErrorMessage(t("errorMessagesLogin.loginFailed"));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  return (
    <div className="min-h-screen bg-black relative overflow-hidden select-none">
      {/* Latar gradien dengan efek kabut */}
      <div className="absolute inset-0 bg-gradient-to-br from-red-900/5 via-black to-purple-900/5">
        {isClient && (
          <div className="absolute inset-0 opacity-20">
            {/* Noda darah sederhana */}
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="absolute w-32 h-32 sm:w-64 sm:h-64 bg-red-900 rounded-full mix-blend-multiply blur-xl"
                style={{
                  left: `${i * 20 + 5}%`,
                  top: `${i * 20 + 5}%`,
                  opacity: 0.3 + (i % 4) * 0.1,
                }}
              />
            ))}
          </div>
        )}
        {/* Overlay kabut */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/20 to-black/30 backdrop-blur-sm sm:backdrop-blur-md" />
      </div>

      {isClient &&
        bloodDrips.map((drip) => (
          <motion.div
            key={drip.id}
            initial={{ y: -100 }}
            animate={{ y: "100vh" }}
            transition={{ duration: drip.speed, delay: drip.delay, ease: "linear", repeat: Infinity }}
            className="fixed top-0 w-0.5 h-16 bg-gradient-to-b from-red-600 to-red-800/50"
            style={{ left: `${drip.left}%`, opacity: 0.6 + Math.random() * 0.2 }}
          />
        ))}

      {isClient && (
        <div className="absolute inset-0 pointer-events-none">
          {floatingIcons.map((icon) => (
            <div
              key={icon.id}
              className="absolute text-red-900/20 animate-float sm:animate-float"
              style={{
                left: `${icon.left}%`,
                top: `${icon.top}%`,
                fontSize: `${icon.fontSize}rem`,
                animationDelay: `${icon.animationDelay}s`,
                animationDuration: `${icon.animationDuration}s`,
                willChange: "transform",
              }}
            >
              {icon.isSkull ? <AlertCircle aria-hidden="true" /> : <Lock aria-hidden="true" />}
            </div>
          ))}
        </div>
      )}

      <div className="relative z-10 flex items-center justify-center min-h-screen p-7">
        <div className="w-full max-w-md space-y-4">
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center mt-8 pt-8"
          >
            <Image
              src="/logo/quizrushlogo.png"
              alt="QuizRush Logo"
              width={140}
              height={35}
              className="mx-auto w-48 md:w-64 lg:w-80 h-auto"
              unoptimized
              onClick={() => router.push("/")}
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3, duration: 0.8 }}
          >
            <Card className="bg-black/40 border-red-900/50 hover:border-red-500 transition-all duration-300 shadow-[0_0_15px_rgba(239,68,68,0.3)]">
              <CardHeader className="text-center pb-4">
                <CardTitle className="text-3xl font-bold text-red-400 font-mono">
                  {t("loginTitle")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-0">
                {errorMessage && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-red-600 text-sm font-mono flex items-center justify-center"
                  >
                    <AlertCircle className="w-4 h-4 mr-2" />
                    {errorMessage}
                  </motion.p>
                )}

                {/* Google Sign-in Button */}
                <Button
                  onClick={handleGoogleLogin}
                  disabled={isLoading}
                  variant="outline"
                  className="w-full border-red-500/50 text-red-400 hover:bg-red-500/20 font-mono text-base py-3 rounded-xl flex items-center justify-center"
                  aria-label={t("googleLoginButton")}
                >
                  <FcGoogle className="w-5 h-5 mr-2" />
                  {t("googleLoginButton")}
                </Button>

                {/* OR Separator */}
                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-red-500/30" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-black/40 text-red-400/80 font-mono">{t("or")}</span>
                  </div>
                </div>

                {/* Email/Username and Password Inputs */}
                <div className="space-y-4">
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-red-400/50" />
                    <Input
                      type="text" // Changed from "email" to "text"
                      placeholder={t("emailPlaceholder")} // New placeholder
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      className="bg-black/50 border-red-500/50 text-red-400 placeholder:text-red-400/50 text-sm sm:text-base font-mono h-12 rounded-xl focus:border-red-500 focus:ring-red-500/30 pl-10"
                      aria-label="Email or Username"
                    />
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-red-400/50" />
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder={t("passwordPlaceholder")}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="bg-black/50 border-red-500/50 text-red-400 placeholder:text-red-400/50 text-sm sm:text-base font-mono h-12 rounded-xl focus:border-red-500 focus:ring-red-500/30 pl-10 pr-10"
                      aria-label="Password"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-red-400/50 hover:text-red-400"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </Button>
                  </div>
                </div>

                {/* Email/Username Login Button */}
                <Button
                  onClick={handleEmailLogin}
                  disabled={!identifier || !password || isLoading}
                  className="w-full bg-gradient-to-r from-red-900 to-red-700 hover:from-red-800 hover:to-red-600 text-white font-mono text-base py-3 rounded-xl border-2 border-red-700 shadow-[0_0_15px_rgba(239,68,68,0.5)] hover:shadow-[0_0_20px_rgba(239,68,68,0.7)] transition-all duration-300 disabled:opacity-50"
                  aria-label={isLoading ? t("loggingIn") : t("loginButton")}
                >
                  <LogIn className="w-5 h-5 mr-2" aria-hidden="true" />
                  {isLoading ? t("loggingIn") : t("loginButton")}
                </Button>

                {/* REGISTER LINK */}
                <div
                  className="mt-6 text-center"
                >
                  <p className="text-red-300/90 text-xs sm:text-sm font-mono">
                    {t("login.noAccount")}{" "}
                    <a
                      href={registerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-red-400 underline hover:text-red-300 transition-all duration-200"
                    >
                      {t("login.registerHere")}
                    </a>
                  </p>
                </div>

              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes float {
          0%,
          100% {
            transform: translateY(0px) rotate(0deg);
          }
          50% {
            transform: translateY(-20px) rotate(180deg);
          }
        }
      `}</style>
    </div>
  );
}