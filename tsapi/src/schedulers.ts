// src/schedulers.ts
import { initializeDatabase } from "./db/initialize";
import { drainSummaryOnce } from "./db/summary";
import { backupDatabase } from "./db/backup";
import { runCorrectProcess } from "./db/correct_sensor_data";

export type StopFn = () => void;

let _ready = false;
export function isReady() {
    return _ready;
}

// =======================
// 내부 작업 함수
// =======================

async function runSummaryPump() {
    try {
        await drainSummaryOnce(500); // limitPerRun = 500
    } catch (err) {
        console.error("[scheduler] summary pump error:", err);
    }
}

function runBackupJob() {
    try {
        backupDatabase();
    } catch (err) {
        console.error("[scheduler] backup error:", err);
    }
}

function runCorrectJob() {
    try {
        runCorrectProcess();
    } catch (err) {
        console.error("[scheduler] correct-process error:", err);
    }
}

// =======================
// 인프라 시작/정지
// =======================

export async function startInfra(): Promise<StopFn> {
    await initializeDatabase();
    console.log("Database initialized successfully");

    const stops: StopFn[] = [];

    // Summary Pump (15초마다 실행, 부팅 직후 1회 실행)
    void runSummaryPump();
    const pumpTimer = setInterval(runSummaryPump, 15_000);
    console.log("[scheduler] summary pump started");
    stops.push(() => clearInterval(pumpTimer));

    // Clock Jobs (매일 자정 백업, 매시 정각 보정)
    const clockTimer = setInterval(() => {
        const now = new Date();
        if (now.getHours() === 0 && now.getMinutes() === 0) {
            runBackupJob();
        }
        if (now.getMinutes() === 0) {
            runCorrectJob();
        }
    }, 60 * 1000);
    console.log("[scheduler] clock jobs started");
    stops.push(() => clearInterval(clockTimer));

    _ready = true;

    return () => {
        for (const stop of stops) stop();
        _ready = false;
        console.log("[scheduler] stopped all jobs");
    };
}
