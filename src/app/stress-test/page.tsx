"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { mysupa } from "@/lib/supabase";
import { useAdminGuard } from "@/lib/admin-guard";
import LoadingScreen from "@/components/LoadingScreen";
import { generateXID } from "@/lib/id-generator";
import { Play, Trash2, StopCircle, Skull, Heart, Zap } from "lucide-react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogOverlay,
    DialogTitle,
} from "@/components/ui/dialog";

const CHARACTER_OPTIONS = [
    "robot1", "robot2", "robot3", "robot4", "robot5",
    "robot6", "robot7", "robot8", "robot9", "robot10"
];

interface TestUser {
    id: string;
    nickname: string;
    currentQuestion: number;
    completed: boolean;
    health: number;
    correctCount: number;
}

interface SessionData {
    id: string;
    status: string;
    difficulty: string;
    question_limit: number;
    total_time_minutes: number;
    current_questions: any[];
}

export default function StressTestPage() {
    const { isAdmin, loading: authLoading } = useAdminGuard();

    const [roomCode, setRoomCode] = useState("");
    const [userCount, setUserCount] = useState(10);
    const [minInterval, setMinInterval] = useState(3);
    const [maxInterval, setMaxInterval] = useState(10);
    const [isRunning, setIsRunning] = useState(false);
    const [session, setSession] = useState<SessionData | null>(null);
    const [logs, setLogs] = useState<string[]>([]);

    const [joinedCount, setJoinedCount] = useState(0);
    const [answeringCount, setAnsweringCount] = useState(0);
    const [completedCount, setCompletedCount] = useState(0);
    const [eliminatedCount, setEliminatedCount] = useState(0);
    const [errorCount, setErrorCount] = useState(0);
    const [gameEnded, setGameEnded] = useState(false);
    const [showCleanupDialog, setShowCleanupDialog] = useState(false);
    const [isCleaningUp, setIsCleaningUp] = useState(false);

    const stopRef = useRef(false);
    const usersRef = useRef<TestUser[]>([]);
    const sessionChannelRef = useRef<any>(null);

    const addLog = useCallback((message: string) => {
        const timestamp = new Date().toLocaleTimeString();
        setLogs(prev => [`[${timestamp}] ${message}`, ...prev.slice(0, 199)]);
    }, []);

    // Random delay between min and max milliseconds
    const randomDelayRange = (minMs: number, maxMs: number) =>
        new Promise(resolve => setTimeout(resolve, minMs + Math.random() * (maxMs - minMs)));

    // Get health by difficulty
    const getHealthByDifficulty = (difficulty: string): number => {
        const diffLevel = difficulty?.split(":")?.[1]?.trim().toLowerCase() || "medium";
        const healthMap: Record<string, number> = { easy: 5, medium: 3, hard: 1 };
        return healthMap[diffLevel] ?? 3;
    };

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
        return data;
    };

    // Subscribe to session changes (detect game start/end)
    const subscribeToSession = (sessionId: string) => {
        sessionChannelRef.current = mysupa
            .channel(`stress-test-session-${sessionId}`)
            .on(
                "postgres_changes",
                { event: "UPDATE", schema: "public", table: "sessions", filter: `id=eq.${sessionId}` },
                (payload) => {
                    const newStatus = payload.new?.status;
                    const newQuestions = payload.new?.current_questions;

                    if (newStatus === "finished") {
                        addLog("🛑 Host ended the game!");
                        setGameEnded(true);
                        stopRef.current = true;
                    } else if (newStatus === "active") {
                        addLog("🎮 Game started by host!");
                        // Update session with questions
                        setSession(prev => prev ? { ...prev, status: "active", current_questions: newQuestions || prev.current_questions } : prev);
                    }
                }
            )
            .on(
                "postgres_changes",
                { event: "DELETE", schema: "public", table: "sessions", filter: `id=eq.${sessionId}` },
                () => {
                    addLog("🗑️ Session deleted by host!");
                    setGameEnded(true);
                    stopRef.current = true;
                }
            )
            .subscribe();
    };

    // Phase 1: Join all users CONCURRENTLY with random delays (1-10s each)
    const joinUsersConcurrently = async (sessionId: string, difficulty: string) => {
        addLog(`🧟 Joining ${userCount} bots concurrently (1-10s delays)...`);
        const healthMax = getHealthByDifficulty(difficulty);

        const joinPromises = Array.from({ length: userCount }, async (_, i) => {
            // Each bot has random delay 1-10 seconds
            await randomDelayRange(1000, 10000);

            if (stopRef.current) return null;

            const nickname = `Bot_${(i + 1).toString().padStart(3, "0")}`;
            const character_type = CHARACTER_OPTIONS[Math.floor(Math.random() * CHARACTER_OPTIONS.length)];

            const { data: participant, error } = await mysupa
                .from("participants")
                .insert({
                    session_id: sessionId,
                    nickname,
                    character_type,
                    is_host: false,
                    user_id: null,
                    score: 0,
                    correct_answers: 0,
                    is_alive: true,
                    position_x: 0,
                    position_y: 0,
                    power_ups: 0,
                    health: {
                        max: healthMax,
                        current: healthMax,
                        speed: 20,
                        last_answer_time: null,
                        last_attack_time: null,
                        is_being_attacked: false
                    },
                    answers: []
                })
                .select()
                .single();

            if (error || !participant) {
                setErrorCount(prev => prev + 1);
                addLog(`❌ ${nickname} failed to join`);
                return null;
            }

            setJoinedCount(prev => prev + 1);
            addLog(`✅ ${nickname} joined`);
            return {
                id: participant.id,
                nickname,
                currentQuestion: 0,
                completed: false,
                health: healthMax,
                correctCount: 0
            } as TestUser;
        });

        const results = await Promise.all(joinPromises);
        const users = results.filter(Boolean) as TestUser[];
        usersRef.current = users;
        addLog(`📊 Total joined: ${users.length} bots`);
    };

    // Phase 2: Lobby - CONCURRENT character changes with random delays (1-10s each)
    const lobbyPhaseConcurrent = async () => {
        addLog("🎭 Character selection phase...");

        while (!stopRef.current) {
            const sess = await fetchSession(roomCode);
            // Stop if game active
            if (sess?.status === "active") {
                addLog("⏱️ Game starting! Stopping character changes...");
                // Update session with fresh questions
                setSession(sess);
                break;
            }

            // All users change character CONCURRENTLY with random delays 1-10s
            await Promise.all(
                usersRef.current.map(async (user) => {
                    await randomDelayRange(1000, 10000);
                    if (stopRef.current) return;

                    const newCharacter = CHARACTER_OPTIONS[Math.floor(Math.random() * CHARACTER_OPTIONS.length)];
                    await mysupa.from("participants").update({ character_type: newCharacter }).eq("id", user.id);
                })
            );
        }
    };

    // Phase 3: Each bot answers independently with 3-10 second intervals
    const answerQuestionsIndependently = async (questions: any[], questionLimit: number) => {
        const totalQuestions = Math.min(questions.length, questionLimit || questions.length);
        const scorePerQuestion = Math.max(1, Math.floor(100 / totalQuestions));

        addLog(`📝 Starting game with ${totalQuestions} questions...`);
        addLog(`🧠 Each bot thinks independently (${minInterval}-${maxInterval}s per answer)...`);

        // Each bot runs independently
        const botPromises = usersRef.current.map(async (user) => {
            for (let qIndex = 0; qIndex < totalQuestions; qIndex++) {
                if (stopRef.current || user.completed || user.health <= 0) break;

                // Random thinking time based on user config
                await randomDelayRange(minInterval * 1000, maxInterval * 1000);
                if (stopRef.current) break;

                const question = questions[qIndex];
                if (!question) continue;

                const answers = question.answers || [];
                if (answers.length === 0) continue;

                // Correct answer index is stored as string in question.correct (e.g., "0", "1", "2", "3")
                const correctAnswerIndex = parseInt(question.correct, 10);

                // 70% correct answer probability
                const wantsCorrect = Math.random() < 0.7;
                let selectedIndex: number;

                if (wantsCorrect && !isNaN(correctAnswerIndex) && correctAnswerIndex < answers.length) {
                    selectedIndex = correctAnswerIndex;
                } else {
                    // Pick a random wrong answer
                    const wrongIndices = answers.map((_: any, i: number) => i).filter((i: number) => i !== correctAnswerIndex);
                    if (wrongIndices.length > 0) {
                        selectedIndex = wrongIndices[Math.floor(Math.random() * wrongIndices.length)];
                    } else {
                        selectedIndex = Math.floor(Math.random() * answers.length);
                    }
                }

                // Check if answer is correct by comparing index to question.correct
                const isCorrectAnswer = selectedIndex.toString() === question.correct;
                const newHealth = isCorrectAnswer ? user.health : Math.max(0, user.health - 1);
                const newCorrectCount = isCorrectAnswer ? user.correctCount + 1 : user.correctCount;
                const currentSpeed = 20 + (user.correctCount * 5) - ((qIndex - user.correctCount) * 5);
                const newSpeed = Math.max(20, currentSpeed + (isCorrectAnswer ? 5 : -5));
                const newScore = newCorrectCount * scorePerQuestion;

                // Answer format matching player quiz page (line 353-358)
                const newAnswer = {
                    id: generateXID(),
                    correct: isCorrectAnswer,
                    answer_id: selectedIndex.toString(),  // INDEX as string, not answer.id
                    question_id: question.id
                };

                const isLastQuestion = qIndex === totalQuestions - 1;
                const isEliminated = newHealth <= 0;

                try {
                    // Get current participant state first
                    const { data: currentParticipant } = await mysupa
                        .from("participants")
                        .select("answers, health")
                        .eq("id", user.id)
                        .single();

                    if (!currentParticipant) continue;

                    const updatedAnswers = [...(currentParticipant.answers || []), newAnswer];

                    await mysupa
                        .from("participants")
                        .update({
                            answers: updatedAnswers,
                            correct_answers: newCorrectCount,
                            score: newScore,
                            health: {
                                ...currentParticipant.health,
                                current: newHealth,
                                speed: newSpeed,
                                last_answer_time: new Date().toISOString()
                            },
                            is_alive: !isEliminated,
                            ...(isLastQuestion || isEliminated ? { finished_at: new Date().toISOString() } : {})
                        })
                        .eq("id", user.id);

                    user.currentQuestion = qIndex + 1;
                    user.health = newHealth;
                    user.correctCount = newCorrectCount;

                    addLog(`${user.nickname} → Q${qIndex + 1} ${isCorrectAnswer ? "✓" : "✗"}`);
                    setAnsweringCount(prev => Math.max(prev, qIndex + 1));

                    if (isEliminated) {
                        user.completed = true;
                        setEliminatedCount(prev => prev + 1);
                        addLog(`💀 ${user.nickname} eliminated!`);
                        break;
                    }

                    if (isLastQuestion) {
                        user.completed = true;
                        setCompletedCount(prev => prev + 1);
                        addLog(`🏁 ${user.nickname} finished!`);
                    }
                } catch (err) {
                    setErrorCount(prev => prev + 1);
                }
            }
        });

        await Promise.all(botPromises);
        addLog(`🎉 All bots completed!`);
    };

    // Main test runner
    const startTest = async () => {
        if (!roomCode.trim()) {
            addLog("❌ Enter room code");
            return;
        }

        setIsRunning(true);
        setGameEnded(false);
        stopRef.current = false;
        setLogs([]);
        setJoinedCount(0);
        setAnsweringCount(0);
        setCompletedCount(0);
        setEliminatedCount(0);
        setErrorCount(0);
        usersRef.current = [];

        addLog(`🧪 Starting stress test: ${roomCode}`);

        const sess = await fetchSession(roomCode);
        if (!sess) {
            setIsRunning(false);
            return;
        }
        setSession(sess);
        subscribeToSession(sess.id);
        addLog(`✅ Session found: ${sess.status}`);

        await joinUsersConcurrently(sess.id, sess.difficulty);
        if (stopRef.current) { setIsRunning(false); return; }

        if (sess.status === "waiting") {
            await lobbyPhaseConcurrent();
        }
        if (stopRef.current) { setIsRunning(false); return; }

        // Wait for session to be active with questions
        let attempts = 0;
        let updatedSess = session;
        while ((!updatedSess?.current_questions?.length || updatedSess?.status !== "active") && !stopRef.current && attempts < 60) {
            await randomDelayRange(1000, 2000);
            updatedSess = await fetchSession(roomCode);
            attempts++;
        }

        if (!updatedSess?.current_questions?.length) {
            addLog("❌ No questions found");
            setIsRunning(false);
            return;
        }

        await answerQuestionsIndependently(updatedSess.current_questions, updatedSess.question_limit);

        setIsRunning(false);
        if (!stopRef.current) addLog("🎉 Test completed successfully!");
    };

    const stopTest = () => {
        stopRef.current = true;
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
            .like("nickname", "Bot_%");

        addLog("✅ Cleanup complete");
        usersRef.current = [];
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
        <div className="min-h-screen bg-black relative overflow-hidden font-serif">
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
                        width={140}   // turunin sedikit biar proporsional
                        height={35}   // sesuaikan tinggi
                        className="w-32 md:w-40 lg:w-48 h-auto"   // ini yang paling berpengaruh
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
                            <h1 className="text-3xl font-bold font-serif text-red-500 drop-shadow-[0_0_10px_rgba(239,68,68,0.5)]">
                                Stress Test
                            </h1>
                        </motion.div>
                    </div>

                    {/* Control Panel */}
                    <Card className="bg-black/60 border-red-500/30 backdrop-blur-sm shadow-[0_0_15px_rgba(239,68,68,0.2)]">
                        <CardContent className="space-y-4 pt-6">
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
                                        min={50}
                                        max={500}
                                        step={50}
                                        disabled={isRunning}
                                        className="mt-3"
                                    />
                                </div>
                            </div>

                            {/* Answer Interval Config */}
                            <div className="grid grid-cols-2 gap-4 mb-5">
                                <div>
                                    <label className="text-sm text-red-400">
                                        Min Interval: <span className="text-red-300 font-bold">{minInterval}s</span>
                                    </label>
                                    <Slider
                                        value={[minInterval]}
                                        onValueChange={([v]) => {
                                            setMinInterval(v);
                                            if (v > maxInterval) setMaxInterval(v);
                                        }}
                                        min={1}
                                        max={30}
                                        step={1}
                                        disabled={isRunning}
                                        className="mt-2"
                                    />
                                </div>
                                <div>
                                    <label className="text-sm text-red-400">
                                        Max Interval: <span className="text-red-300 font-bold">{maxInterval}s</span>
                                    </label>
                                    <Slider
                                        value={[maxInterval]}
                                        onValueChange={([v]) => {
                                            setMaxInterval(v);
                                            if (v < minInterval) setMinInterval(v);
                                        }}
                                        min={1}
                                        max={60}
                                        step={1}
                                        disabled={isRunning}
                                        className="mt-2"
                                    />
                                </div>
                            </div>

                            <div className="flex gap-3">
                                {!isRunning ? (
                                    <Button
                                        onClick={startTest}
                                        className="flex-1 bg-gradient-to-r from-red-900 to-red-700 border-2 border-red-700 text-white hover:from-red-800 hover:to-red-600 shadow-[0_0_15px_rgba(239,68,68,0.3)]"
                                    >
                                        <Play className="w-4 h-4 mr-2" /> Start Test
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
                        <Card className="bg-black/60 border-blue-500/50">
                            <CardContent className="p-2 text-center">
                                <div className="text-2xl font-bold text-blue-400">{joinedCount}</div>
                                <div className="text-xs text-blue-400/70">Joined</div>
                            </CardContent>
                        </Card>
                        <Card className="bg-black/60 border-yellow-500/50">
                            <CardContent className="p-2 text-center">
                                <div className="text-2xl font-bold text-yellow-400">{answeringCount}</div>
                                <div className="text-xs text-yellow-400/70">Question</div>
                            </CardContent>
                        </Card>
                        <Card className="bg-black/60 border-green-500/50">
                            <CardContent className="p-2 text-center">
                                <div className="text-2xl font-bold text-green-400">{completedCount}</div>
                                <div className="text-xs text-green-400/70">Finished</div>
                            </CardContent>
                        </Card>
                        <Card className="bg-black/60 border-red-500/50">
                            <CardContent className="p-2 text-center">
                                <div className="text-2xl font-bold text-red-400">{eliminatedCount}</div>
                                <div className="text-xs text-red-400/70">Eliminated</div>
                            </CardContent>
                        </Card>
                        <Card className="bg-black/60 border-gray-500/50">
                            <CardContent className="p-2 text-center">
                                <div className="text-2xl font-bold text-gray-400">{errorCount}</div>
                                <div className="text-xs text-gray-400/70">Errors</div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Logs */}
                    <Card className="bg-black/60 border-red-500/30 gap-3">
                        <CardHeader>
                            <CardTitle className="text-sm text-red-400">📜 Live Logs</CardTitle>
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
