import { Router, type IRouter } from "express";
import healthRouter from "./health";
import asrRouter from "./asr";
import chatRouter from "./chat";
import multiAnswerRouter from "./multi-answer";
import conversationsRouter from "./conversations";

const router: IRouter = Router();

router.use(healthRouter);
router.use(asrRouter);
router.use(chatRouter);
router.use(multiAnswerRouter);
router.use(conversationsRouter);

export default router;
