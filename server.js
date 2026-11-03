const express = require("express");
const app = express();

const ESP_KEY = process.env.ESP_KEY || "esp-secret";    // clé de l'ESP32
const USER_KEY = process.env.USER_KEY || "user-secret"; // mot de passe de la page

const state = { toEsp: [], fromEsp: [], capture: false, photo: null, photoTime: 0 };

app.use(express.json());
app.use(express.static("public"));

const espAuth = (req, res, next) =>
  req.headers["x-api-key"] === ESP_KEY ? next() : res.sendStatus(401);
const userAuth = (req, res, next) =>
  req.headers["x-user-key"] === USER_KEY ? next() : res.sendStatus(401);
app.get("/api/check", userAuth, (req, res) => res.json({ ok: true }));
// ---------- Navigateur -> serveur ----------
app.post("/api/send", userAuth, (req, res) => {
  const msg = String(req.body.msg || "").replace(/[\r\n]+/g, " ").slice(0, 300);
  if (msg) state.toEsp.push(msg);
  res.json({ ok: true });
});

app.post("/api/capture", userAuth, (req, res) => {
  state.capture = true;
  res.json({ ok: true });
});

app.get("/api/messages", userAuth, (req, res) => {
  const m = state.fromEsp;
  state.fromEsp = [];
  res.json(m);
});

app.get("/api/photo-time", userAuth, (req, res) => res.json({ t: state.photoTime }));

app.get("/api/photo", userAuth, (req, res) => {
  if (!state.photo) return res.sendStatus(404);
  res.set("Cache-Control", "no-store").type("image/jpeg").send(state.photo);
});

// ---------- ESP32 -> serveur ----------
// Réponse : 1ère ligne = "1" si photo demandée, puis un message par ligne
app.get("/api/esp/poll", espAuth, (req, res) => {
  const out = (state.capture ? "1" : "0") + "\n" + state.toEsp.join("\n");
  state.capture = false;
  state.toEsp = [];
  res.type("text/plain").send(out);
});

app.post("/api/esp/message", espAuth, express.text({ limit: "10kb" }), (req, res) => {
  state.fromEsp.push(String(req.body).slice(0, 300));
  res.sendStatus(200);
});

app.post("/api/esp/photo", espAuth, express.raw({ type: "image/jpeg", limit: "3mb" }), (req, res) => {
  state.photo = req.body;
  state.photoTime = Date.now();
  res.sendStatus(200);
});

app.listen(process.env.PORT || 3000, () => console.log("Serveur démarré"));
