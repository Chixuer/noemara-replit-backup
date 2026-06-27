import { Router, type IRouter } from "express";
import healthRouter from "./health";
import asrRouter from "./asr";
import chatRouter from "./chat";
import multiAnswerRouter from "./multi-answer";

const router: IRouter = Router();

router.use(healthRouter);
router.use(asrRouter);
router.use(chatRouter);
router.use(multiAnswerRouter);

export default router;
