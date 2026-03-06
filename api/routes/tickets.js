const express = require("express");
const router  = express.Router();
const {
  submitTicket,
  getOpenTicketsCount,
  getUnreadTicketRepliesCount,
  getUnreadTicketsCount,
  getCriticalTicketsCount,
  getCriticalTickets,
  getAllTickets,
  getMyTickets,
  updateTicketStatus,
  markTicketAsReadByEmployee,
} = require("../services/tickets");

function isManager(loginRaw) {
  const login    = String(loginRaw || "").trim().toLowerCase();
  const managers = String(process.env.MANAGER_LOGINS || "jerzyd")
    .split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
  return managers.includes(login);
}

// POST /tickets/submit
// Body: { login, name, category, title, description, location?, priority }
router.post("/submit", async (req, res) => {
  try {
    const login       = String(req.body?.login       || "").trim();
    const name        = String(req.body?.name        || "").trim();
    const category    = String(req.body?.category    || "").trim();
    const title       = String(req.body?.title       || "").trim();
    const description = String(req.body?.description || "").trim();
    const location    = String(req.body?.location    || "").trim();
    const priority    = String(req.body?.priority    || "").trim();

    if (!login || !title || !description) {
      return res.status(400).json({ success: false, message: "Brak wymaganych pól (login, title, description)" });
    }

    const result = await submitTicket(login, name, category, title, description, location, priority);
    return res.json(result);
  } catch (e) {
    console.error("TICKETS /submit ERROR:", e);
    return res.status(500).json({ success: false, message: e.message || "Błąd serwera" });
  }
});

// POST /tickets/open-count
// Body: {}  → { count }
router.post("/open-count", async (req, res) => {
  try {
    const count = await getOpenTicketsCount();
    return res.json({ success: true, count });
  } catch (e) {
    console.error("TICKETS /open-count ERROR:", e);
    return res.status(500).json({ success: false, message: e.message || "Błąd serwera" });
  }
});

// POST /tickets/unread-replies
// Body: { login }  → { count }  — ile odpowiedzi kierownika pracownik jeszcze nie przeczytał
router.post("/unread-replies", async (req, res) => {
  try {
    const login = String(req.body?.login || "").trim();
    if (!login) return res.status(400).json({ success: false, message: "Brak login" });
    const count = await getUnreadTicketRepliesCount(login);
    return res.json({ success: true, count });
  } catch (e) {
    console.error("TICKETS /unread-replies ERROR:", e);
    return res.status(500).json({ success: false, message: e.message || "Błąd serwera" });
  }
});

// POST /tickets/unread-count
// Body: { login }  → { count }  — ile ticketów pracownika ma akcję kierownika i nie jest przeczytane
router.post("/unread-count", async (req, res) => {
  try {
    const login = String(req.body?.login || "").trim();
    if (!login) return res.status(400).json({ success: false, message: "Brak login" });
    const count = await getUnreadTicketsCount(login);
    return res.json({ success: true, count });
  } catch (e) {
    console.error("TICKETS /unread-count ERROR:", e);
    return res.status(500).json({ success: false, message: e.message || "Błąd serwera" });
  }
});

// POST /tickets/critical-count
// Body: { login }  (manager only)  → { count }
router.post("/critical-count", async (req, res) => {
  try {
    const login = String(req.body?.login || "").trim().toLowerCase();
    if (!login) return res.status(400).json({ success: false, message: "Brak login" });
    if (!isManager(login)) return res.status(403).json({ success: false, message: "Brak uprawnień" });
    const count = await getCriticalTicketsCount();
    return res.json({ success: true, count });
  } catch (e) {
    console.error("TICKETS /critical-count ERROR:", e);
    return res.status(500).json({ success: false, message: e.message || "Błąd serwera" });
  }
});

// POST /tickets/critical
// Body: { login }  (manager only)  → { tickets }
router.post("/critical", async (req, res) => {
  try {
    const login = String(req.body?.login || "").trim().toLowerCase();
    if (!login) return res.status(400).json({ success: false, message: "Brak login" });
    if (!isManager(login)) return res.status(403).json({ success: false, message: "Brak uprawnień" });
    const tickets = await getCriticalTickets();
    return res.json({ success: true, tickets });
  } catch (e) {
    console.error("TICKETS /critical ERROR:", e);
    return res.status(500).json({ success: false, message: e.message || "Błąd serwera" });
  }
});

// POST /tickets/all
// Body: { login, filter? }  (manager only)  → { tickets }
router.post("/all", async (req, res) => {
  try {
    const login  = String(req.body?.login  || "").trim().toLowerCase();
    const filter = String(req.body?.filter || "all").trim();
    if (!login) return res.status(400).json({ success: false, message: "Brak login" });
    if (!isManager(login)) return res.status(403).json({ success: false, message: "Brak uprawnień" });
    const tickets = await getAllTickets(filter);
    return res.json({ success: true, tickets });
  } catch (e) {
    console.error("TICKETS /all ERROR:", e);
    return res.status(500).json({ success: false, message: e.message || "Błąd serwera" });
  }
});

// POST /tickets/my
// Body: { login }  → { tickets }
router.post("/my", async (req, res) => {
  try {
    const login = String(req.body?.login || "").trim();
    if (!login) return res.status(400).json({ success: false, message: "Brak login" });
    const tickets = await getMyTickets(login);
    return res.json({ success: true, tickets });
  } catch (e) {
    console.error("TICKETS /my ERROR:", e);
    return res.status(500).json({ success: false, message: e.message || "Błąd serwera" });
  }
});

// POST /tickets/update-status
// Body: { login, ticketId, newStatus, comment? }  (manager only)
router.post("/update-status", async (req, res) => {
  try {
    const login     = String(req.body?.login     || "").trim().toLowerCase();
    const ticketId  = Number(req.body?.ticketId  || 0);
    const newStatus = String(req.body?.newStatus || "").trim();
    const comment   = String(req.body?.comment   || "").trim();

    if (!login) return res.status(400).json({ success: false, message: "Brak login" });
    if (!isManager(login)) return res.status(403).json({ success: false, message: "Brak uprawnień" });
    if (!ticketId) return res.status(400).json({ success: false, message: "Brak ticketId" });
    if (!["W trakcie", "Zamknięte", "Odrzucone"].includes(newStatus)) {
      return res.status(400).json({ success: false, message: "Zły status (W trakcie / Zamknięte / Odrzucone)" });
    }

    const result = await updateTicketStatus(ticketId, newStatus, comment);
    if (!result?.success) return res.status(400).json(result);
    return res.json(result);
  } catch (e) {
    console.error("TICKETS /update-status ERROR:", e);
    return res.status(500).json({ success: false, message: e.message || "Błąd serwera" });
  }
});

// POST /tickets/mark-read
// Body: { login, ticketId }
router.post("/mark-read", async (req, res) => {
  try {
    const login    = String(req.body?.login    || "").trim();
    const ticketId = Number(req.body?.ticketId || 0);
    if (!login)    return res.status(400).json({ success: false, message: "Brak login" });
    if (!ticketId) return res.status(400).json({ success: false, message: "Brak ticketId" });

    const result = await markTicketAsReadByEmployee(ticketId);
    if (!result?.success) return res.status(400).json(result);
    return res.json(result);
  } catch (e) {
    console.error("TICKETS /mark-read ERROR:", e);
    return res.status(500).json({ success: false, message: e.message || "Błąd serwera" });
  }
});

module.exports = router;
