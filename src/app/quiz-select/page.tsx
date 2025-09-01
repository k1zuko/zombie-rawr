"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skull, Bone, HeartPulse, Search, Loader2, X, Clock } from "lucide-react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import Link from "next/link";

export default function QuizSelectPage() {
  const { t, i18n } = useTranslation();
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [filteredQuizzes, setFilteredQuizzes] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchQuery, setSearchQuery] = useState(""); // actual submitted query
  const [isCreating, setIsCreating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [flickerText, setFlickerText] = useState(true);
  const [bloodDrips, setBloodDrips] = useState<Array<{ id: number; left: number; speed: number; delay: number }>>([]);
  const [atmosphereText, setAtmosphereText] = useState(t("atmosphereTextInitial"));
  const [isClient, setIsClient] = useState(false);
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
    setIsClient(true);

    const fetchQuizzes = async () => {
      if (searchQuery) return; // Skip paginated fetch if searching
      setIsLoading(true);
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
        alert(t("errorMessages.fetchQuizzesFailed"));
      } finally {
        setIsLoading(false);
      }
    };

    fetchQuizzes();

    const generateBlood = () => {
      const newBlood = Array.from({ length: 8 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        speed: 0.5 + Math.random() * 2,
        delay: Math.random() * 5,
      }));
      setBloodDrips(newBlood);
    };

    generateBlood();
    const bloodInterval = setInterval(() => {
      generateBlood();
    }, 8000);

    const flickerInterval = setInterval(() => {
      setFlickerText((prev) => !prev);
    }, 150);

    const textInterval = setInterval(() => {
      setAtmosphereText(atmosphereTexts[Math.floor(Math.random() * atmosphereTexts.length)]);
    }, 2500);

    return () => {
      clearInterval(bloodInterval);
      clearInterval(flickerInterval);
      clearInterval(textInterval);
    };
  }, [currentPage, atmosphereTexts, t, searchQuery]);

  // ---- SEARCH HANDLERS ----
  const handleSearchSubmit = useCallback(async () => {
    const term = searchTerm.trim();
    setSearchQuery(term);

    if (!term) {
      handleSearchClear();
      return;
    }

    setIsLoading(true);
    const lowerTerm = term.toLowerCase();
    try {
      const { data, error } = await supabase
        .from("quizzes")
        .select("*")
        .or(`theme.ilike.%${lowerTerm}%,description.ilike.%${lowerTerm}%`);
      if (error) throw error;
      setFilteredQuizzes(data || []);
    } catch (error) {
      console.error("Error searching quizzes:", error);
      alert(t("errorMessages.searchQuizzesFailed"));
    } finally {
      setIsLoading(false);
    }
  }, [searchTerm, t]);

  const handleSearchClear = useCallback(() => {
    setSearchTerm("");
    setSearchQuery("");
    setFilteredQuizzes(quizzes);
    setCurrentPage(1); // Reset to first page for consistency
    searchInputRef.current?.focus();
  }, [quizzes]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleSearchSubmit();
      }
    },
    [handleSearchSubmit]
  );

  // --------------------------

  const generateRoomCode = useCallback(() => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }, []);

  const handleQuizSelect = useCallback(
    async (quizId: string) => {
      setIsCreating(true);
      try {
        const roomCode = generateRoomCode();
        const tabHostId = crypto.randomUUID();
        sessionStorage.setItem("currentHostId", tabHostId);

        const { data, error } = await supabase
          .from("game_rooms")
          .insert({
            room_code: roomCode,
            title: t("title"),
            quiz_id: quizId,
            host_id: tabHostId,
          })
          .select()
          .single();

        if (error) throw error;

        router.push(`/character-select/${roomCode}`);
      } catch (error) {
        console.error("Error creating game:", error);
        alert(t("errorMessages.createGameFailed"));
      } finally {
        setIsCreating(false);
      }
    },
    [router, generateRoomCode, t]
  );

  const handleBackClick = useCallback(() => {
    router.push("/");
  }, [router]);

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  const totalPages = Math.ceil(totalQuizzes / quizzesPerPage);

  const bloodSpots = useMemo(
    () =>
      Array.from({ length: 10 }, (_, i) => ({
        id: i,
        left: i * 10 + 5,
        top: i * 10 + 5,
        opacity: 0.3 + (i % 4) * 0.1,
      })),
    []
  );

  const floatingIcons = useMemo(
    () =>
      Array.from({ length: 8 }, (_, i) => ({
        id: i,
        left: i * 12 + 10,
        top: i * 12 + 10,
        fontSize: 2 + (i % 3),
        animationDelay: i * 0.5,
        animationDuration: 15 + (i % 5),
        isSkull: i % 2 === 0,
      })),
    []
  );

  // Function to change language
  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  const isSearching = searchQuery.trim().length > 0;

  return (
    <div className="min-h-screen bg-black relative overflow-hidden select-none flex flex-col">
      <div className="absolute inset-0 bg-gradient-to-br from-red-900/5 via-black to-purple-900/5">
        {isClient && (
          <div className="absolute inset-0 opacity-20">
            {bloodSpots.map((spot) => (
              <div
                key={spot.id}
                className="absolute w-64 h-64 bg-red-900 rounded-full mix-blend-multiply blur-xl"
                style={{
                  left: `${spot.left}%`,
                  top: `${spot.top}%`,
                  opacity: spot.opacity,
                }}
              />
            ))}
          </div>
        )}
      </div>

      {isClient &&
        bloodDrips.map((drip) => (
          <div
            key={drip.id}
            className="absolute top-0 w-0.5 h-20 bg-red-600/80 animate-fall"
            style={{
              left: `${drip.left}%`,
              animation: `fall ${drip.speed}s linear ${drip.delay}s infinite`,
              opacity: 0.7 + Math.random() * 0.3,
            }}
          />
        ))}

      {isClient && (
        <div className="absolute inset-0 pointer-events-none">
          {floatingIcons.map((icon) => (
            <div
              key={icon.id}
              className="absolute text-red-900/20 animate-float"
              style={{
                left: `${icon.left}%`,
                top: `${icon.top}%`,
                fontSize: `${icon.fontSize}rem`,
                animationDelay: `${icon.animationDelay}s`,
                animationDuration: `${icon.animationDuration}s`,
              }}
            >
              {icon.isSkull ? <Skull /> : <Bone />}
            </div>
          ))}
        </div>
      )}

      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxkZWZzPjxwYXR0ZXJuIGlkPSJzY3JhdGNoZXMiIHBhdHRlcm5Vbml0cz0idXNlclNwYWNlT25Vc2UiIHdpZHRoPSI1MDAiIGhlaWdodD0iNTAwIj48cGF0aCBkPSJNMCAwTDUwMCA1MDAiIHN0cm9rZT0icmdiYSgyNTUsMCwwLDAuMDMpIiBzdHJva2Utd2lkdGg9IjEiLz48cGF0aCBkPSJNMCAxMDBMNTAwIDYwMCIgc3Ryb2tlPSJyZ2JhKDI1NSwwLDAsMC4wMykiIHN0cm9rZS13aWR0aD0iMSIvPjxwYXRoIGQ9Ik0wIDIwMEw1MDAgNzAwIiBzdHJva2U9InJnYmEoMjU1LDAsMCwwLjAzKSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI3NjcmF0Y2hlcykiIG9wYWNpdHk9IjAuMyIvPjwvc3ZnPg==')] opacity-20" />

      <div className="absolute top-0 left-0 w-64 h-64 opacity-20">
        <div className="absolute w-full h-full bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-red-900/70 to-transparent" />
      </div>
      <div className="absolute top-0 right-0 w-64 h-64 opacity-20">
        <div className="absolute w-full h-full bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-red-900/70 to-transparent" />
      </div>
      <div className="absolute bottom-0 left-0 w-64 h-64 opacity-20">
        <div className="absolute w-full h-full bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-red-900/70 to-transparent" />
      </div>
      <div className="absolute bottom-0 right-0 w-64 h-64 opacity-20">
        <div className="absolute w-full h-full bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-red-900/70 to-transparent" />
      </div>


      <div className="relative z-10 flex flex-col min-h-screen p-5">
        <motion.header
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.3, type: "spring", stiffness: 120 }}
          className="flex flex-col gap-1 mb-10"
        >
          <div className="flex items-start">
            <Link href={"/"}>
              <h1
                className="text-4xl font-bold font-mono tracking-wider text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.7)]"
                style={{ textShadow: "0 0 10px rgba(239, 68, 68, 0.7)" }}
              >
                {t("title")}
              </h1>
            </Link>
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.5, type: "spring", stiffness: 100 }}
            className="flex justify-center items-center text-center"
          >
            <HeartPulse className="w-12 h-12 text-red-500 mr-4 animate-pulse" />
            <h1
              className={`text-4xl md:text-6xl font-bold font-mono tracking-wider transition-all duration-150 ${flickerText ? "text-red-500 opacity-100" : "text-red-900 opacity-30"
                } drop-shadow-[0_0_8px_rgba(239,68,68,0.7)]`}
              style={{ textShadow: "0 0 10px rgba(239, 68, 68, 0.7)" }}
            >
              {t("selectQuizTitle")}
            </h1>
            <HeartPulse className="w-12 h-12 text-red-500 ml-4 animate-pulse" />
          </motion.div>
        </motion.header>

        <div className="w-full max-w-8xl mx-auto flex flex-col flex-1 px-2 md:px-8 gap-5">
          {/* SEARCH INPUT (visible from start). Search runs only on Enter or clicking the search icon. */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="max-w-xl mx-auto"
          >
            <div className="relative">
              <Input
                ref={searchInputRef}
                placeholder={t("searchButton")}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={handleKeyDown}
                className="bg-black/70 border-red-500/50 text-red-400 placeholder:text-red-400/50 text-base font-mono h-12 rounded-xl focus:border-red-500 focus:ring-red-500/30 backdrop-blur-sm"
              />

              {/* tombol clear X (hanya muncul kalau ada teks), posisinya sebelum tombol submit */}
              {searchTerm && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-12 top-1/2 -translate-y-1/2 text-red-400/60 hover:text-red-400"
                  onClick={handleSearchClear}
                  aria-label={t("closeSearch")}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}

              {/* tombol submit search */}
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-red-400/80 hover:text-red-400"
                disabled={searchTerm.trim().length === 0}
                onClick={handleSearchSubmit}
                aria-label={t("searchButton")}
              >
                <Search className="h-5 w-5" />
              </Button>
            </div>
          </motion.div>

          {/* If user has submitted a search (Enter or icon click), show results for that query.
    Otherwise show default quiz grid / pagination. */}
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 w-full mx-auto min-h-[50vh]">
              {Array.from({ length: 4 }).map((_, i) => (
                <Card key={i} className="bg-black/40 border-red-500/20 h-[150px] animate-pulse" />
              ))}
            </div>
          ) : isSearching ? (
            filteredQuizzes.length > 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className={`mt-4 grid gap-4 ${{
                  1: "grid-cols-1",
                  2: "grid-cols-2",
                  3: "grid-cols-3",
                  4: "grid-cols-4",
                }[Math.min(filteredQuizzes.length, 5)] || "grid-cols-5"
                  }`}
              >
                {filteredQuizzes.map((quiz) => (
                  <motion.div
                    key={quiz.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="w-full"
                  >
                    <Card
                      className="bg-black/40 border-red-500/20 hover:border-red-500 cursor-pointer shadow-[0_0_10px_rgba(239,68,68,0.3)] hover:shadow-[0_0_15px_rgba(239,68,68,0.5)] h-full flex flex-col"
                      style={{ minHeight: "150px", maxHeight: "200px" }}
                      onClick={() => handleQuizSelect(quiz.id)}
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") handleQuizSelect(quiz.id);
                      }}
                      aria-label={t("selectQuiz", { theme: quiz.theme })}
                    >
                      <CardHeader className="pb-2 flex-shrink-0">
                        <CardTitle className="text-red-400 font-mono text-lg line-clamp-2">{quiz.theme}</CardTitle>
                        <CardDescription className="text-gray-300 text-sm line-clamp-3">
                          {quiz.description || t("defaultQuizDescription")}
                        </CardDescription>
                      </CardHeader>
                    </Card>
                  </motion.div>
                ))}
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="text-center text-red-400/80 text-base font-mono mt-4"
              >
                {t("noQuizzesFound")}
              </motion.div>
            )
          ) : (
            // default grid + pagination when not searching
            filteredQuizzes.length === 0 ? (
              <div className="text-center text-red-400/80 text-base font-mono flex-1 flex items-center justify-center">
                {t("noQuizzesAvailable")}
              </div>
            ) : (
              <div className="flex flex-col flex-1">
                <div className={`mt-4 grid gap-4 ${{
                  1: "grid-cols-1",
                  2: "grid-cols-2",
                  3: "grid-cols-3",
                  4: "grid-cols-4",
                }[Math.min(filteredQuizzes.length, 5)] || "grid-cols-5"
                  }`}>
                  {filteredQuizzes.map((quiz) => (
                    <motion.div
                      key={quiz.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 * (quiz.id % 4), duration: 0.5 }}
                      whileHover={{ scale: 1.02 }}
                      className="w-full"
                    >
                      <Card
                        className="bg-black/50 border-red-500/20 hover:border-red-500 cursor-pointer shadow-[0_0_10px_rgba(239,68,68,0.3)] hover:shadow-[0_0_15px_rgba(239,68,68,0.5)] h-full flex flex-col"
                        style={{ minHeight: "150px", maxHeight: "200px" }}
                        onClick={() => handleQuizSelect(quiz.id)}
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") handleQuizSelect(quiz.id);
                        }}
                        aria-label={t("selectQuiz", { theme: quiz.theme })}
                      >
                        <CardHeader className="pb-2 flex-shrink-0">
                          <CardTitle className="text-red-400 font-mono text-lg line-clamp-2">{quiz.theme}</CardTitle>
                          <CardDescription className="text-gray-300 text-sm line-clamp-3">
                            {quiz.description || t("defaultQuizDescription")}
                          </CardDescription>
                        </CardHeader>
                      </Card>
                    </motion.div>
                  ))}
                </div>
                <motion.div
                  className="mt-4"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                >
                  <div className="flex justify-center gap-4">
                    <Button
                      variant="outline"
                      className="bg-black/50 border-red-500/50 text-red-400 hover:bg-red-900/20 text-sm py-1"
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1 || isCreating}
                    >
                      {t("previousButton")}
                    </Button>
                    <span className="text-red-400 font-mono text-sm self-center">
                      {t("pageInfo", { current: currentPage, total: totalPages })}
                    </span>
                    <Button
                      variant="outline"
                      className="bg-black/50 border-red-500/50 text-red-400 hover:bg-red-900/20 text-sm py-1"
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages || isCreating}
                    >
                      {t("nextButton")}
                    </Button>
                  </div>
                </motion.div>
              </div>
            )
          )}
        </div>
      </div>

      <style jsx global>{`
        @keyframes fall {
          to {
            transform: translateY(100vh);
          }
        }
        @keyframes float {
          0%,
          100% {
            transform: translateY(0px) rotate(0deg);
          }
          50% {
            transform: translateY(-20px) rotate(180deg);
          }
        }
        @keyframes pulse-glow {
          0%,
          100% {
            box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7);
          }
          50% {
            box-shadow: 0 0 15px 5px rgba(239, 68, 68, 0.4);
          }
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(26, 0, 0, 0.8);
          border-left: 2px solid rgba(255, 0, 0, 0.3);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: linear-gradient(to bottom, #8b0000, #ff0000);
          border-radius: 4px;
        }
        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .line-clamp-3 {
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .animate-pulse-glow {
          animation: pulse-glow 2s infinite;
        }
      `}</style>
    </div>
  );
}
