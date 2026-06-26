import { Router, type IRouter } from "express";
import healthRouter from "./health";
import asrRouter from "./asr";

const router: IRouter = Router();

router.use(healthRouter);
router.use(asrRouter);

export default router;
