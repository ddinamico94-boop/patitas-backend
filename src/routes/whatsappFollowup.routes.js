const { Router } = require("express");
const ctrl = require("../controllers/whatsappFollowup.controller");
const { requireBotSecret } = require("../middleware/botAuth");

const router = Router();

router.use(requireBotSecret);

router.get("/pending", ctrl.pending);
router.post("/reserve", ctrl.reserve);
router.post("/unsubscribe", ctrl.unsubscribe);
router.post("/sent", ctrl.sent);
router.post("/release", ctrl.release);

module.exports = router;

