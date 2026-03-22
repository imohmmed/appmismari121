import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import path from "path";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

// ─── Security headers (helmet) ────────────────────────────────────────────────
// contentSecurityPolicy disabled because the admin panel inlines styles/scripts.
// Everything else (HSTS, noSniff, xssFilter, referrerPolicy, etc.) is enabled.
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

// ─── CORS — restricted to known origins ──────────────────────────────────────
// IPA static files need a wildcard for itms-services:// downloads, so CORS is
// set per-route on the static middleware below. The API itself is restricted.
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map(o => o.trim())
  .filter(Boolean);

// Always allow localhost in dev and the production domain
const defaultOrigins = [
  "https://app.mismari.com",
  "http://localhost:3000",
  "http://localhost:21923",
  "http://localhost:5173",
];

const corsOrigins = allowedOrigins.length > 0
  ? allowedOrigins
  : defaultOrigins;

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (native apps, curl, Postman, iOS MDM)
    if (!origin) return callback(null, true);
    if (corsOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: origin '${origin}' not allowed`));
  },
  credentials: true,
}));

const uploadsDir = path.join(process.cwd(), "uploads");

// IPA files must be publicly accessible for itms-services:// installs (iOS requirement)
app.use("/admin/FilesIPA", express.static(path.join(uploadsDir, "FilesIPA"), {
  setHeaders(res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
  },
}));
app.use("/admin/FilesIPA/StoreIPA", express.static(path.join(uploadsDir, "StoreIPA"), {
  setHeaders(res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
  },
}));

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

app.use("/api", router);

export default app;
