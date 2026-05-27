"use client";

import React, { useEffect, useMemo, useState } from "react";
import { initializeApp } from "firebase/app";
import {
  addDoc,
  collection,
  getFirestore,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where
} from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "PASTE_FIREBASE_API_KEY_HERE",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "PASTE_FIREBASE_AUTH_DOMAIN_HERE",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "PASTE_FIREBASE_PROJECT_ID_HERE",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "PASTE_FIREBASE_STORAGE_BUCKET_HERE",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "PASTE_FIREBASE_MESSAGING_SENDER_ID_HERE",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "PASTE_FIREBASE_APP_ID_HERE"
};

const firebaseReady = !firebaseConfig.apiKey.includes("PASTE_") && !firebaseConfig.projectId.includes("PASTE_");
const firebaseApp = firebaseReady ? initializeApp(firebaseConfig) : null;
const db = firebaseApp ? getFirestore(firebaseApp) : null;

const questionBank = [
  {
    type: "scenario",
    category: "Bladder Scan",
    title: "Case 1: No void after surgery",
    stem:
      "A post-op adult patient has not voided in 6 hours and reports a feeling of bladder fullness. What is the best next step?",
    options: [
      "Continue routine monitoring until 8 hours",
      "Perform a bladder scan now",
      "Insert an indwelling catheter immediately",
      "Wait for the physician to round"
    ],
    answer: 1,
    rationale:
      "If the patient has not urinated within 6 hours and/or complains of bladder fullness, perform a bladder scan to assess incomplete bladder emptying."
  },
  {
    type: "scenario",
    category: "Bladder Scan",
    title: "Case 2: Low post-void residual",
    stem:
      "A patient voids just before the scan. The post-void residual is 220 mL and the patient has no symptoms. What should the nurse do next?",
    options: [
      "Monitor urine output per unit protocol",
      "Repeat the bladder scan in 4 hours",
      "Perform intermittent catheterization",
      "Insert an indwelling catheter"
    ],
    answer: 0,
    rationale:
      "If the patient has voided and the PVR is less than 300 mL, monitor urine output per standard protocol."
  },
  {
    type: "scenario",
    category: "Bladder Scan",
    title: "Case 3: Borderline retention",
    stem:
      "A stable, asymptomatic patient has a bladder scan volume of 420 mL. Which action is correct?",
    options: [
      "Monitor only",
      "Repeat bladder scan in 4 hours and restart pathway",
      "Perform intermittent catheterization now",
      "Insert an indwelling catheter now"
    ],
    answer: 1,
    rationale:
      "If bladder scan volume is between 300 and 500 mL and the patient is asymptomatic, repeat the bladder scan in 4 hours and restart the pathway."
  },
  {
    type: "scenario",
    category: "Bladder Scan",
    title: "Case 4: Moderate retention",
    stem:
      "A patient’s bladder scan shows 760 mL. Which intervention is indicated?",
    options: [
      "Repeat scan in 4 hours",
      "Perform intermittent catheterization and restart pathway",
      "Insert an indwelling catheter and discharge the patient",
      "Monitor for another void attempt only"
    ],
    answer: 1,
    rationale:
      "A bladder volume between 501 and 1000 mL calls for intermittent catheterization and restarting the pathway."
  },
  {
    type: "scenario",
    category: "Bladder Scan",
    title: "Case 5: Severe retention",
    stem:
      "A bladder scan shows 1125 mL. What is the best next action?",
    options: [
      "Repeat the scan after the patient ambulates",
      "Perform intermittent catheterization",
      "Insert an indwelling urinary catheter and notify the physician during rounds",
      "Encourage fluids and reassess tomorrow"
    ],
    answer: 2,
    rationale:
      "If bladder scan volume is greater than 1000 mL, insert an indwelling urinary catheter and notify the physician during rounds."
  },
  {
    type: "scenario",
    category: "Exceptions",
    title: "Case 6: Contraindication to scan",
    stem:
      "Which patient should NOT undergo a bladder scan under this protocol?",
    options: [
      "A patient with suprapubic open skin or wound",
      "A patient who voided 4 hours ago",
      "A patient who feels bladder fullness",
      "A patient after catheter removal"
    ],
    answer: 0,
    rationale:
      "Do not bladder scan if the patient has open skin or a wound in the suprapubic region, or is pregnant."
  },
  {
    type: "scenario",
    category: "Urgent Escalation",
    title: "Case 7: Symptomatic retention",
    stem:
      "A patient develops suprapubic tenderness and visible bladder distention 3 hours after the last assessment. What should happen now?",
    options: [
      "Wait until 6 hours have passed to scan",
      "Promptly obtain a bladder scan and intervene as medically necessary",
      "Reassess at shift change",
      "Only notify the physician"
    ],
    answer: 1,
    rationale:
      "At any point, if the patient develops signs or symptoms of urinary retention, promptly obtain a bladder scan and perform medically necessary intervention."
  },
  {
    type: "scenario",
    category: "Catheter Removal",
    title: "Case 8: Remove or keep?",
    stem:
      "A nurse is assessing catheter necessity. Which situation is a valid reason to KEEP the catheter in place?",
    options: [
      "No current indication remains",
      "Perioperative status",
      "Patient prefers not to ambulate",
      "Catheter has been in place for 24 hours"
    ],
    answer: 1,
    rationale:
      "Perioperative status is one of the listed indications to keep the indwelling urinary catheter in place."
  },
  {
    type: "scenario",
    category: "Catheter Removal",
    title: "Case 9: Post-removal timing",
    stem:
      "A catheter was removed without any remaining indication. When should the first bladder scan occur?",
    options: [
      "Immediately after removal",
      "In 2 hours",
      "In 4 hours",
      "Only if the patient complains"
    ],
    answer: 2,
    rationale:
      "Four hours after urinary catheter removal, conduct a bladder scan. If the patient can void, instruct them to void immediately before the scan to determine PVR."
  },
  {
    type: "scenario",
    category: "Catheter Removal",
    title: "Case 10: Pathway duration",
    stem:
      "After indwelling catheter removal, how long should the urinary catheter removal pathway continue?",
    options: [
      "24 hours",
      "48 hours",
      "72 hours",
      "5 days"
    ],
    answer: 1,
    rationale:
      "The urinary catheter removal pathway continues for 48 hours following removal of the indwelling urinary catheter."
  },
  {
    type: "scenario",
    category: "Catheter Removal",
    title: "Case 11: Persistent high residual after pathway",
    stem:
      "After completing the pathway, the patient still has a PVR of 850 mL. What is the next plan?",
    options: [
      "Remove catheter the next morning and stop monitoring",
      "Remove catheter after 3 days for bladder rest and restart pathway",
      "Remove catheter after 5 days for bladder rest and restart pathway",
      "Do not restart the pathway"
    ],
    answer: 1,
    rationale:
      "If the PVR is between 501 and 1000 mL after pathway completion, remove the catheter after 3 days for bladder rest and restart the pathway."
  },
  {
    type: "scenario",
    category: "Catheter Removal",
    title: "Case 12: Restart limit",
    stem:
      "How many more times may the removal pathway be restarted after completion?",
    options: [
      "One more time",
      "Two more times",
      "Three more times",
      "There is no restart limit"
    ],
    answer: 1,
    rationale:
      "The pathway should only be restarted two more times."
  }
];

type LeaderboardEntry = {
  id?: string;
  name: string;
  score: number;
  totalQuestions?: number;
  time: number;
  session?: string;
  sessionCode?: string;
  completedAt?: unknown;
};

const defaultLeaders: LeaderboardEntry[] = [];

function makeSessionCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function getInitialSessionCode() {
  if (typeof window === "undefined") return "TRAIN1";
  const params = new URLSearchParams(window.location.search);
  const room = params.get("room");
  if (room) return room.toUpperCase();
  const saved = localStorage.getItem("nurse-protocol-session-code");
  if (saved) return saved;
  return "TRAIN1";
}

function shuffleArray<T>(items: T[]): T[] {
  return [...items].sort(() => Math.random() - 0.5);
}

function getPerformanceLabel(score: number, total: number): string {
  const pct = Math.round((score / total) * 100);
  if (pct >= 90) return "Excellent";
  if (pct >= 75) return "Good";
  return "Needs Review";
}

export default function NurseProtocolGame() {
  const totalQuestions = 8;
  const [playerName, setPlayerName] = useState("");
  const [sessionCode, setSessionCode] = useState(getInitialSessionCode());
  const [copied, setCopied] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [questions, setQuestions] = useState([]);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState(null);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(480);
  const [finished, setFinished] = useState(false);
  const [leaderboard, setLeaderboard] = useState(defaultLeaders);
  const [firebaseStatus, setFirebaseStatus] = useState(firebaseReady ? "Connecting to Firebase..." : "Firebase not configured yet");

  const currentQuestion = questions[index];
  const progress = useMemo(() => {
    if (!questions.length) return 0;
    return Math.round((index / questions.length) * 100);
  }, [index, questions.length]);

  useEffect(() => {
    localStorage.setItem("nurse-protocol-session-code", sessionCode);

    if (!db) {
      const key = `nurse-protocol-leaderboard-${sessionCode}`;
      const saved = localStorage.getItem(key);
      if (saved) {
        try {
          setLeaderboard(JSON.parse(saved));
        } catch {
          setLeaderboard(defaultLeaders);
        }
      } else {
        setLeaderboard(defaultLeaders);
      }
      setFirebaseStatus("Firebase not configured yet. Using local browser leaderboard.");
      return;
    }

    setFirebaseStatus("Live leaderboard connected");
    const scoresQuery = query(
      collection(db, "scores"),
      where("sessionCode", "==", sessionCode),
      orderBy("score", "desc"),
      orderBy("time", "asc"),
      limit(10)
    );

    const unsubscribe = onSnapshot(
      scoresQuery,
      (snapshot) => {
        const rows: LeaderboardEntry[] = snapshot.docs.map((doc) => {
  const data = doc.data() as Omit<LeaderboardEntry, "id">;
  return {
    id: doc.id,
    ...data
  };
});
        setLeaderboard(rows);
        setFirebaseStatus("Live leaderboard connected");
      },
      () => {
        setFirebaseStatus("Firebase connection issue. Check Firestore rules and indexes.");
      }
    );

    return () => unsubscribe();
  }, [sessionCode]);

  useEffect(() => {
    if (db) return;
    const key = `nurse-protocol-leaderboard-${sessionCode}`;
    localStorage.setItem(key, JSON.stringify(leaderboard));
  }, [leaderboard, sessionCode]);

  useEffect(() => {
    if (!gameStarted || finished) return;
    if (timeLeft <= 0) {
      setFinished(true);
      return;
    }
    const timer = setTimeout(() => setTimeLeft((prev) => prev - 1), 1000);
    return () => clearTimeout(timer);
  }, [gameStarted, finished, timeLeft]);

  const getShareLink = () => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}${window.location.pathname}?room=${sessionCode}`;
  };

  const copyJoinLink = async () => {
    const link = getShareLink();
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  const createNewSession = () => {
    const nextCode = makeSessionCode();
    setSessionCode(nextCode);
    setLeaderboard([]);
    setCopied(false);
    if (typeof window !== "undefined") {
      const url = `${window.location.pathname}?room=${nextCode}`;
      window.history.replaceState({}, "", url);
    }
  };

  const joinSession = () => {
    const cleanCode = sessionCode.trim().toUpperCase() || "TRAIN1";
    setSessionCode(cleanCode);
    if (typeof window !== "undefined") {
      const url = `${window.location.pathname}?room=${cleanCode}`;
      window.history.replaceState({}, "", url);
    }
  };

  const startGame = () => {
    const selectedQuestions = shuffleArray(questionBank).slice(0, totalQuestions);
    setQuestions(selectedQuestions);
    setIndex(0);
    setSelected(null);
    setScore(0);
    setTimeLeft(180);
    setFinished(false);
    setGameStarted(true);
  };

  const submitAnswer = (choiceIndex) => {
    if (selected !== null) return;
    setSelected(choiceIndex);
    if (choiceIndex === currentQuestion.answer) {
      setScore((prev) => prev + 1);
    }
  };

  const saveScore = async (finalScore, elapsed) => {
    if (!playerName.trim()) return;

    const scoreRecord = {
      name: playerName.trim(),
      score: finalScore,
      totalQuestions,
      time: elapsed,
      sessionCode,
      completedAt: db ? serverTimestamp() : new Date().toISOString()
    };

    if (db) {
      try {
        await addDoc(collection(db, "scores"), scoreRecord);
        setFirebaseStatus("Score saved to live leaderboard");
      } catch {
        setFirebaseStatus("Could not save to Firebase. Check Firestore rules.");
      }
      return;
    }

    const updated = [...leaderboard, scoreRecord]
      .sort((a, b) => (b.score !== a.score ? b.score - a.score : a.time - b.time))
      .slice(0, 8);
    setLeaderboard(updated);
  };

  const nextQuestion = () => {
    if (index + 1 < questions.length) {
      setIndex((prev) => prev + 1);
      setSelected(null);
    } else {
      setFinished(true);
      const finalScore = score;
      const elapsed = 180 - timeLeft;
      saveScore(finalScore, elapsed);
    }
  };

  const restartGame = () => {
    startGame();
  };

  const clearLeaderboard = () => {
    if (db) {
      setFirebaseStatus("Live leaderboard reset is disabled in this demo. Clear scores in Firebase Console or add an admin-only reset function.");
      return;
    }
    setLeaderboard([]);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (!gameStarted) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Card className="rounded-2xl shadow-sm">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-slate-100 p-3">
                    <span className="text-xl" aria-hidden="true">🩺</span>
                  </div>
                  <div>
                    <CardTitle className="text-2xl">Nurse Protocol Challenge</CardTitle>
                    <CardDescription>
                      Shareable scenario-based training on bladder scan and nurse-empowered urinary catheter removal protocols.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-3">
                  <Card className="rounded-2xl border-dashed">
                    <CardContent className="p-4">
                      <p className="text-sm text-slate-500">Mode</p>
                      <p className="mt-1 font-semibold">Scenario Cases</p>
                    </CardContent>
                  </Card>
                  <Card className="rounded-2xl border-dashed">
                    <CardContent className="p-4">
                      <p className="text-sm text-slate-500">Questions</p>
                      <p className="mt-1 font-semibold">{totalQuestions} randomized cases</p>
                    </CardContent>
                  </Card>
                  <Card className="rounded-2xl border-dashed">
                    <CardContent className="p-4">
                      <p className="text-sm text-slate-500">Timer</p>
                      <p className="mt-1 font-semibold">8 minutes</p>
                    </CardContent>
                  </Card>
                </div>

                <div className="rounded-2xl border bg-white p-4">
                  <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-sm text-slate-500">Session Code</p>
                      <p className="text-2xl font-bold tracking-widest">{sessionCode}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" className="rounded-xl" onClick={copyJoinLink}>
                        {copied ? "Copied" : "Copy join link"}
                      </Button>
                      <Button variant="outline" className="rounded-xl" onClick={createNewSession}>
                        New session
                      </Button>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={sessionCode}
                      onChange={(e) => setSessionCode(e.target.value.toUpperCase())}
                      onBlur={joinSession}
                      placeholder="Session code"
                      className="rounded-xl uppercase"
                    />
                    <Button variant="secondary" className="rounded-xl" onClick={joinSession}>Join</Button>
                  </div>
                  <p className="mt-3 text-xs leading-5 text-slate-500">
                    After publishing this app, share the join link or session code with learners. This version stores scores by session on the device/browser. Firebase real-time leaderboard support is built in. Add your Firebase config and Firestore scores will sync across devices in real time.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Enter learner name for leaderboard</label>
                  <div className="flex gap-2">
                    <Input
                      value={playerName}
                      onChange={(e) => setPlayerName(e.target.value)}
                      placeholder="e.g., Avery, RN"
                      className="rounded-xl"
                    />
                    <Button onClick={startGame} className="rounded-xl">
                      <span className="mr-2" aria-hidden="true">▶</span> Start
                    </Button>
                  </div>
                </div>

                <div className="rounded-2xl bg-slate-100 p-4 text-sm leading-6 text-slate-700">
                  Answer each patient case, review the rationale, and compare performance on the session leaderboard. Higher score ranks first; ties are broken by faster completion time.
                </div>
              </CardContent>
            </Card>
          </div>

          <div>
            <Card className="rounded-2xl shadow-sm">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <span aria-hidden="true">🏆</span>
                  <CardTitle className="text-xl">Leaderboard</CardTitle>
                </div>
                <CardDescription>Session {sessionCode} real-time leaderboard</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-xl bg-slate-100 p-3 text-xs text-slate-600">{firebaseStatus}</div>
                {leaderboard.length === 0 && (
                  <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-500">
                    No scores yet. Start the first round to populate this session leaderboard.
                  </div>
                )}
                {leaderboard.map((entry, idx) => (
                  <div key={`${entry.name}-${idx}`} className="flex items-center justify-between rounded-xl bg-slate-50 p-3">
                    <div>
                      <p className="font-medium">#{idx + 1} {entry.name}</p>
                      <p className="text-sm text-slate-500">{entry.score}/{entry.totalQuestions || totalQuestions} correct</p>
                    </div>
                    <Badge variant="secondary" className="rounded-full">{formatTime(entry.time)}</Badge>
                  </div>
                ))}
                <Button variant="outline" className="w-full rounded-xl" onClick={clearLeaderboard}>
                  Reset leaderboard
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  if (finished) {
    const elapsed = 180 - timeLeft;
    const performance = getPerformanceLabel(score, questions.length || totalQuestions);

    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Card className="rounded-2xl shadow-sm">
              <CardContent className="p-8 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
                  <span className="text-3xl" aria-hidden="true">🏆</span>
                </div>
                <h2 className="text-3xl font-bold">Quiz Complete</h2>
                <p className="mt-3 text-slate-600">Great work, {playerName || "Clinician"}.</p>
                <div className="mt-6 grid gap-4 md:grid-cols-3">
                  <Card className="rounded-2xl">
                    <CardContent className="p-4">
                      <p className="text-sm text-slate-500">Score</p>
                      <p className="mt-1 text-2xl font-bold">{score}/{questions.length}</p>
                    </CardContent>
                  </Card>
                  <Card className="rounded-2xl">
                    <CardContent className="p-4">
                      <p className="text-sm text-slate-500">Performance</p>
                      <p className="mt-1 text-2xl font-bold">{performance}</p>
                    </CardContent>
                  </Card>
                  <Card className="rounded-2xl">
                    <CardContent className="p-4">
                      <p className="text-sm text-slate-500">Time</p>
                      <p className="mt-1 text-2xl font-bold">{formatTime(elapsed)}</p>
                    </CardContent>
                  </Card>
                </div>
                <div className="mt-6 flex flex-wrap justify-center gap-3">
                  <Button onClick={restartGame} className="rounded-xl">
                    <span className="mr-2" aria-hidden="true">↻</span> Play Again
                  </Button>
                  <Button variant="outline" onClick={() => setGameStarted(false)} className="rounded-xl">
                    Return to Home
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          <div>
            <Card className="rounded-2xl shadow-sm">
              <CardHeader>
                <CardTitle className="text-xl">Leaderboard</CardTitle>
                <CardDescription>Session {sessionCode} real-time leaderboard</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-xl bg-slate-100 p-3 text-xs text-slate-600">{firebaseStatus}</div>
                {leaderboard.length === 0 && (
                  <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-500">
                    No scores yet. Start the first round to populate this session leaderboard.
                  </div>
                )}
                {leaderboard.map((entry, idx) => (
                  <div key={`${entry.name}-${idx}`} className="flex items-center justify-between rounded-xl bg-slate-50 p-3">
                    <div>
                      <p className="font-medium">#{idx + 1} {entry.name}</p>
                      <p className="text-sm text-slate-500">{entry.score}/{entry.totalQuestions || totalQuestions} correct</p>
                    </div>
                    <Badge variant="secondary" className="rounded-full">{formatTime(entry.time)}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <Card className="rounded-2xl shadow-sm">
            <CardContent className="p-5">
              <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm text-slate-500">Learner</p>
                  <p className="font-semibold">{playerName || "Guest"}</p>
                  <p className="text-xs text-slate-500">Session {sessionCode}</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Badge className="rounded-full px-3 py-1">Question {index + 1} of {questions.length}</Badge>
                  <Badge variant="secondary" className="rounded-full px-3 py-1">
                    <span className="mr-1" aria-hidden="true">⏱</span> {formatTime(timeLeft)}
                  </Badge>
                  <Badge variant="outline" className="rounded-full px-3 py-1">Score {score}</Badge>
                </div>
              </div>
              <Progress value={progress} className="h-2" />
            </CardContent>
          </Card>
        </div>

        {currentQuestion && (
          <div>
            <Card className="rounded-2xl shadow-sm">
              <CardHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="rounded-full">{currentQuestion.type}</Badge>
                  <Badge variant="secondary" className="rounded-full">{currentQuestion.category}</Badge>
                </div>
                <CardTitle className="text-2xl">{currentQuestion.title}</CardTitle>
                <CardDescription className="text-base leading-7 text-slate-700">
                  {currentQuestion.stem}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {currentQuestion.options.map((option, optionIndex) => {
                  const isCorrect = optionIndex === currentQuestion.answer;
                  const isSelected = optionIndex === selected;
                  const showState = selected !== null;

                  let className = "w-full justify-start rounded-2xl px-4 py-6 text-left whitespace-normal";
                  if (showState && isCorrect) className += " border-emerald-500";
                  if (showState && isSelected && !isCorrect) className += " border-rose-500";

                  return (
                    <Button
                      key={option}
                      variant="outline"
                      className={className}
                      onClick={() => submitAnswer(optionIndex)}
                      disabled={selected !== null}
                    >
                      <div className="flex w-full items-center justify-between gap-3">
                        <span>{option}</span>
                        {showState && isCorrect && <span className="shrink-0" aria-hidden="true">✓</span>}
                        {showState && isSelected && !isCorrect && <span className="shrink-0" aria-hidden="true">✕</span>}
                      </div>
                    </Button>
                  );
                })}

                {selected !== null && (
                  <div className="mt-4 rounded-2xl bg-slate-100 p-4">
                    <p className="font-semibold">Rationale</p>
                    <p className="mt-2 text-sm leading-6 text-slate-700">{currentQuestion.rationale}</p>
                    <div className="mt-4 flex justify-end">
                      <Button onClick={nextQuestion} className="rounded-xl">Next Case</Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
