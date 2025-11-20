"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skull, Bone, HeartPulse, Search, X, Clock, ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import Link from "next/link";
import toast, { Toaster } from "react-hot-toast";
import Image from "next/image";
import { preloadHostAssets } from "@/lib/preloadAssets";
import LoadingScreen from "@/components/LoadingScreen"; // ← Pastikan ini versi all-in-one di bawah

export default function QuizSelectPage() {
  const { t, i18n } = useTranslation();
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [filteredQuizzes, setFilteredQuizzes] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [flickerText, setFlickerText] = useState(true);
  const [bloodDrips, setBloodDrips] = useState<Array<{ id: number; left: number; speed: number; delay: number }>>([]);
  const [atmosphereText, setAtmosphereText] = useState(t("atmosphereTextInitial"));
  const [isClient, setIsClient] = useState(false);
  const [isLoading, setIsLoading] = useState(true); // ← Kontrol kapan data selesai
  const [currentPage, setCurrentPage] = useState(1);
  const [totalQuizzes, setTotalQuizzes] = useState(0);
  const quizzesPerPage = 15;
  const router = useRouter();
  const searchInputRef = useRef<HTMLInputElement>(null);

  const atmosphereTexts = useMemo(
    () => [
      t("atmosphereText1"),
      t("atmosphereText2"),
      t("atmosphereText3"),
    ],
    [t]
  );

  useEffect(() => {
    preloadHostAssets();
  }, []);

  useEffect(() => {
    setIsClient(true);

    const fetchQuizzes = async () => {
      if (searchQuery) return;

      try {
        const { count, error: countError } = await supabase
          .from("quizzes")
          .select("*", { count: "exact", head: true });
        if (countError) throw countError;
        setTotalQuizzes(count || 0);

        const { data, error } = await supabase
          .from("quizzes")
          .select("*")
          .range((currentPage - 1) * quizzesPerPage, currentPage * quizzesPerPage - 1);
        if (error) throw error;

        setQuizzes(data || []);
        setFilteredQuizzes(data || []);
      } catch (error) {
        console.error("Error fetching quizzes:", error);
        toast.error(t("errorMessages.fetchQuizzesFailed"));
      } finally {
        setIsLoading(false); // Data selesai → boleh sembunyi loading (tapi minimal 1 detik tetap jalan)
      }
    };

    fetchQuizzes();

    const generateBlood = () => {
      const newBlood = Array.from({ length: 8 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        speed: 2 + Math.random() * 1.5,
        delay: Math.random() * 5,
      }));
      setBloodDrips(newBlood);
    };
    generateBlood();

    const flickerInterval = setInterval(() => setFlickerText(prev => !prev), 150);
    const textInterval = setInterval(() => {
      setAtmosphereText(atmosphereTexts[Math.floor(Math.random() * atmosphereTexts.length)]);
    }, 2500);

    return () => {
      clearInterval(flickerInterval);
      clearInterval(textInterval);
    };
  }, [currentPage, atmosphereTexts, t, searchQuery]);

  // ==== SEARCH & PAGINATION HANDLERS (tetap sama) ====
  const handleSearchSubmit = useCallback(async () => {
    const term = searchTerm.trim();
    setSearchQuery(term);
    if (!term) { handleSearchClear(); return; }

    try {
      const lowerTerm = term.toLowerCase();
      const { data, error } = await supabase
        .from("quizzes")
        .select("*")
        .or(`theme.ilike.%${lowerTerm}%,description.ilike.%${lowerTerm}%`);
      if (error) throw error;
      setFilteredQuizzes(data || []);
    } catch (error) {
      toast.error(t("errorMessages.searchQuizzesFailed"));
    }
  }, [searchTerm, t]);

  const handleSearchClear = useCallback(() => {
    setSearchTerm("");
    setSearchQuery("");
    setFilteredQuizzes(quizzes);
    setCurrentPage(1);
    searchInputRef.current?.focus();
  }, [quizzes]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") { e.preventDefault(); handleSearchSubmit(); }
  }, [handleSearchSubmit]);

  const generateRoomCode = useCallback(() => Math.random().toString(36).substring(2, 8).toUpperCase(), []);

  const handleQuizSelect = useCallback(async (quizId: string) => {
    setIsCreating(true);

    try {
      const roomCode = generateRoomCode();
      const tabHostId = crypto.randomUUID();
      sessionStorage.setItem("currentHostId", tabHostId);

      const createRoomPromise = supabase
        .from("game_rooms")
        .insert({
          room_code: roomCode,
          title: t("title"),
          quiz_id: quizId,
          host_id: tabHostId,
        })
        .select()
        .single();

      const minDelayPromise = new Promise((resolve) => setTimeout(resolve, 500));

      const [{ error }] = await Promise.all([createRoomPromise, minDelayPromise]);

      if (error) {
        throw error;
      }

      router.push(`/host/${roomCode}/character-select`);
    } catch (error) {
      console.error("Error creating game:", error);
      toast.error(t("errorMessages.createGameFailed"));
      setIsCreating(false);
    }
  }, [router, generateRoomCode, t]);

  const handlePageChange = useCallback((page: number) => setCurrentPage(page), []);

  const totalPages = Math.ceil(totalQuizzes / quizzesPerPage);
  const isSearching = searchQuery.trim().length > 0;

  if (isCreating) {
    return <LoadingScreen isReady={false} children={undefined} />;
  }

  // ==== RENDER ====
  return (
    <LoadingScreen minDuration={500} isReady={!isLoading}>
      {/* SEMUA KONTEN HALAMAN DI BAWAH INI */}
      <div className="min-h-screen relative overflow-hidden select-none flex flex-col main-background bg-black" style={{ backgroundImage: "url('/background/12.gif')", backgroundPosition: "center" }}>

        {/* Blood drips */}
        {isClient && bloodDrips.map((drip) => (
          <motion.div
            key={drip.id}
            initial={{ y: -100 }}
            animate={{ y: "100vh" }}
            transition={{ duration: drip.speed, delay: drip.delay, ease: "linear", repeat: Infinity }}
            className="fixed top-0 w-0.5 h-16 bg-gradient-to-b from-red-600 to-red-800/50"
            style={{ left: `${drip.left}%`, opacity: 0.6 + Math.random() * 0.2 }}
          />
        ))}

        {/* Floating icons & effects */}
        {isClient && (
          <div className="absolute inset-0 pointer-events-none">
            {Array.from({ length: 8 }, (_, i) => (
              <div
                key={i}
                className="absolute text-red-900/20 animate-float"
                style={{
                  left: `${i * 12 + 10}%`,
                  top: `${i * 12 + 10}%`,
                  fontSize: `${2 + (i % 3)}rem`,
                  animationDelay: `${i * 0.5}s`,
                  animationDuration: `${15 + (i % 5)}s`,
                }}
              >
                {i % 2 === 0 ? <Skull /> : <Bone />}
              </div>
            ))}
          </div>
        )}

        {/* Scratch overlay & red corners */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxkZWZzPjxwYXR0ZXJuIGlkPSJzY3JhdGNoZXMiIHBhdHRlcm5Vbml0cz0idXNlclNwYWNlT25Vc2UiIHdpZHRoPSI1MDAiIGhlaWdodD0iNTAwIj48cGF0aCBkPSJNMCAwTDUwMCA1MDAiIHN0cm9rZT0icmdiYSgyNTUsMCwwLDAuMDMpIiBzdHJva2Utd2lkdGg9IjEiLz48cGF0aCBkPSJNMCAxMDBLNTAwIDYwMCIgc3Ryb2tlPSJyZ2JhKDI1NSwwLDAsMC4wMykiIHN0cm9rZS13aWR0aD0iMSIvPjxwYXRoIGQ9Ik0wIDIwMEw1MDAgNzAwIiBzdHJva2U9InJnYmEoMjU1LDAsMCwwLjAzKSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI3NjcmF0Y2hlcykiIG9wYWNpdHk9IjAuMyIvPjwvc3ZnPg==')] opacity-20" />
        {["top-0 left-0", "top-0 right-0", "bottom-0 left-0", "bottom-0 right-0"].map((pos, i) => (
          <div key={i} className={`absolute w-64 h-64 opacity-20 ${pos}`}>
            <div className="absolute w-full h-full bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-red-900/70 to-transparent" />
          </div>
        ))}

        <div className="relative z-10 flex flex-col min-h-screen p-7">
          {/* Header & Search */}
          <motion.header initial={{ opacity: 0, y: -50 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1, delay: 0.3, type: "spring", stiffness: 120 }} className="flex flex-col gap-1 mb-10">
            <div className="hidden md:flex items-center justify-between mb-5 md:mb-0">
              <Image 
                  src="/logo/quizrushlogo.png" 
                  alt="QuizRush Logo" 
                  width={140}   // turunin sedikit biar proporsional
                  height={35}   // sesuaikan tinggi
                  className="w-32 md:w-40 lg:w-48 h-auto"   // ini yang paling berpengaruh
                  unoptimized 
                />
              <img src={`/logo/gameforsmartlogo-horror.png`} alt="Logo" className="w-40 md:w-52 lg:w-64 h-auto" />
            </div>

            <div className="flex items-center justify-center w-full">
              <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="max-w-[19.4rem]" style={{ width: `${12 * 1.618}rem` }}>
                <div className="relative">
                  <Input ref={searchInputRef} placeholder={t("searchButton")} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} onKeyDown={handleKeyDown}
                    className="bg-black/70 border-red-500/50 text-red-400 placeholder:text-red-400/50 text-base font-mono h-12 rounded-full focus:border-red-500 focus:ring-red-500/30 backdrop-blur-sm pr-12"
                  />
                  {searchTerm && <Button variant="ghost" size="icon" className="absolute right-10 top-1/2 -translate-y-1/2 text-red-400/60 hover:text-red-400" onClick={handleSearchClear}><X className="h-4 w-4" /></Button>}
                  <Button variant="ghost" size="icon" className="absolute right-3 top-1/2 -translate-y-1/2 text-red-400/80 hover:text-red-400" onClick={handleSearchSubmit} disabled={!searchTerm.trim()}><Search className="h-5 w-5" /></Button>
                </div>
              </motion.div>
            </div>
          </motion.header>

          {/* Quiz Grid */}
          <div className="w-full max-w-8xl mx-auto flex flex-col flex-1 px-2 md:px-8 gap-5">
            {/* ... seluruh bagian grid quiz, pagination, dll tetap persis seperti kode asli kamu ... */}
            {/* (Aku potong biar nggak kepanjangan, tapi kamu tinggal copy-paste bagian return asli kamu di sini) */}
            {isSearching ? (
              filteredQuizzes.length > 0 ? (
                <div className="mt-4 grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                  {filteredQuizzes.map((quiz) => (
                    <motion.div key={quiz.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
                      <Card className="bg-black/40 border-red-500/20 hover:border-red-500 cursor-pointer shadow-[0_0_10px_rgba(239,68,68,0.3)] hover:shadow-[0_0_15px_rgba(239,68,68,0.5)] h-full" onClick={() => handleQuizSelect(quiz.id)}>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-red-400 font-mono text-lg line-clamp-2">{quiz.theme}</CardTitle>
                          <CardDescription className="text-gray-300 text-sm line-clamp-3">{quiz.description || t("defaultQuizDescription")}</CardDescription>
                        </CardHeader>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-red-400/80 text-base font-mono mt-4">{t("noQuizzesFound")}</div>
              )
            ) : filteredQuizzes.length === 0 ? (
              <div className="text-center text-red-400/80 text-base font-mono flex-1 flex items-center justify-center">{t("noQuizzesAvailable")}</div>
            ) : (
              <>
                <div className="mt-4 grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                  {filteredQuizzes.map((quiz) => (
                    <motion.div key={quiz.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 * (quiz.id % 4), duration: 0.5 }} whileHover={{ scale: 1.02 }}>
                      <Card className="bg-black/50 border-red-500/20 hover:border-red-500 cursor-pointer shadow-[0_0_10px_rgba(239,68,68,0.3)] hover:shadow-[0_0_15px_rgba(239,68,68,0.5)] h-full" onClick={() => handleQuizSelect(quiz.id)}>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-red-400 font-mono text-lg line-clamp-2">{quiz.theme}</CardTitle>
                          <CardDescription className="text-gray-300 text-sm line-clamp-3">{quiz.description || t("defaultQuizDescription")}</CardDescription>
                        </CardHeader>
                      </Card>
                    </motion.div>
                  ))}
                </div>

                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mt-auto pb-3">
                  <div className="flex justify-center gap-4">
                    <Button variant="outline" size="icon" className="bg-black/50 border-red-500/50 text-red-400 hover:bg-red-900/20" onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1 || isCreating || isSearching}>
                      <ChevronLeft className="h-5 w-5" />
                    </Button>
                    <span className="text-red-400 font-mono text-sm self-center">{t("pageInfo", { current: currentPage, total: totalPages })}</span>
                    <Button variant="outline" size="icon" className="bg-black/50 border-red-500/50 text-red-400 hover:bg-red-900/20" onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages || isCreating}>
                      <ChevronRight className="h-5 w-5" />
                    </Button>
                  </div>
                </motion.div>
              </>
            )}
          </div>
        </div>

        {/* Global styles (tetap) */}
        <style jsx global>{`
          .main-background { background-size: 60%; background-repeat: no-repeat; }
          @media (min-width: 768px) { .main-background { background-size: 60%; } }
          @keyframes float { 0%,100% { transform: translateY(0) rotate(0deg); } 50% { transform: translateY(-20px) rotate(180deg); } }
          .animate-float { animation: float 20s infinite ease-in-out; }
          .line-clamp-2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
          .line-clamp-3 { display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
        `}</style>
      </div>
    </LoadingScreen>
  );
}