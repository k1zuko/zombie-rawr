"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skull, Bone, HeartPulse, Search, Loader2, X, Clock, ArrowRight, List, Settings } from "lucide-react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import Link from "next/link";
import toast from "react-hot-toast";
import Image from "next/image";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";

export default function QuizSelectTryoutPage() {
  const { t, i18n } = useTranslation();
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [filteredQuizzes, setFilteredQuizzes] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSelectingQuiz, setIsSelectingQuiz] = useState(false);
  const [flickerText, setFlickerText] = useState(true);
  const [bloodDrips, setBloodDrips] = useState<Array<{ id: number; left: number; speed: number; delay: number }>>([]);
  const [atmosphereText, setAtmosphereText] = useState(t("atmosphereTextInitial"));
  const [isClient, setIsClient] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalQuizzes, setTotalQuizzes] = useState(0);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [selectedQuiz, setSelectedQuiz] = useState<any | null>(null);
  const [numQuestions, setNumQuestions] = useState(10); // Nilai default
  const [duration, setDuration] = useState(300); // Nilai default dalam detik (5 menit)
  const [totalQuestions, setTotalQuestions] = useState(25); // Default max, will fetch actual
  const [questionError, setQuestionError] = useState<string | null>(null);
  const [durationError, setDurationError] = useState<string | null>(null);
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
        toast.error(t("errorMessages.fetchQuizzesFailed"));
      } finally {
        setIsLoading(false);
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

    const flickerInterval = setInterval(() => {
      setFlickerText((prev) => !prev);
    }, 150);

    const textInterval = setInterval(() => {
      setAtmosphereText(atmosphereTexts[Math.floor(Math.random() * atmosphereTexts.length)]);
    }, 2500);

    return () => {
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
      toast.error(t("errorMessages.searchQuizzesFailed"));
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

  // ---- QUIZ SELECTION ----
  // Ganti fungsi handleQuizSelect yang lama
  const handleOpenSettings = useCallback((quiz: any) => {
    setSelectedQuiz(quiz);
    setIsSettingsModalOpen(true);
  }, []);

  // Fetch total questions when selectedQuiz changes
  // Fetch total questions when selectedQuiz changes
  useEffect(() => {
    if (!selectedQuiz) return;

    const fetchTotalQuestions = async () => {
      try {
        const { count: questionsCount, error: questionsError } = await supabase
          .from("quiz_questions")
          .select("*", { count: "exact", head: true })
          .eq("quiz_id", selectedQuiz.id);

        if (questionsError) {
          console.error("Error fetching questions count:", questionsError);
          setTotalQuestions(25);
          setNumQuestions(10);   // fallback default
          return;
        }

        const total = questionsCount || 25;
        setTotalQuestions(total);

        // reset / adjust numQuestions sekali aja di sini
        setNumQuestions((prev) => {
          if (!prev || prev === 10) {
            return Math.min(10, total);  // default awal
          }
          if (prev > total) {
            return total;                // sesuaikan kalau kebanyakan
          }
          return prev;                   // biarin kalau masih valid
        });
      } catch (error) {
        console.error("Failed to fetch total questions:", error);
        setTotalQuestions(25);
        setNumQuestions(10);
      }
    };

    fetchTotalQuestions();
  }, [selectedQuiz]);


  // Handler for duration slider
  const handleDurationChange = (value: number[]) => {
    const newValue = value[0];
    if (newValue < 5 || newValue > 30) {
      setDurationError(t("durationError")); // Assuming you have translation for error
      return;
    }
    setDurationError(null);
    setDuration(newValue * 60); // Convert minutes to seconds
  };

  // Handler for question count slider
  const handleQuestionCountChange = (value: number[]) => {
    const newValue = value[0];
    if (newValue >= 5 && newValue <= totalQuestions) {
      setQuestionError(null);
      setNumQuestions(newValue);
    } else {
      setQuestionError(t("questionError")); // Assuming translation for error
    }
  };

  // In handleStartQuiz, store in minutes for duration if needed, but since you store seconds, adjust accordingly
  const handleStartQuiz = useCallback(() => {
    if (!selectedQuiz) return;
    setIsSelectingQuiz(true);

    const keys = Object.keys(localStorage);
    keys.forEach((k) => {
      if (k.startsWith("tryout_")) {
        localStorage.removeItem(k);
      }
    });

    localStorage.setItem("quizConfig", JSON.stringify({
      questions: numQuestions,
      duration: duration, // Already in seconds
    }));

    setTimeout(() => {
      router.push(`/tryout/${selectedQuiz.id}`);
    }, 500);
  }, [router, selectedQuiz, numQuestions, duration]);

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
      {isSelectingQuiz && (
        <div className="fixed inset-0 bg-black flex items-center justify-center z-20">
          <div className="flex flex-col items-center">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
              className="w-12 h-12 border-4 border-red-500 border-t-transparent rounded-full relative z-10"
            >
              <div className="absolute inset-0 rounded-full border-4 border-red-900 border-l-transparent border-r-transparent animate-ping" />
            </motion.div>
            <motion.p
              className="mt-4 text-red-400 font-mono text-sm"
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              {t("loading")}
            </motion.p>
          </div>
        </div>
      )}


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

      <div className="relative z-10 flex flex-col min-h-screen p-7">
        <motion.header
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.3, type: "spring", stiffness: 120 }}
          className="flex flex-col gap-1 mb-10"
        >
          <div className="flex items-center justify-between mb-5 md:mb-0">
            <Link href={"/"}>
              <h1
                className="text-2xl md:text-4xl font-bold font-mono tracking-wider text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.7)]"
                style={{ textShadow: "0 0 10px rgba(239, 68, 68, 0.7)" }}
              >
                {t("title")}
              </h1>
            </Link>
            <img
              src={`/logo/gameforsmartlogo-horror.png`}
              alt="Game for Smart Logo"
              className="w-40 md:w-52 lg:w-64 h-auto"
            />
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.5, type: "spring", stiffness: 100 }}
            className="flex justify-center items-center text-center"
          >
            <HeartPulse className="w-10 h-10 text-red-500 mr-4 animate-pulse" />
            <h1
              className={`text-4xl md:text-6xl font-bold font-mono tracking-wider transition-all duration-150 text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.7)] animate-pulse`}
              style={{ textShadow: "0 0 10px rgba(239, 68, 68, 0.7)" }}
            >
              {t("selectQuizTitle")}
            </h1>
            <HeartPulse className="w-10 h-10 text-red-500 ml-4 animate-pulse" />
          </motion.div>
        </motion.header>

        <div className="w-full max-w-8xl mx-auto flex flex-col flex-1 px-2 md:px-8 gap-5">
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

          {isLoading ? (
            <div className="flex items-center justify-center w-full mx-auto mt-10 pt-10">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
                className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full"
              />
            </div>
          ) : isSearching ? (
            filteredQuizzes.length > 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className={`mt-4 grid gap-4 grid-cols-1 ${{
                  1: "md:grid-cols-1",
                  2: "md:grid-cols-2",
                  3: "md:grid-cols-3",
                  4: "md:grid-cols-4",
                }[Math.min(filteredQuizzes.length, 5)] || "md:grid-cols-5"
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
                      onClick={() => handleOpenSettings(quiz)}
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") handleOpenSettings(quiz);
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
            filteredQuizzes.length === 0 ? (
              <div className="text-center text-red-400/80 text-base font-mono flex-1 flex items-center justify-center">
                {t("noQuizzesAvailable")}
              </div>
            ) : (
              <div className="flex flex-col flex-1 gap-7">
                <div
                  className={`mt-4 grid gap-4 grid-cols-1 ${{
                    1: "md:grid-cols-1",
                    2: "md:grid-cols-2",
                    3: "md:grid-cols-3",
                    4: "md:grid-cols-4",
                  }[Math.min(filteredQuizzes.length, 5)] || "md:grid-cols-5"
                    }`}
                >
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
                        onClick={() => handleOpenSettings(quiz)}
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") handleOpenSettings(quiz);
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
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                >
                  <div className="flex justify-center gap-4">
                    <Button
                      variant="outline"
                      className="bg-black/50 border-red-500/50 text-red-400 hover:bg-red-900/20 text-sm py-1"
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
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
                      disabled={currentPage === totalPages}
                    >
                      {t("nextButton")}
                    </Button>
                  </div>
                </motion.div>
              </div>
            )
          )}
          {/* MODAL PENGATURAN KUIS */}
          {isSettingsModalOpen && selectedQuiz && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
              onClick={() => setIsSettingsModalOpen(false)}
            >
              <motion.div
                initial={{ y: -50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -50, opacity: 0 }}
                className="bg-gray-900 border border-red-500/50 rounded-lg p-8 w-full max-w-md font-mono text-red-400 relative"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center mb-1 space-x-2">
                  <Settings />
                  <h2 className="text-2xl font-mono font-semibold text-red-500">{t("settingsTitle")}</h2>
                </div>
                <p className="text-gray-300 mb-6">{selectedQuiz.theme}</p>

                {/* Pengaturan Durasi - Using Slider */}
                <div className="mb-6">
                  <Label htmlFor="duration" className="text-red-300 mb-2 block font-medium text-sm font-mono flex items-center">
                    {t("duration")}
                    <Clock className="w-4 h-4 ml-2 text-red-500" />
                  </Label>
                  <Slider
                    id="duration"
                    min={5}
                    max={30}
                    step={5}
                    value={[duration / 60]} // Display in minutes
                    onValueChange={handleDurationChange}
                    className="w-full mb-4"
                    aria-label={t("duration")}
                  />
                  <p className="text-red-400 font-mono text-sm">
                    {duration / 60} {t("minutes")}
                  </p>
                  {durationError && (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-red-500 text-xs mt-1 animate-pulse"
                    >
                      {durationError}
                    </motion.p>
                  )}
                </div>

                {/* Pengaturan Jumlah Soal - Using Slider */}
                <div className="mb-6">
                  <Label htmlFor="numQuestions" className="text-red-300 mb-2 block font-medium text-sm font-mono flex items-center">
                    {t("questionCountLabel")}
                    <List className="w-4 h-4 ml-2 text-red-500" />
                  </Label>
                  <Slider
                    id="numQuestions"
                    min={5}
                    max={totalQuestions}
                    step={5}
                    value={[numQuestions]}
                    onValueChange={handleQuestionCountChange}
                    className="w-full"
                    aria-label={t("selectQuestionCount")}
                  />
                  <p className="text-red-400 font-mono text-sm mt-2">
                    {numQuestions} {t("questions")} {numQuestions === totalQuestions ? `(${t("allLabel")})` : ""}
                  </p>
                  {questionError && (
                    <p className="text-red-500 text-xs mt-1 animate-pulse">{questionError}</p>
                  )}
                </div>

                <div className="flex justify-between items-center">
                  <Button variant="outline" className="border-red-500/50 hover:bg-red-900/20" onClick={() => setIsSettingsModalOpen(false)}>
                    {t("cancel")}
                  </Button>
                  <Button className="bg-red-700 hover:bg-red-600 text-white" onClick={handleStartQuiz}>
                    {t("start")}
                  </Button>
                </div>
              </motion.div>
            </motion.div>
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