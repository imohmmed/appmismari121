import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "path";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

const uploadsDir = path.join(process.cwd(), "uploads");
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
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

export default app;
