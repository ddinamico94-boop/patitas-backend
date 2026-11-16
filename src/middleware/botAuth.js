function requireBotSecret(req, res, next) {
  const secret = process.env.PATITAS_BOT_SECRET;
  const providedSecret = req.headers["x-bot-secret"];

  if (!secret || !providedSecret || providedSecret !== secret) {
    return res.status(401).json({
      error: "No autorizado.",
    });
  }

  next();
}

module.exports = { requireBotSecret };
