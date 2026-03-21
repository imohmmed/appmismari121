import { Router, type IRouter } from "express";
import healthRouter from "./health";
import appsRouter from "./apps";
import categoriesRouter from "./categories";
import subscriptionsRouter from "./subscriptions";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use(appsRouter);
router.use(categoriesRouter);
router.use(subscriptionsRouter);
router.use(adminRouter);

export default router;
