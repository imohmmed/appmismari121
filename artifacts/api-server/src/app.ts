import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import path from "path";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

// Trust the Replit/Nginx reverse proxy so rate-limiter sees the real client IP
app.set("trust proxy", 1);

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

// Auto-add Replit dev domain (available in the Replit environment)
if (process.env.REPLIT_DEV_DOMAIN) {
  defaultOrigins.push(`https://${process.env.REPLIT_DEV_DOMAIN}`);
}
// Also support comma-separated REPLIT_DOMAINS
if (process.env.REPLIT_DOMAINS) {
  for (const d of process.env.REPLIT_DOMAINS.split(",")) {
    const origin = `https://${d.trim()}`;
    if (!defaultOrigins.includes(origin)) defaultOrigins.push(origin);
  }
}

const corsOrigins = allowedOrigins.length > 0
  ? allowedOrigins
  : defaultOrigins;

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (native apps, curl, Postman, iOS MDM)
    if (!origin) return callback(null, true);
    if (corsOrigins.includes(origin)) return callback(null, true);
    // Allow any Replit dev/preview subdomain (Expo dev builds, preview pane, etc.)
    if (/\.replit\.dev$/.test(origin) || /\.janeway\.replit\.dev$/.test(origin)) {
      return callback(null, true);
    }
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
