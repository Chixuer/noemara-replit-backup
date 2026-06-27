import { Router, type IRouter } from "express";
import healthRouter from "./health";
import asrRouter from "./asr";
import chatRouter from "./chat";

const router: IRouter = Router();

router.use(healthRouter);
router.use(asrRouter);
router.use(chatRouter);

export default router;
