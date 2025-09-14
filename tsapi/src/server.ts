import express, { Request, Response } from "express";
import swaggerUi from "swagger-ui-express";
import * as swaggerDocument from "../swagger.json";

import legacyRoutes from "./routes/legacy";
import deviceRoutes from "./routes/device";
import hiveRoutes from "./routes/hive";
import areaRoutes from "./routes/area";
import userRoutes from "./routes/user";
import dataRoutes from "./routes/data";
import pictureRoutes from "./routes/picture";

import { backfillRange } from "./db/summary";
import { backupDatabase } from "./db/backup";
import { runCorrectProcess } from "./db/correct_sensor_data";

import { startInfra } from "./schedulers"; // ✅ 스케줄러 관리

const app = express();
const PORT = 8090;

// Swagger setup
app.use("/docs", (_req: Request, res: Response) => {
    try {
        res.status(200).send(swaggerUi.generateHTML(swaggerDocument));
    } catch (error) {
        console.error("Error generating swagger:", error);
        res.status(500).send("Internal Server Error");
    }
});

// API endpoint
app.get("/hello", (_req: Request, res: Response) => {
    res.send("Hello, World!");
});

// 백필은 엔드포인트에서만 수행
app.get("/summary", (_req: Request, res: Response) => {
    backfillRange("2022-01-01", "2025-10-30", 7, {
        autoGrowStep: true,
        growFactor: 2,
        growThreshold: 3,
        maxStepDays: 60,
    })
        .then(() => console.log("✅ Backfill finished"))
        .catch((err) => console.error("❌ Backfill error", err));
    res.json({ message: "Summary data" });
});

// 관리용 엔드포인트
app.get("/backup", (_req: Request, res: Response) => {
    backupDatabase();
    res.json({ message: "Backup initiated" });
});

app.get("/correct", (_req: Request, res: Response) => {
    runCorrectProcess();
    res.json({ message: "Correction process initiated" });
});

// Device routes
app.use("/", legacyRoutes);
app.use("/device", deviceRoutes);
app.use("/hive", hiveRoutes);
app.use("/area", areaRoutes);
app.use("/user", userRoutes);
app.use("/data", dataRoutes);
app.use("/picture", pictureRoutes);

// 서버 시작 + 인프라 초기화
startInfra()
    .then(() => {
        app.listen(PORT, () => {
            console.log(`Server is running on http://localhost:${PORT}`);
            console.log(`Swagger Docs available at http://localhost:${PORT}/docs`);
        });
    })
    .catch((err) => {
        console.error("Infra start failed:", err);
        process.exit(1);
    });
