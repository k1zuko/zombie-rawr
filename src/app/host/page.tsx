"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Skull,
  Bone,
  HeartPulse,
  Search,
  X,
  Clock,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Heart,
  User,
  HelpCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { mysupa, supabase } from "@/lib/supabase";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { TooltipProvider } from "@radix-ui/react-tooltip";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import Link from "next/link";
import toast, { Toaster } from "react-hot-toast";
import Image from "next/image";
import { preloadHostAssets } from "@/lib/preloadAssets";
import LoadingScreen from "@/components/LoadingScreen";
import { useAuth } from "@/contexts/AuthContext";
import { generateXID } from "@/lib/id-generator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { generateGamePin } from "@/utils/gameHelpers";
import { set } from "lodash";

// Custom hook untuk debounce
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export default function QuizSelectPage() {
  const { t, i18n } = useTranslation();
  const { user, profile: authProfile, loading: authLoading } = useAuth();
  const [allQuizzesForCategories, setAllQuizzesForCategories] = useState<any[]>(
    []
  );
  const [paginatedQuizzes, setPaginatedQuizzes] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [isCreating, setIsCreating] = useState(false);
  const [isLoadingInitial, setIsLoadingInitial] = useState(true); // Untuk initial load
  const [isFetching, setIsFetching] = useState(false); // Untuk search/filter
  const [flickerText, setFlickerText] = useState(true);
  const [bloodDrips, setBloodDrips] = useState<
    Array<{ id: number; left: number; speed: number; delay: number }>
  >([]);
  const [atmosphereText, setAtmosphereText] = useState(
    t("atmosphereTextInitial")
  );
  const [isClient, setIsClient] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [favoritesMode, setFavoritesMode] = useState(false);
  const [myQuizzesMode, setMyQuizzesMode] = useState(false);
  const quizzesPerPage = 15;
  const router = useRouter();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const favoritesRef = useRef<string[]>([]);

  // Debounce search query
  const debouncedSearchQuery = useDebounce(searchQuery, 400);

  const atmosphereTexts = useMemo(
    () => [t("atmosphereText1"), t("atmosphereText2"), t("atmosphereText3")],
    [t]
  );

  useEffect(() => {
    preloadHostAssets();
  }, []);

  useEffect(() => {
    setIsClient(true);

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
      setAtmosphereText(
        atmosphereTexts[Math.floor(Math.random() * atmosphereTexts.length)]
      );
    }, 2500);

    return () => {
      clearInterval(flickerInterval);
      clearInterval(textInterval);
    };
  }, [atmosphereTexts, t]);

  // Sync favorites from authProfile
  useEffect(() => {
    if (authProfile) {
      try {
        const anyProfile = authProfile as any;
        if (anyProfile.favorite_quiz) {
          let parsed = anyProfile.favorite_quiz;
          if (typeof anyProfile.favorite_quiz === "string") {
            parsed = JSON.parse(anyProfile.favorite_quiz);
          }
          setFavorites(parsed.favorites || []);
        } else {
          setFavorites([]);
        }
      } catch (e) {
        console.error("Error parsing favorites:", e);
        setFavorites([]);
      }
    } else {
      setFavorites([]);
    }
  }, [authProfile]);

  // Keep favoritesRef in sync with favorites state
  useEffect(() => {
    favoritesRef.current = favorites;
  }, [favorites]);

  // Main effect to fetch quizzes - consolidated to prevent redundant requests
  useEffect(() => {
    const fetchQuizzes = async () => {
      // Don't fetch while auth is loading
      if (authLoading) return;

      // Determine if we need to fetch "All" for categories
      // We do this if categories are empty OR if user just logged in/out
      const needsFullFetch = allQuizzesForCategories.length === 0;

      // We only fetch a large batch if it's the initial load with no filters
      // Otherwise, we fetch a specific page/filter.
      const isDefaultView = !debouncedSearchQuery && selectedCategory === "All" && !favoritesMode && !myQuizzesMode && currentPage === 1;
      const shouldUseFullFetch = needsFullFetch && isDefaultView;

      // Set loading states
      if (needsFullFetch) {
        setIsLoadingInitial(true);
      } else {
        setIsFetching(true);
      }

      const limit = shouldUseFullFetch ? 1000 : quizzesPerPage;

      console.log("Fetching quizzes:", {
        type: shouldUseFullFetch ? "Full (Categories + Paginated)" : "Specific (Paginated)",
        userId: authProfile?.id || "guest",
        limit
      });

      const { data, error } = await supabase.rpc("get_quizzes_paginated", {
        p_user_id: authProfile?.id || null,
        p_search_query: debouncedSearchQuery || null,
        p_category_filter: selectedCategory === "All" ? null : selectedCategory,
        p_favorites_filter: favoritesMode ? favoritesRef.current : null,
        p_creator_filter: myQuizzesMode ? authProfile?.id : null,
        p_limit: limit,
        p_offset: (currentPage - 1) * quizzesPerPage,
      });

      if (error) {
        console.error("Error fetching quizzes:", error);
        toast.error("Failed to fetch quizzes. Please try again.");
      } else {
        const results = data || [];

        // If we did a full fetch, update categories
        if (shouldUseFullFetch) {
          setAllQuizzesForCategories(results);
        }

        // Update display list (limit to quizzesPerPage if we fetched more)
        setPaginatedQuizzes(results.slice(0, quizzesPerPage));

        // Update total count
        if (results.length > 0) {
          // If we fetched a large batch, we already have the total count in the first item or the array length
          // The RPC returns total_count column in every row
          setTotalCount(results[0].total_count || 0);
        } else {
          setTotalCount(0);
        }
      }

      // Reset loading states
      setIsFetching(false);
      setIsLoadingInitial(false);
    };

    fetchQuizzes();
  }, [
    authProfile?.id,
    authLoading,
    debouncedSearchQuery,
    selectedCategory,
    favoritesMode,
    myQuizzesMode,
    currentPage,
  ]);

  useEffect(() => {
    setAllQuizzesForCategories([]);
    setCurrentPage(1);
    setIsLoadingInitial(true);
  }, [authProfile?.id]);

  const categories = useMemo(() => {
    return [
      "All",
      ...new Set(
        allQuizzesForCategories.map((q) => q.category).filter(Boolean)
      ),
    ];
  }, [allQuizzesForCategories]);

  const totalPages = useMemo(
    () => Math.ceil(totalCount / quizzesPerPage),
    [totalCount]
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchQuery, selectedCategory, favoritesMode, myQuizzesMode]);

  const handleSearchSubmit = useCallback(async () => {
    const term = searchTerm.trim();
    setSearchQuery(term);
  }, [searchTerm]);

  const handleSearchClear = useCallback(() => {
    setSearchTerm("");
    setSearchQuery("");
    if (typeof window !== "undefined") searchInputRef.current?.focus();
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleSearchSubmit();
      }
    },
    [handleSearchSubmit]
  );

  const toggleFavorites = useCallback(() => {
    setFavoritesMode(!favoritesMode);
    setMyQuizzesMode(false);
    setSelectedCategory("All");
  }, [favoritesMode]);

  const toggleMyQuizzes = useCallback(() => {
    if (!authProfile) {
      toast.error("Please log in to view your quizzes");
      return;
    }
    setMyQuizzesMode(!myQuizzesMode);
    setFavoritesMode(false);
    setSelectedCategory("All");
  }, [myQuizzesMode, authProfile]);

  const handleQuizSelect = useCallback(
    async (quizId: string) => {
      if (isCreating) return; // Prevent double-click
      setIsCreating(true);
      try {
        const gamePin = generateGamePin();
        const sessId = generateXID();
        const hostId = authProfile?.id || user?.id;

        const primarySession = {
          id: sessId,
          quiz_id: quizId,
          host_id: hostId,
          game_pin: gamePin,
          total_time_minutes: 5,
          question_limit: 5,
          difficulty: "zombie:medium",
          current_questions: [],
          status: "waiting",
        };

        const newMainSession = {
          ...primarySession,
          game_end_mode: "manual",
          allow_join_after_start: false,
          participants: [],
          responses: [],
          application: "quizrush",
        };

        const { error: mainError } = await supabase
          .from("game_sessions")
          .insert(newMainSession)
          .select("game_pin")
          .single();

        if (mainError) {
          console.error("Error creating session:", mainError);
          setIsCreating(false);
          return;
        }

        const { error: gameError } = await mysupa
          .from("sessions")
          .insert(primarySession)
          .select("id")
          .single();

        if (gameError) {
          console.error("Error creating session (mysupa):", gameError);

          // 3) ROLLBACK di supabase utama
          await supabase.from("game_sessions").delete().eq("id", sessId);

          setIsCreating(false);
          return;
        }

        localStorage.setItem("hostGamePin", gamePin);
        sessionStorage.setItem("currentHostId", hostId);

        router.replace(`/host/${gamePin}/settings`);
      } catch (error) {
        console.error("Error creating game:", error);
        toast.error(t("errorMessages.createGameFailed"));
        setIsCreating(false);
      }
    },
    [router, authProfile?.id, t, isCreating, user?.id]
  );

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  // Toggle Favorite Quiz
  const handleToggleFavorite = async (e: React.MouseEvent, quizId: string) => {
    e.stopPropagation();
    if (!authProfile?.id) {
      toast.error(
        t("errorMessages.loginRequired") || "Please log in to favorite quizzes"
      );
      return;
    }

    const isFavoriting = !favorites.includes(quizId);
    let newFavorites = [...favorites];

    if (isFavoriting) {
      newFavorites.push(quizId);
    } else {
      newFavorites = newFavorites.filter((id) => id !== quizId);
    }

    // Optimistic Update
    setFavorites(newFavorites);

    try {
      // 1. Update profiles.favorite_quiz (array of quiz IDs per user)
      const favoriteData = { favorites: newFavorites };
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ favorite_quiz: favoriteData })
        .eq("id", authProfile.id);

      if (profileError) throw profileError;

      // 2. Update quizzes.favorite (array of user IDs per quiz)
      // First, get current favorite array from quiz
      const { data: quizData, error: fetchError } = await supabase
        .from("quizzes")
        .select("favorite")
        .eq("id", quizId)
        .single();

      if (fetchError) throw fetchError;

      let quizFavorites: string[] = [];
      if (quizData?.favorite) {
        // Handle both string and array formats
        if (typeof quizData.favorite === "string") {
          try {
            quizFavorites = JSON.parse(quizData.favorite);
          } catch {
            quizFavorites = [];
          }
        } else {
          quizFavorites = quizData.favorite;
        }
      }

      // Update the array
      if (isFavoriting) {
        if (!quizFavorites.includes(authProfile.id)) {
          quizFavorites.push(authProfile.id);
        }
      } else {
        quizFavorites = quizFavorites.filter((id) => id !== authProfile.id);
      }

      // Save back to quizzes table
      const { error: quizError } = await supabase
        .from("quizzes")
        .update({ favorite: quizFavorites })
        .eq("id", quizId);

      if (quizError) throw quizError;

      toast.success(
        isFavoriting ? "Added to favorites!" : "Removed from favorites"
      );
    } catch (err) {
      console.error("Error updating favorites:", err);
      // Revert on error
      setFavorites(favorites);
      toast.error("Failed to update favorites");
    }
  };

  const goldenRatio = 1.618;
  const searchBarHeight = 12;
  const searchBarRemWidth = Math.round(searchBarHeight * goldenRatio);

  // ==== RENDER ====
  return (
    <LoadingScreen minDuration={500} isReady={!isLoadingInitial && !isCreating}>
      <div className="min-h-screen relative overflow-hidden select-none flex flex-col main-background bg-black">
        {/* Blood drips */}
        {isClient &&
          bloodDrips.map((drip) => (
            <motion.div
              key={drip.id}
              initial={{ y: -100 }}
              animate={{ y: "100vh" }}
              transition={{
                duration: drip.speed,
                delay: drip.delay,
                ease: "linear",
                repeat: Infinity,
              }}
              className="fixed top-0 w-0.5 h-16 bg-gradient-to-b from-red-600 to-red-800/50"
              style={{
                left: `${drip.left}%`,
                opacity: 0.6 + Math.random() * 0.2,
              }}
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
        {[
          "top-0 left-0",
          "top-0 right-0",
          "bottom-0 left-0",
          "bottom-0 right-0",
        ].map((pos, i) => (
          <div key={i} className={`absolute w-64 h-64 opacity-20 ${pos}`}>
            <div className="absolute w-full h-full bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-red-900/70 to-transparent" />
          </div>
        ))}

        <div className="relative z-10 flex flex-col min-h-screen p-7">
          <motion.header
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 1,
              delay: 0.3,
              type: "spring",
              stiffness: 120,
            }}
            className="flex flex-col gap-1 mb-10"
          >
            <div className="hidden md:flex items-center justify-between">
              <Image
                src="/logo/quizrush.png"
                alt="QuizRush Logo"
                width={140}
                height={35}
                className="w-32 md:w-40 lg:w-48 h-auto"
                unoptimized
                onClick={() => router.push("/")}
              />
              <img
                src={`/logo/gameforsmartlogo-horror.png`}
                alt="Logo"
                className="w-40 md:w-52 lg:w-64 h-auto"
              />
            </div>

            <div className="flex items-center justify-center w-full">
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="max-w-[19.4rem]"
                style={{ width: `${searchBarRemWidth}rem` }}
              >
                <div className="relative">
                  <Input
                    ref={searchInputRef}
                    placeholder={t("searchButton")}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="bg-black/70 border-red-500/50 text-red-400 placeholder:text-red-400/50 text-base  h-12 rounded-full focus:border-red-500 focus:ring-red-500/30 backdrop-blur-sm pr-12"
                  />
                  {searchTerm && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-10 top-1/2 -translate-y-1/2 text-red-400/60 hover:text-red-400 transition-colors duration-200"
                      onClick={handleSearchClear}
                      aria-label={t("closeSearch")}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-red-400/80 hover:text-red-400 transition-colors duration-200 shadow-md hover:shadow-lg"
                    disabled={searchTerm.trim().length === 0}
                    onClick={handleSearchSubmit}
                    aria-label={t("searchButton")}
                  >
                    <Search className="h-5 w-5" />
                  </Button>
                </div>
              </motion.div>
            </div>

            <div className="flex flex-col sm:flex-row justify-center items-center gap-2 mt-4">
              <Select
                value={selectedCategory}
                onValueChange={setSelectedCategory}
              >
                <SelectTrigger className="w-[180px] bg-black/70 border-red-500/50 text-red-400 focus:border-red-500 capitalize">
                  <span>
                    {selectedCategory === "All"
                      ? "All Categories"
                      : selectedCategory}
                  </span>
                </SelectTrigger>
                <SelectContent className="bg-black/80 text-red-400 border-red-500/50 capitalize">
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat} className="text-red-400">
                      {cat === "All" ? "All Categories" : cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className={`h-10 w-10 rounded-full ${favoritesMode
                    ? "bg-red-500 text-white"
                    : "border-red-500 text-red-400 hover:bg-red-900/20"
                    }`}
                  onClick={toggleFavorites}
                >
                  <Heart
                    className={`h-5 w-5 ${favoritesMode ? "fill-current" : ""}`}
                  />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className={`h-10 w-10 rounded-full ${myQuizzesMode
                    ? "bg-red-500 text-white"
                    : "border-red-500 text-red-400 hover:bg-red-900/20"
                    }`}
                  onClick={toggleMyQuizzes}
                  disabled={!authProfile}
                >
                  <User className="h-5 w-5" />
                </Button>
              </div>
            </div>
          </motion.header>

          <div className="w-full max-w-8xl mx-auto flex flex-col flex-1 px-2 md:px-8 gap-5">
            {paginatedQuizzes.length === 0 && !isFetching ? (
              <div className="text-center text-red-400/80 text-base  flex-1 flex items-center justify-center">
                {t("noQuizzesAvailable")}
              </div>
            ) : (
              <>
                <div className="flex flex-col flex-1 gap-7">
                  <div className="mt-4 grid gap-4 grid-cols-1 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                    {isFetching
                      ? // Single Spinner Loading
                      <div className="col-span-full flex items-center justify-center py-20">
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                          className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full"
                        />
                      </div>
                      : paginatedQuizzes.map((quiz, index) => (
                        <motion.div
                          key={quiz.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{
                            delay: 0.1 * (quiz.id % 4),
                            duration: 0.5,
                          }}
                          whileHover={{ scale: 1.02 }}
                          className="w-full"
                        >
                          <Card
                            className="bg-black/50 border-red-500/20 hover:border-red-500 cursor-pointer shadow-[0_0_10px_rgba(239,68,68,0.3)] hover:shadow-[0_0_15px_rgba(239,68,68,0.5)] h-full flex flex-col gap-3 relative"
                            onClick={() => handleQuizSelect(quiz.id)}
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ")
                                handleQuizSelect(quiz.id);
                            }}
                            aria-label={t("selectQuiz", {
                              theme: quiz.title,
                            })}
                          >
                            {/* Favorite button - top right corner */}
                            <button
                              onClick={(e) =>
                                handleToggleFavorite(e, quiz.id)
                              }
                              className="absolute top-2 right-2 p-1.5 rounded-full hover:bg-red-900/30 transition-colors cursor-pointer z-10"
                              aria-label={
                                favorites.includes(quiz.id)
                                  ? "Remove from favorites"
                                  : "Add to favorites"
                              }
                            >
                              <Heart
                                className={`h-5 w-5 transition-colors ${favorites.includes(quiz.id)
                                  ? "text-red-500 fill-red-500"
                                  : "text-red-400/60 hover:text-red-400"
                                  }`}
                              />
                            </button>
                            <CardHeader className="flex-shrink-0">
                              <TooltipProvider>
                                <Tooltip delayDuration={300}>
                                  <TooltipTrigger asChild>
                                    <CardTitle
                                      className="
    text-red-400 
    
    md:text-2xl
    lg:text-2xl
    leading-snug
    antialiased
    subpixel-antialiased
    drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]
    whitespace-normal
    break-words
    line-clamp-3
  "
                                    >
                                      {quiz.title}
                                    </CardTitle>
                                  </TooltipTrigger>
                                  <TooltipContent
                                    side="top"
                                    className="
          bg-black/95 
          text-red-300 
          border-2 border-red-600 
          text-base 
          p-3 
          max-w-[250px] 
          whitespace-normal 
          break-words 
          shadow-2xl
        "
                                  >
                                    <p>{quiz.title}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </CardHeader>
                            <CardFooter className="pt-2 flex justify-between items-center flex-shrink-0 mt-auto">
                              <div className="flex items-center gap-2">
                                {quiz.category && (
                                  <span className="text-red-300 text-sm capitalize">
                                    {quiz.category}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1 text-red-300 text-xs">
                                <HelpCircle className="h-3 w-3" />
                                {quiz.question_count ?? 0}
                              </div>
                            </CardFooter>
                          </Card>
                        </motion.div>
                      ))}
                  </div>
                </div>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                  className="mt-auto pb-3"
                >
                  <div className="flex justify-center gap-4">
                    <Button
                      variant="outline"
                      size="icon"
                      className="bg-black/50 border-red-500/50 text-red-400 hover:bg-red-900/20"
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1 || isCreating || isFetching}
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </Button>
                    <span className="text-red-400  text-sm self-center">
                      {t("pageInfo", {
                        current: currentPage,
                        total: totalPages,
                      })}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="bg-black/50 border-red-500/50 text-red-400 hover:bg-red-900/20"
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={
                        currentPage === totalPages || isCreating || isFetching
                      }
                    >
                      <ChevronRight className="h-5 w-5" />
                    </Button>
                  </div>
                </motion.div>
              </>
            )}
          </div>
        </div>

        {/* Global styles */}
        <style jsx global>{`
          .main-background {
            background-size: 60%;
            background-repeat: no-repeat;
          }
          @media (min-width: 768px) {
            .main-background {
              background-size: 60%;
            }
          }
          @keyframes float {
            0%,
            100% {
              transform: translateY(0) rotate(0deg);
            }
            50% {
              transform: translateY(-20px) rotate(180deg);
            }
          }
          .animate-float {
            animation: float 20s infinite ease-in-out;
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
        `}</style>
      </div>
    </LoadingScreen>
  );
}
