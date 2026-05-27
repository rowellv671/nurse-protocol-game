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
  where,
} from "firebase/firestore";

type Question = {
  type: string;
  category: string;
  title: string;
  stem: string;
  options: string[];
  answer: number;
  rationale: string;
};

type LeaderboardEntry = {
  id?: string;
  name: string;
  score: number;
  totalQuestions: number;
  time: number;
  sessionCode: string;
  completedAt?: unknown;
};

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "",
};

const firebaseReady =
  Boolean(firebaseConfig.apiKey) && Boolean(firebaseConfig.projectId);

const firebaseApp = firebaseReady ? initializeApp(firebaseConfig) : null;
const db = firebaseApp ? getFirestore(firebaseApp) : null;

const questionBank: Question[] = [
  {
    type: "scenario",
    category: "Bladder Scan",
    title: "Case 1: No void after surgery",
    stem: "A post-op adult patient has not voided in 6 hours and reports bladder fullness. What is the best next step?",
    options: [
      "Continue routine monitoring until 8 hours",
      "Perform a bladder scan now",
      "Insert an indwelling catheter immediately",
      "Wait for the physician to round",
    ],
    answer: 1,
    rationale:
      "If the patient has not urinated within 6 hours and/or complains of bladder fullness, perform a bladder scan.",
  },
  {
    type: "scenario",
    category: "Bladder Scan",
    title: "Case 2: Low PVR",
    stem: "A patient voids before the scan. PVR is 220 mL and the patient has no symptoms. What should the nurse do?",
    options: [
      "Monitor urine output per unit protocol",
      "Repeat bladder scan in 4 hours",
      "Perform intermittent catheterization",
      "Insert an indwelling catheter",
    ],
    answer: 0,
    rationale:
      "If the patient has voided and PVR is less than 300 mL, monitor urine output per protocol.",
  },
  {
    type: "scenario",
    category: "Bladder Scan",
    title: "Case 3: Borderline retention",
    stem: "A stable, asymptomatic patient has a bladder scan volume of 420 mL. Which action is correct?",
    options: [
      "Monitor only",
      "Repeat bladder scan in 4 hours and restart pathway",
      "Perform intermittent catheterization now",
      "Insert an indwelling catheter now",
    ],
    answer: 1,
    rationale:
      "For 300–500 mL and asymptomatic, repeat bladder scan in 4 hours and restart pathway.",
  },
  {
    type: "scenario",
    category: "Bladder Scan",
    title: "Case 4: Moderate retention",
    stem: "A patient’s bladder scan shows 760 mL. Which intervention is indicated?",
    options: [
      "Repeat scan in 4 hours",
      "Perform intermittent catheterization and restart pathway",
      "Insert an indwelling catheter and discharge patient",
      "Monitor for another void attempt only",
    ],
    answer: 1,
    rationale:
      "A bladder volume between 501 and 1000 mL calls for intermittent catheterization and restarting the pathway.",
  },
  {
    type: "scenario",
    category: "Bladder Scan",
    title: "Case 5: Severe retention",
    stem: "A bladder scan shows 1125 mL. What is the best next action?",
    options: [
      "Repeat the scan after ambulation",
      "Perform intermittent catheterization",
      "Insert indwelling catheter and notify physician during rounds",
      "Encourage fluids and reassess tomorrow",
    ],
    answer: 2,
    rationale:
      "If bladder scan volume is greater than 1000 mL, insert an indwelling urinary catheter and notify the physician during rounds.",
  },
  {
    type: "scenario",
    category: "Exceptions",
    title: "Case 6: Contraindication",
    stem: "Which patient should NOT undergo bladder scan under this protocol?",
    options: [
      "A patient with suprapubic open skin or wound",
      "A patient who voided 4 hours ago",
      "A patient with bladder fullness",
      "A patient after catheter removal",
    ],
    answer: 0,
    rationale:
      "Do not bladder scan if the patient has open skin or a wound in the suprapubic region, or is pregnant.",
  },
  {
    type: "scenario",
    category: "Catheter Removal",
    title: "Case 7: Keep catheter?",
    stem: "Which situation is a valid reason to keep the indwelling catheter in place?",
    options: [
      "No current indication remains",
      "Perioperative status",
      "Patient prefers not to ambulate",
      "Catheter has been in place for 24 hours",
    ],
    answer: 1,
    rationale:
      "Perioperative status is one listed indication to keep the catheter in place.",
  },
  {
    type: "scenario",
    category: "Catheter Removal",
    title: "Case 8: Post-removal scan",
    stem: "A catheter was removed. When should the first bladder scan occur?",
    options: ["Immediately", "In 2 hours", "In 4 hours", "Only if patient complains"],
    answer: 2,
    rationale:
      "Four hours after urinary catheter removal, conduct a bladder scan.",
  },
  {
    type: "scenario",
    category: "Catheter Removal",
    title: "Case 9: Pathway duration",
    stem: "After indwelling catheter removal, how long should the urinary catheter removal pathway continue?",
    options: ["24 hours", "48 hours", "72 hours", "5 days"],
    answer: 1,
    rationale:
      "The urinary catheter removal pathway continues for 48 hours following removal.",
  },
  {
    type: "scenario",
    category: "Catheter Removal",
    title: "Case 10: Restart limit",
    stem: "How many more times may the removal pathway be restarted after completion?",
    options: ["One more time", "Two more times", "Three more times", "Unlimited"],
    answer: 1,
    rationale: "The pathway should only be restarted two more times.",
  },
];

function makeSessionCode(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function getInitialSessionCode(): string {
  if (typeof window === "undefined") return "TRAIN1";
  const params = new URLSearchParams(window.location.search);
  return params.get("room")?.toUpperCase() || "TRAIN1";
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

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export default function NurseProtocolGame() {
  const totalQuestions = 8;
  const quizSeconds = 480;

  const [playerName, setPlayerName] = useState("");
  const [sessionCode, setSessionCode] = useState(getInitialSessionCode());
  const [copied, setCopied] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(quizSeconds);
  const [finished, setFinished] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [firebaseStatus, setFirebaseStatus] = useState(
    firebaseReady ? "Connecting to Firebase..." : "Firebase not configured"
  );

  const currentQuestion = questions[index];

  const progress = useMemo(() => {
    if (!questions.length) return 0;
    return Math.round((index / questions.length) * 100);
  }, [index, questions.length]);

  useEffect(() => {
    if (!db) {
      setFirebaseStatus("Firebase not configured. Leaderboard will not sync.");
      return;
    }

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
          return { id: doc.id, ...data };
        });

        setLeaderboard(rows);
        setFirebaseStatus("Live leaderboard connected");
      },
      () => {
        setFirebaseStatus("Firebase issue. Check Firestore rules or indexes.");
      }
    );

    return () => unsubscribe();
  }, [sessionCode]);

  useEffect(() => {
    if (!gameStarted || finished) return;

    if (timeLeft <= 0) {
      finishGame();
      return;
    }

    const timer = setTimeout(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [gameStarted, finished, timeLeft]);

  function getShareLink(): string {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}${window.location.pathname}?room=${sessionCode}`;
  }

  async function copyJoinLink(): Promise<void> {
    try {
      await navigator.clipboard.writeText(getShareLink());
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  function createNewSession(): void {
    const nextCode = makeSessionCode();
    setSessionCode(nextCode);
    setLeaderboard([]);

    if (typeof window !== "undefined") {
      window.history.replaceState({}, "", `${window.location.pathname}?room=${nextCode}`);
    }
  }

  function joinSession(): void {
    const cleanCode = sessionCode.trim().toUpperCase() || "TRAIN1";
    setSessionCode(cleanCode);

    if (typeof window !== "undefined") {
      window.history.replaceState({}, "", `${window.location.pathname}?room=${cleanCode}`);
    }
  }

  function startGame(): void {
    setQuestions(shuffleArray(questionBank).slice(0, totalQuestions));
    setIndex(0);
    setSelected(null);
    setScore(0);
    setTimeLeft(quizSeconds);
    setFinished(false);
    setGameStarted(true);
  }

  function submitAnswer(choiceIndex: number): void {
    if (selected !== null || !currentQuestion) return;

    setSelected(choiceIndex);

    if (choiceIndex === currentQuestion.answer) {
      setScore((prev) => prev + 1);
    }
  }

  async function saveScore(finalScore: number, elapsed: number): Promise<void> {
    if (!db || !playerName.trim()) return;

    await addDoc(collection(db, "scores"), {
      name: playerName.trim(),
      score: finalScore,
      totalQuestions,
      time: elapsed,
      sessionCode,
      completedAt: serverTimestamp(),
    });
  }

  function finishGame(): void {
    setFinished(true);
    const elapsed = quizSeconds - timeLeft;
    void saveScore(score, elapsed);
  }

  function nextQuestion(): void {
    if (index + 1 < questions.length) {
      setIndex((prev) => prev + 1);
      setSelected(null);
      return;
    }

    finishGame();
  }

  if (!gameStarted) {
    return (
      <main className="min-h-screen bg-slate-50 p-6 text-slate-900">
        <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-3">
          <section className="rounded-2xl bg-white p-6 shadow-sm lg:col-span-2">
            <h1 className="text-3xl font-bold">🩺 Nurse Protocol Challenge</h1>
            <p className="mt-2 text-slate-600">
              Scenario-based training for bladder scan and nurse-empowered urinary catheter removal protocols.
            </p>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <InfoCard label="Mode" value="Scenario Cases" />
              <InfoCard label="Questions" value={`${totalQuestions} randomized`} />
              <InfoCard label="Timer" value="8 minutes" />
            </div>

            <div className="mt-6 rounded-2xl border bg-slate-50 p-4">
              <p className="text-sm text-slate-500">Session Code</p>
              <p className="text-3xl font-bold tracking-widest">{sessionCode}</p>

              <div className="mt-4 flex flex-wrap gap-2">
                <button className="btn-secondary" onClick={copyJoinLink}>
                  {copied ? "Copied" : "Copy join link"}
                </button>
                <button className="btn-secondary" onClick={createNewSession}>
                  New session
                </button>
              </div>

              <div className="mt-4 flex gap-2">
                <input
                  className="input"
                  value={sessionCode}
                  onChange={(e) => setSessionCode(e.target.value.toUpperCase())}
                  onBlur={joinSession}
                />
                <button className="btn-secondary" onClick={joinSession}>
                  Join
                </button>
              </div>

              <p className="mt-3 text-xs text-slate-500">{firebaseStatus}</p>
            </div>

            <div className="mt-6">
              <label className="text-sm font-medium">Learner name</label>
              <div className="mt-2 flex gap-2">
                <input
                  className="input"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder="e.g., Avery, RN"
                />
                <button className="btn-primary" onClick={startGame}>
                  Start
                </button>
              </div>
            </div>
          </section>

          <Leaderboard leaderboard={leaderboard} />
        </div>
      </main>
    );
  }

  if (finished) {
    const elapsed = quizSeconds - timeLeft;

    return (
      <main className="min-h-screen bg-slate-50 p-6 text-slate-900">
        <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-3">
          <section className="rounded-2xl bg-white p-8 text-center shadow-sm lg:col-span-2">
            <div className="text-5xl">🏆</div>
            <h2 className="mt-4 text-3xl font-bold">Quiz Complete</h2>
            <p className="mt-2 text-slate-600">Great work, {playerName || "Clinician"}.</p>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <InfoCard label="Score" value={`${score}/${questions.length}`} />
              <InfoCard label="Performance" value={getPerformanceLabel(score, questions.length)} />
              <InfoCard label="Time" value={formatTime(elapsed)} />
            </div>

            <div className="mt-6 flex justify-center gap-3">
              <button className="btn-primary" onClick={startGame}>
                Play Again
              </button>
              <button className="btn-secondary" onClick={() => setGameStarted(false)}>
                Home
              </button>
            </div>
          </section>

          <Leaderboard leaderboard={leaderboard} />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 p-6 text-slate-900">
      <div className="mx-auto max-w-4xl space-y-6">
        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm text-slate-500">Learner</p>
              <p className="font-semibold">{playerName || "Guest"}</p>
              <p className="text-xs text-slate-500">Session {sessionCode}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge>Question {index + 1} of {questions.length}</Badge>
              <Badge>⏱ {formatTime(timeLeft)}</Badge>
              <Badge>Score {score}</Badge>
            </div>
          </div>

          <div className="mt-4 h-2 rounded-full bg-slate-200">
            <div
              className="h-2 rounded-full bg-slate-900"
              style={{ width: `${progress}%` }}
            />
          </div>
        </section>

        {currentQuestion && (
          <section className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="mb-3 flex gap-2">
              <Badge>{currentQuestion.type}</Badge>
              <Badge>{currentQuestion.category}</Badge>
            </div>

            <h2 className="text-2xl font-bold">{currentQuestion.title}</h2>
            <p className="mt-3 leading-7 text-slate-700">{currentQuestion.stem}</p>

            <div className="mt-6 space-y-3">
              {currentQuestion.options.map((option, optionIndex) => {
                const isCorrect = optionIndex === currentQuestion.answer;
                const isSelected = optionIndex === selected;
                const showState = selected !== null;

                let classes =
                  "w-full rounded-2xl border bg-white p-4 text-left hover:bg-slate-50";

                if (showState && isCorrect) classes += " border-green-500";
                if (showState && isSelected && !isCorrect) classes += " border-red-500";

                return (
                  <button
                    key={option}
                    className={classes}
                    disabled={selected !== null}
                    onClick={() => submitAnswer(optionIndex)}
                  >
                    <div className="flex justify-between gap-3">
                      <span>{option}</span>
                      {showState && isCorrect && <span>✓</span>}
                      {showState && isSelected && !isCorrect && <span>✕</span>}
                    </div>
                  </button>
                );
              })}
            </div>

            {selected !== null && (
              <div className="mt-5 rounded-2xl bg-slate-100 p-4">
                <p className="font-semibold">Rationale</p>
                <p className="mt-2 text-sm leading-6 text-slate-700">
                  {currentQuestion.rationale}
                </p>
                <div className="mt-4 flex justify-end">
                  <button className="btn-primary" onClick={nextQuestion}>
                    Next Case
                  </button>
                </div>
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-dashed bg-white p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border bg-slate-100 px-3 py-1 text-sm">
      {children}
    </span>
  );
}

function Leaderboard({ leaderboard }: { leaderboard: LeaderboardEntry[] }) {
  return (
    <aside className="rounded-2xl bg-white p-6 shadow-sm">
      <h2 className="text-xl font-bold">🏆 Leaderboard</h2>
      <p className="mt-1 text-sm text-slate-500">Live session scores</p>

      <div className="mt-4 space-y-3">
        {leaderboard.length === 0 && (
          <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-500">
            No scores yet.
          </div>
        )}

        {leaderboard.map((entry, index) => (
          <div
            key={entry.id || `${entry.name}-${index}`}
            className="flex items-center justify-between rounded-xl bg-slate-50 p-3"
          >
            <div>
              <p className="font-medium">
                #{index + 1} {entry.name}
              </p>
              <p className="text-sm text-slate-500">
                {entry.score}/{entry.totalQuestions} correct
              </p>
            </div>
            <span className="rounded-full bg-white px-3 py-1 text-sm">
              {formatTime(entry.time)}
            </span>
          </div>
        ))}
      </div>
    </aside>
  );
}