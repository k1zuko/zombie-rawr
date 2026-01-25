"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { mysupa } from "@/lib/supabase";
import { useAdminGuard } from "@/lib/admin-guard";
import LoadingScreen from "@/components/LoadingScreen";
import { Play, Trash2, StopCircle } from "lucide-react";
import Image from "next/image";
import { motion } from "framer-motion";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

// Import Indonesian names from JSON
import indonesianNames from "@/data/indonesian-names.json";

// Import Bot component
import { BotInstance, BotPersonality, Question, generatePersonality } from "@/components/test/BotInstance";

// Helper to pick random from array
const pickRandom = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

// Unique nickname generator class
class UniqueNicknameGenerator {
    private usedNames: Set<string> = new Set();
    private firstNames: string[];
    private middleNames: string[];
    private lastNames: string[];

    constructor() {
        this.firstNames = indonesianNames.firstNames;
        this.middleNames = indonesianNames.middleNames;
        this.lastNames = indonesianNames.lastNames;
    }

    generate(): string {
        let attempts = 0;
        const maxAttempts = 100;

        while (attempts < maxAttempts) {
            const wordCount = Math.floor(Math.random() * 4) + 1;
            let nickname: string;

            if (wordCount === 1) {
                nickname = pickRandom(this.firstNames);
            } else if (wordCount === 2) {
                nickname = `${pickRandom(this.firstNames)} ${pickRandom(this.lastNames)}`;
            } else if (wordCount === 3) {
                nickname = `${pickRandom(this.firstNames)} ${pickRandom(this.middleNames)} ${pickRandom(this.lastNames)}`;
            } else {
                nickname = `${pickRandom(this.firstNames)} ${pickRandom(this.middleNames)} ${pickRandom(this.middleNames)} ${pickRandom(this.lastNames)}`;
            }

            if (!this.usedNames.has(nickname)) {
                this.usedNames.add(nickname);
                return nickname;
            }
            attempts++;
        }

        const fallback = `${pickRandom(this.firstNames)} ${pickRandom(this.middleNames)} ${pickRandom(this.middleNames)} ${pickRandom(this.lastNames)}`;
        this.usedNames.add(fallback);
        return fallback;
    }

    reset(): void {
        this.usedNames.clear();
    }
}

// Bot data structure for rendering
interface BotData {
    id: string;
    nickname: string;
    personality: BotPersonality;
}

interface SessionData {
    id: string;
    status: "waiting" | "active" | "finished";
    difficulty: string;
    question_limit: number;
    total_time_minutes: number;
    current_questions: Question[];
}

export default function TestPage() {
    const { isAdmin, loading: authLoading } = useAdminGuard();

    const [roomCode, setRoomCode] = useState("");
    const [userCount, setUserCount] = useState(100);
    const [isRunning, setIsRunning] = useState(false);
    const [session, setSession] = useState<SessionData | null>(null);
    const [logs, setLogs] = useState<string[]>([]);
    const [bots, setBots] = useState<BotData[]>([]);
    const [gameStatus, setGameStatus] = useState<"waiting" | "active" | "finished">("waiting");
    const [questions, setQuestions] = useState<Question[]>([]);

    const [joinedCount, setJoinedCount] = useState(0);
    const [answeringCount, setAnsweringCount] = useState(0);
    const [completedCount, setCompletedCount] = useState(0);
    const [eliminatedCount, setEliminatedCount] = useState(0);
    const [errorCount, setErrorCount] = useState(0);
    const [showCleanupDialog, setShowCleanupDialog] = useState(false);
    const [isCleaningUp, setIsCleaningUp] = useState(false);

    const stopSignalRef = useRef(false);
    const sessionChannelRef = useRef<any>(null);
    const nicknameGeneratorRef = useRef(new UniqueNicknameGenerator());

    const addLog = useCallback((message: string) => {
        const timestamp = new Date().toLocaleTimeString();
        setLogs(prev => [`[${timestamp}] ${message}`, ...prev.slice(0, 199)]);
    }, []);

    // Fetch session
    const fetchSession = async (code: string): Promise<SessionData | null> => {
        const { data, error } = await mysupa
            .from("sessions")
            .select("id, status, difficulty, question_limit, total_time_minutes, current_questions")
            .eq("game_pin", code)
            .single();

        if (error || !data) {
            addLog(`❌ Session not found: ${code}`);
            return null;
        }
        return data as SessionData;
    };

    // Subscribe to session changes
    const subscribeToSession = (sessionId: string) => {
        sessionChannelRef.current = mysupa
            .channel(`test-session-${sessionId}`)
            .on(
                "postgres_changes",
                { event: "UPDATE", schema: "public", table: "sessions", filter: `id=eq.${sessionId}` },
                (payload) => {
                    const newStatus = payload.new?.status as "waiting" | "active" | "finished";
                    const newQuestions = payload.new?.current_questions as Question[];

                    if (newStatus === "finished") {
                        addLog("🛑 Host ended the game!");
                        setGameStatus("finished");
                        stopSignalRef.current = true;
                        setBots([]); // Clear bot components
                        setIsRunning(false); // Stop the test
                    } else if (newStatus === "active") {
                        addLog("🎮 Game started by host!");
                        setGameStatus("active");
                        if (newQuestions) {
                            setQuestions(newQuestions);
                        }
                    }
                }
            )
            .on(
                "postgres_changes",
                { event: "DELETE", schema: "public", table: "sessions", filter: `id=eq.${sessionId}` },
                () => {
                    addLog("🗑️ Session deleted by host!");
                    setGameStatus("finished");
                    stopSignalRef.current = true;
                    setBots([]); // Clear bot components
                    setIsRunning(false); // Stop the test
                }
            )
            .subscribe();
    };

    // Bot callback handlers
    const handleBotJoined = useCallback((participantId: string, nickname: string) => {
        setJoinedCount(prev => prev + 1);
        addLog(`✅ ${nickname} joined`);
    }, [addLog]);

    const handleBotAnswered = useCallback((nickname: string, questionIndex: number, correct: boolean) => {
        addLog(`${nickname} → Q${questionIndex} ${correct ? "✓" : "✗"}`);
        setAnsweringCount(prev => Math.max(prev, questionIndex));
    }, [addLog]);

    const handleBotCompleted = useCallback((nickname: string) => {
        setCompletedCount(prev => prev + 1);
        addLog(`🏁 ${nickname} finished!`);
    }, [addLog]);

    const handleBotEliminated = useCallback((nickname: string) => {
        setEliminatedCount(prev => prev + 1);
        addLog(`💀 ${nickname} eliminated!`);
    }, [addLog]);

    const handleBotError = useCallback((nickname: string, error: string) => {
        setErrorCount(prev => prev + 1);
        addLog(`❌ ${nickname}: ${error}`);
    }, [addLog]);

    // Start test - creates bot instances
    const startTest = async () => {
        if (!roomCode.trim()) {
            addLog("❌ Enter room code");
            return;
        }

        setIsRunning(true);
        stopSignalRef.current = false;
        setLogs([]);
        setBots([]);
        setJoinedCount(0);
        setAnsweringCount(0);
        setCompletedCount(0);
        setEliminatedCount(0);
        setErrorCount(0);
        setGameStatus("waiting");
        setQuestions([]);
        nicknameGeneratorRef.current.reset();

        addLog(`🧪 Starting test: ${roomCode}`);

        const sess = await fetchSession(roomCode);
        if (!sess) {
            setIsRunning(false);
            return;
        }

        setSession(sess);
        setGameStatus(sess.status);
        if (sess.current_questions) {
            setQuestions(sess.current_questions);
        }
        subscribeToSession(sess.id);
        addLog(`✅ Session found: ${sess.status}`);

        // Generate bot data with unique personalities
        addLog(`🧠 Creating ${userCount} bots with unique IQ personalities...`);
        const newBots: BotData[] = [];
        for (let i = 0; i < userCount; i++) {
            const personality = generatePersonality();
            const nickname = nicknameGeneratorRef.current.generate();
            newBots.push({
                id: `bot-${i}-${Date.now()}`,
                nickname,
                personality,
            });
        }

        // Log personality distribution
        const iqRanges = { genius: 0, aboveAvg: 0, average: 0, belowAvg: 0, low: 0 };
        newBots.forEach(bot => {
            if (bot.personality.iq >= 131) iqRanges.genius++;
            else if (bot.personality.iq >= 111) iqRanges.aboveAvg++;
            else if (bot.personality.iq >= 91) iqRanges.average++;
            else if (bot.personality.iq >= 71) iqRanges.belowAvg++;
            else iqRanges.low++;
        });
        addLog(`📊 IQ Distribution: 🧒${iqRanges.low} | 📉${iqRanges.belowAvg} | 📊${iqRanges.average} | 📈${iqRanges.aboveAvg} | 🧠${iqRanges.genius}`);

        setBots(newBots);
        addLog(`🤖 ${userCount} bot components ready!`);
    };

    const stopTest = () => {
        stopSignalRef.current = true;
        setBots([]);
        if (sessionChannelRef.current) {
            mysupa.removeChannel(sessionChannelRef.current);
        }
        addLog("⛔ Test stopped");
        setIsRunning(false);
    };

    const cleanupUsers = async () => {
        if (!session?.id) return;
        setIsCleaningUp(true);
        addLog("🧹 Cleaning up bots...");

        await mysupa
            .from("participants")
            .delete()
            .eq("session_id", session.id)
            .is("user_id", null);

        addLog("✅ Cleanup complete");
        setBots([]);
        setJoinedCount(0);
        setCompletedCount(0);
        setEliminatedCount(0);
        setIsCleaningUp(false);
        setShowCleanupDialog(false);
    };

    // Show loading while checking admin auth
    if (authLoading || !isAdmin) {
        return <LoadingScreen children={undefined} />;
    }

    return (
        <div className="min-h-screen bg-black relative overflow-hidden">
            {/* Blood drips background */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                {Array.from({ length: 8 }).map((_, i) => (
                    <motion.div
                        key={i}
                        className="absolute top-0 w-0.5 h-16 bg-gradient-to-b from-red-600 to-red-800/50"
                        style={{ left: `${10 + i * 12}%`, opacity: 0.5 }}
                        animate={{ y: ["0vh", "100vh"] }}
                        transition={{ duration: 3 + Math.random() * 2, delay: Math.random() * 3, repeat: Infinity, ease: "linear" }}
                    />
                ))}
            </div>

            {/* Content Wrapper */}
            <div className="relative p-3 z-10 min-h-screen overflow-y-auto">
                {/* Header */}
                <div className="hidden md:flex items-center justify-between">
                    <Image
                        src="/logo/quizrush.png"
                        alt="QuizRush Logo"
                        width={140}
                        height={35}
                        className="w-32 md:w-40 lg:w-48 h-auto"
                        unoptimized
                    />
                    <img src={`/logo/gameforsmartlogo-horror.png`} alt="Logo" className="w-40 md:w-52 lg:w-64 h-auto" />
                </div>

                {/* Content */}
                <div className="max-w-4xl mx-auto p-4 pt-0 space-y-4">
                    {/* Title */}
                    <div className="text-center">
                        <motion.div
                            initial={{ opacity: 0, y: -20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5 }}
                        >
                            <h1 className="text-5xl font-bold text-red-500 drop-shadow-[0_0_10px_rgba(239,68,68,0.5)] tracking-widest">
                                TEST
                            </h1>
                        </motion.div>
                    </div>

                    {/* Control Panel */}
                    <Card className="bg-black/60 border-red-500/30 backdrop-blur-sm shadow-[0_0_15px_rgba(239,68,68,0.2)]">
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm text-red-400">Room Code</label>
                                    <Input
                                        value={roomCode}
                                        onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                                        placeholder="XXXXXX"
                                        className="bg-black/50 border-red-500/50 text-white mt-1 text-center tracking-widest"
                                        disabled={isRunning}
                                    />
                                </div>
                                <div>
                                    <label className="text-sm text-red-400">
                                        Bots: <span className="text-red-300 font-bold">{userCount}</span>
                                    </label>
                                    <Slider
                                        value={[userCount]}
                                        onValueChange={([v]) => setUserCount(v)}
                                        min={10}
                                        max={1000}
                                        step={10}
                                        disabled={isRunning}
                                        className="mt-3"
                                    />
                                </div>
                            </div>

                            <div className="flex gap-3">
                                {!isRunning ? (
                                    <Button
                                        onClick={startTest}
                                        className="flex-1 bg-gradient-to-r from-red-900 to-red-700 border-2 border-red-700 text-white hover:from-red-800 hover:to-red-600 shadow-[0_0_15px_rgba(239,68,68,0.3)]"
                                    >
                                        <Play className="w-4 h-4 mr-2" /> Start
                                    </Button>
                                ) : (
                                    <Button
                                        onClick={stopTest}
                                        className="flex-1 bg-red-900/50 border-2 border-red-500 text-red-400 hover:bg-red-900/70"
                                    >
                                        <StopCircle className="w-4 h-4 mr-2" /> Stop
                                    </Button>
                                )}
                                <Button
                                    onClick={() => setShowCleanupDialog(true)}
                                    className="bg-black/60 border-2 border-red-500/50 text-red-400 hover:bg-red-500/20"
                                    disabled={isRunning || !session}
                                >
                                    <Trash2 className="w-4 h-4 mr-2" /> Cleanup
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                        <Card className="bg-black/60 border-blue-500/50 py-3">
                            <CardContent className="p-2 text-center">
                                <div className="text-2xl font-bold text-blue-400">{joinedCount}</div>
                                <div className="text-xs text-blue-400/70">Joined</div>
                            </CardContent>
                        </Card>
                        <Card className="bg-black/60 border-yellow-500/50 py-3">
                            <CardContent className="p-2 text-center">
                                <div className="text-2xl font-bold text-yellow-400">{answeringCount}</div>
                                <div className="text-xs text-yellow-400/70">Question</div>
                            </CardContent>
                        </Card>
                        <Card className="bg-black/60 border-green-500/50 py-3">
                            <CardContent className="p-2 text-center">
                                <div className="text-2xl font-bold text-green-400">{completedCount}</div>
                                <div className="text-xs text-green-400/70">Finished</div>
                            </CardContent>
                        </Card>
                        <Card className="bg-black/60 border-red-500/50 py-3">
                            <CardContent className="p-2 text-center">
                                <div className="text-2xl font-bold text-red-400">{eliminatedCount}</div>
                                <div className="text-xs text-red-400/70">Eliminated</div>
                            </CardContent>
                        </Card>
                        <Card className="bg-black/60 border-gray-500/50 py-3">
                            <CardContent className="p-2 text-center">
                                <div className="text-2xl font-bold text-gray-400">{errorCount}</div>
                                <div className="text-xs text-gray-400/70">Errors</div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Logs */}
                    <Card className="bg-black/60 border-red-500/30 gap-3">
                        <CardHeader>
                            <CardTitle className="text-sm text-red-400">📜 Logs</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="h-64 overflow-y-auto bg-black/60 rounded-lg p-3 font-mono text-xs space-y-0.5 border border-red-500/20">
                                {logs.length === 0 ? (
                                    <div className="text-gray-500">Waiting for test to start...</div>
                                ) : (
                                    logs.map((log, i) => (
                                        <div
                                            key={i}
                                            className={`${log.includes("✓") ? "text-green-400" :
                                                log.includes("✗") ? "text-orange-400" :
                                                    log.includes("❌") ? "text-red-400" :
                                                        log.includes("💀") ? "text-red-500" :
                                                            log.includes("🏁") ? "text-yellow-400" :
                                                                log.includes("🎮") ? "text-purple-400" :
                                                                    log.includes("✅") ? "text-green-400" :
                                                                        log.includes("📊") ? "text-cyan-400" :
                                                                            log.includes("🧠") ? "text-pink-400" :
                                                                                "text-gray-300"
                                                }`}
                                        >
                                            {log}
                                        </div>
                                    ))
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Render Bot Components (headless - no UI output) */}
            {session && bots.map((bot) => (
                <BotInstance
                    key={bot.id}
                    sessionId={session.id}
                    nickname={bot.nickname}
                    personality={bot.personality}
                    questions={questions}
                    questionLimit={session.question_limit}
                    difficulty={session.difficulty}
                    gameStatus={gameStatus}
                    stopSignal={stopSignalRef.current}
                    onJoined={handleBotJoined}
                    onAnswered={handleBotAnswered}
                    onCompleted={handleBotCompleted}
                    onEliminated={handleBotEliminated}
                    onError={handleBotError}
                />
            ))}

            {/* Cleanup Confirmation Dialog */}
            <Dialog open={showCleanupDialog} onOpenChange={setShowCleanupDialog}>
                <DialogContent className="bg-black/95 border-2 border-red-500 max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-2xl text-red-500 text-center">
                            🗑️ Cleanup Bots
                        </DialogTitle>
                        <DialogDescription className="text-center text-gray-400 mt-4">
                            Are you sure you want to delete all bots from this session?
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="flex gap-3 mt-6">
                        <Button
                            variant="outline"
                            onClick={() => setShowCleanupDialog(false)}
                            disabled={isCleaningUp}
                            className="flex-1 border-gray-700 text-gray-300 hover:bg-gray-800"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={cleanupUsers}
                            disabled={isCleaningUp}
                            className="flex-1 bg-red-900 border-2 border-red-500 text-red-300 hover:bg-red-800"
                        >
                            {isCleaningUp ? "Cleaning..." : "Delete All"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
