"use client";

import { useEffect, useRef, useState } from "react";
import { mysupa } from "@/lib/supabase";
import { generateXID } from "@/lib/id-generator";

// Character options for avatar
const CHARACTER_OPTIONS = [
    "robot1", "robot2", "robot3", "robot4", "robot5",
    "robot6", "robot7", "robot8", "robot9", "robot10"
];

// Helper to pick random from array
const pickRandom = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

// Random delay helper
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const randomDelay = (min: number, max: number) => delay(min + Math.random() * (max - min));

/**
 * Bot Personality - determines bot behavior
 * 
 * IQ (50-150): Affects answer accuracy
 * - 50-70:   Bodoh (30-45% accuracy)
 * - 71-90:   Below average (45-60%)
 * - 91-110:  Average (60-75%)
 * - 111-130: Above average (75-85%)
 * - 131-150: Genius (85-95%)
 * 
 * Speed (1-10): Affects answer timing
 * - 1-2:  Very slow (8-15s)
 * - 3-4:  Slow (5-10s)
 * - 5-6:  Normal (3-7s)
 * - 7-8:  Fast (2-5s)
 * - 9-10: Very fast (1-3s)
 * 
 * Restlessness (0-1): Character change frequency in lobby
 * - 0.0-0.3: Calm (rarely changes)
 * - 0.4-0.6: Normal
 * - 0.7-1.0: Restless (changes often)
 */
export interface BotPersonality {
    iq: number;           // 50-150
    speed: number;        // 1-10
    restlessness: number; // 0-1
}

export interface Question {
    id: string;
    answers: any[];
    correct: string;
}

export interface BotInstanceProps {
    sessionId: string;
    nickname: string;
    personality: BotPersonality;
    questions: Question[];
    questionLimit: number;
    difficulty: string;
    gameStatus: "waiting" | "active" | "finished";
    stopSignal: boolean;
    onJoined: (participantId: string, nickname: string) => void;
    onAnswered: (nickname: string, questionIndex: number, correct: boolean) => void;
    onCompleted: (nickname: string) => void;
    onEliminated: (nickname: string) => void;
    onError: (nickname: string, error: string) => void;
}

/**
 * Generate random personality for a bot
 * Uses normal distribution for more realistic IQ spread
 */
export function generatePersonality(): BotPersonality {
    // Normal distribution for IQ (centered at 100, std dev ~20)
    const u1 = Math.random();
    const u2 = Math.random();
    const normalRandom = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    const iq = Math.max(50, Math.min(150, Math.round(100 + normalRandom * 20)));

    // Uniform distribution for speed and restlessness
    const speed = Math.ceil(Math.random() * 10);
    const restlessness = Math.random();

    return { iq, speed, restlessness };
}

/**
 * Calculate answer accuracy based on IQ
 */
function getAccuracyFromIQ(iq: number): number {
    if (iq <= 70) return 0.30 + (iq - 50) / 20 * 0.15;      // 30-45%
    if (iq <= 90) return 0.45 + (iq - 70) / 20 * 0.15;      // 45-60%
    if (iq <= 110) return 0.60 + (iq - 90) / 20 * 0.15;     // 60-75%
    if (iq <= 130) return 0.75 + (iq - 110) / 20 * 0.10;    // 75-85%
    return 0.85 + (iq - 130) / 20 * 0.10;                   // 85-95%
}

/**
 * Calculate answer delay range based on speed
 */
function getDelayRangeFromSpeed(speed: number): { min: number; max: number } {
    if (speed <= 2) return { min: 8000, max: 15000 };  // Very slow
    if (speed <= 4) return { min: 5000, max: 10000 };  // Slow
    if (speed <= 6) return { min: 3000, max: 7000 };   // Normal
    if (speed <= 8) return { min: 2000, max: 5000 };   // Fast
    return { min: 1000, max: 3000 };                    // Very fast
}

/**
 * Get health by difficulty
 */
function getHealthByDifficulty(difficulty: string): number {
    const diffLevel = difficulty?.split(":")?.[1]?.trim().toLowerCase() || "medium";
    const healthMap: Record<string, number> = { easy: 5, medium: 3, hard: 1 };
    return healthMap[diffLevel] ?? 3;
}

/**
 * BotInstance - Headless component that manages a single bot's lifecycle
 * 
 * Lifecycle:
 * 1. Join session (on mount)
 * 2. Lobby phase - change character based on restlessness
 * 3. Game phase - answer questions based on IQ and speed
 * 4. Complete or get eliminated
 */
export function BotInstance({
    sessionId,
    nickname,
    personality,
    questions,
    questionLimit,
    difficulty,
    gameStatus,
    stopSignal,
    onJoined,
    onAnswered,
    onCompleted,
    onEliminated,
    onError,
}: BotInstanceProps) {
    const [participantId, setParticipantId] = useState<string | null>(null);
    const [currentQuestion, setCurrentQuestion] = useState(0);
    const [health, setHealth] = useState(() => getHealthByDifficulty(difficulty));
    const [correctCount, setCorrectCount] = useState(0);
    const [isCompleted, setIsCompleted] = useState(false);
    const [hasJoined, setHasJoined] = useState(false);

    const mountedRef = useRef(true);
    const answeringRef = useRef(false);

    // Calculate personality-based values
    const accuracy = getAccuracyFromIQ(personality.iq);
    const delayRange = getDelayRangeFromSpeed(personality.speed);
    const totalQuestions = Math.min(questions.length, questionLimit || questions.length);
    const scorePerQuestion = Math.max(1, Math.floor(100 / totalQuestions));

    // Join session on mount - with delay based on speed personality
    useEffect(() => {
        if (hasJoined || !sessionId || stopSignal) return;

        const joinSession = async () => {
            // Join delay based on speed personality (simulates typing room code + clicking join)
            // Fast bots (speed 9-10): 1-3 seconds
            // Slow bots (speed 1-2): 8-15 seconds
            const joinDelayRange = getDelayRangeFromSpeed(personality.speed);
            await randomDelay(joinDelayRange.min, joinDelayRange.max);

            if (!mountedRef.current || stopSignal) return;

            const maxHealth = getHealthByDifficulty(difficulty);
            const character_type = pickRandom(CHARACTER_OPTIONS);

            try {
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
                            max: maxHealth,
                            current: maxHealth,
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
                    onError(nickname, error?.message || "Failed to join");
                    return;
                }

                if (mountedRef.current) {
                    setParticipantId(participant.id);
                    setHasJoined(true);
                    setHealth(maxHealth);
                    onJoined(participant.id, nickname);
                }
            } catch (err: any) {
                onError(nickname, err.message);
            }
        };

        joinSession();
    }, [sessionId, hasJoined, nickname, difficulty, personality.speed, stopSignal, onJoined, onError]);

    // Lobby phase - change character based on restlessness
    useEffect(() => {
        if (gameStatus !== "waiting" || !participantId || stopSignal) return;

        let timeoutId: NodeJS.Timeout;

        const changeCharacter = async () => {
            // Only change if restlessness threshold is met
            if (Math.random() < personality.restlessness) {
                const newCharacter = pickRandom(CHARACTER_OPTIONS);
                await mysupa
                    .from("participants")
                    .update({ character_type: newCharacter })
                    .eq("id", participantId);
            }

            // Schedule next check (2-8 seconds based on restlessness)
            const nextDelay = 2000 + (1 - personality.restlessness) * 6000;
            if (mountedRef.current && gameStatus === "waiting") {
                timeoutId = setTimeout(changeCharacter, nextDelay);
            }
        };

        // Initial delay before first character change
        timeoutId = setTimeout(changeCharacter, 2000 + Math.random() * 3000);

        return () => clearTimeout(timeoutId);
    }, [gameStatus, participantId, personality.restlessness, stopSignal]);

    // Game phase - answer questions
    useEffect(() => {
        if (gameStatus !== "active" || !participantId || isCompleted || stopSignal || answeringRef.current) return;
        if (questions.length === 0) return;

        answeringRef.current = true;

        const answerQuestions = async () => {
            for (let qIndex = currentQuestion; qIndex < totalQuestions; qIndex++) {
                if (!mountedRef.current || stopSignal || isCompleted || health <= 0) break;

                // Think time based on speed personality
                await randomDelay(delayRange.min, delayRange.max);
                if (!mountedRef.current || stopSignal) break;

                const question = questions[qIndex];
                if (!question || !question.answers?.length) continue;

                const correctAnswerIndex = parseInt(question.correct, 10);

                // Decide if bot answers correctly based on IQ
                const answersCorrectly = Math.random() < accuracy;
                let selectedIndex: number;

                if (answersCorrectly && !isNaN(correctAnswerIndex) && correctAnswerIndex < question.answers.length) {
                    selectedIndex = correctAnswerIndex;
                } else {
                    // Pick wrong answer
                    const wrongIndices = question.answers
                        .map((_: any, i: number) => i)
                        .filter((i: number) => i !== correctAnswerIndex);
                    selectedIndex = wrongIndices.length > 0
                        ? wrongIndices[Math.floor(Math.random() * wrongIndices.length)]
                        : Math.floor(Math.random() * question.answers.length);
                }

                const isCorrect = selectedIndex.toString() === question.correct;
                const newHealth = isCorrect ? health : Math.max(0, health - 1);

                // Get current state from database (like player quiz page does)
                const { data: currentParticipant } = await mysupa
                    .from("participants")
                    .select("answers, health, correct_answers")
                    .eq("id", participantId)
                    .single();

                if (!currentParticipant) continue;

                // Calculate new values based on database state (like player quiz page line 268-273)
                const answersNew = [...(currentParticipant.answers || []), {
                    id: generateXID(),
                    correct: isCorrect,
                    answer_id: selectedIndex.toString(),
                    question_id: question.id
                }];

                // Count correct answers from actual answers array (like player quiz line 271)
                const newCorrectCount = answersNew.filter((a: any) => a.correct).length;

                // Calculate score using the same formula as player quiz (line 272-273)
                const scorePerQ = totalQuestions > 0 ? Math.floor(100 / totalQuestions) : 100;
                const newScore = newCorrectCount * scorePerQ;

                // Use stored speed from database
                const storedSpeed = currentParticipant.health?.speed || 20;
                const newSpeed = Math.max(20, storedSpeed + (isCorrect ? 5 : -5));

                const newAnswer = answersNew[answersNew.length - 1];
                const isLastQuestion = qIndex === totalQuestions - 1;
                const isEliminated = newHealth <= 0;

                try {
                    await mysupa
                        .from("participants")
                        .update({
                            answers: answersNew,
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
                        .eq("id", participantId);

                    if (mountedRef.current) {
                        setCurrentQuestion(qIndex + 1);
                        setHealth(newHealth);
                        setCorrectCount(newCorrectCount);
                        onAnswered(nickname, qIndex + 1, isCorrect);

                        if (isEliminated) {
                            setIsCompleted(true);
                            onEliminated(nickname);
                            break;
                        }

                        if (isLastQuestion) {
                            setIsCompleted(true);
                            onCompleted(nickname);
                        }
                    }
                } catch (err: any) {
                    onError(nickname, err.message);
                }
            }

            answeringRef.current = false;
        };

        answerQuestions();
    }, [gameStatus, participantId, questions, isCompleted, stopSignal, health, currentQuestion,
        totalQuestions, delayRange, accuracy, correctCount, nickname,
        onAnswered, onCompleted, onEliminated, onError]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            mountedRef.current = false;
        };
    }, []);

    // Headless component - no UI
    return null;
}

export default BotInstance;
