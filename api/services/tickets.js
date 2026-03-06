require("dotenv").config();
const { google } = require("googleapis");

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const TICKETS_SHEET  = process.env.SHEETS_TICKETS_SHEET || "Zgłoszenia";

function getAuth() {
  if (!process.env.GOOGLE_CLIENT_EMAIL) throw new Error("Brak GOOGLE_CLIENT_EMAIL");
  if (!process.env.GOOGLE_PRIVATE_KEY)  throw new Error("Brak GOOGLE_PRIVATE_KEY");
  if (!SPREADSHEET_ID)                  throw new Error("Brak SPREADSHEET_ID");
  return new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key:  process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

async function getSheetsClient() {
  return google.sheets({ version: "v4", auth: getAuth() });
}

function safeNumber(val, def = 0) {
  const n = Number(val);
  return isNaN(n) ? def : n;
}

function nowWarsawStrings() {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Warsaw",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  });
  const parts = fmt.formatToParts(now);
  const get = type => (parts.find(p => p.type === type) || {}).value || "00";
  return {
    dateStr: `${get("year")}-${get("month")}-${get("day")}`,
    timeStr: `${get("hour")}:${get("minute")}:${get("second")}`,
  };
}

function stripEmojis(status) {
  return String(status || "")
    .replace(/^[\u{1F300}-\u{1FFFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF} ]+/u, "")
    .trim();
}

function mapRow(row) {
  return {
    id:            safeNumber(row[0], 0),
    dateSubmitted: String(row[1] || ""),
    time:          String(row[2] || ""),
    login:         String(row[3] || ""),
    name:          String(row[4] || ""),
    category:      String(row[5] || ""),
    title:         String(row[6] || ""),
    description:   String(row[7] || ""),
    location:      String(row[8] || "") || "Nie podano",
    priority:      String(row[9] || ""),
    status:        stripEmojis(row[10]),
    dateResponse:  String(row[11] || ""),
    managerComment:String(row[12] || ""),
    dateStarted:   String(row[13] || ""),
    readByEmployee: row[14] === true || row[14] === "TRUE",
  };
}

// ── SUBMIT ────────────────────────────────────────────────────────────────────

async function submitTicket(login, name, category, title, description, location, priority) {
  const sheets = await getSheetsClient();

  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${TICKETS_SHEET}!A2:A`,
  });

  const rows = resp.data.values || [];
  let newId = 1;
  if (rows.length > 0) {
    const lastId = safeNumber(rows[rows.length - 1][0], 0);
    newId = lastId + 1;
  }

  const categoryIcons = { "pomysł": "💡", "problem": "⚠️", "usterka": "🔧", "pilne": "🆘" };
  const icon = categoryIcons[category] || "";
  const categoryText = icon + " " + (category.charAt(0).toUpperCase() + category.slice(1));

  const { dateStr, timeStr } = nowWarsawStrings();

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${TICKETS_SHEET}!A1`,
    valueInputOption: "RAW",
    requestBody: {
      values: [[
        newId,
        dateStr,
        timeStr,
        login,
        name,
        categoryText,
        title,
        description,
        location || "-",
        priority,
        "🆕 Nowe",
        "",
        "",
      ]],
    },
  });

  return { success: true, message: `Zgłoszenie #${newId} zostało zarejestrowane. Dziękujemy!` };
}

// ── COUNTS ────────────────────────────────────────────────────────────────────

async function getOpenTicketsCount() {
  const sheets = await getSheetsClient();
  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${TICKETS_SHEET}!K2:K`,
  });
  const rows = resp.data.values || [];
  let count = 0;
  rows.forEach(r => { if (String(r[0] || "").includes("Nowe")) count++; });
  return count;
}

async function getUnreadTicketRepliesCount(login) {
  const sheets = await getSheetsClient();
  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${TICKETS_SHEET}!A2:O`,
  });
  const rows = resp.data.values || [];
  let count = 0;
  rows.forEach(r => {
    const rowLogin       = String(r[3] || "");
    const dateOdpowiedzi = r[13]; // kolumna N
    const odczytane      = r[14]; // kolumna O
    if (rowLogin === login && dateOdpowiedzi && odczytane !== true && odczytane !== "TRUE") {
      count++;
    }
  });
  return count;
}

async function getUnreadTicketsCount(login) {
  const sheets = await getSheetsClient();
  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${TICKETS_SHEET}!A2:O`,
  });
  const rows = resp.data.values || [];
  let count = 0;
  rows.forEach(r => {
    const rowLogin  = String(r[3] || "");
    const status    = stripEmojis(r[10]);
    const odczytane = r[14];
    if (
      rowLogin === login &&
      (status.includes("W trakcie") || status.includes("Zamknięte") || status.includes("Odrzucone")) &&
      odczytane !== true && odczytane !== "TRUE"
    ) {
      count++;
    }
  });
  return count;
}

async function getCriticalTicketsCount() {
  const sheets = await getSheetsClient();
  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${TICKETS_SHEET}!J2:K`,
  });
  const rows = resp.data.values || [];
  let count = 0;
  rows.forEach(r => {
    const priority = String(r[0] || "");
    const status   = String(r[1] || "");
    if (priority === "KRYTYCZNY" && status.includes("Nowe")) count++;
  });
  return count;
}

async function getCriticalTickets() {
  const sheets = await getSheetsClient();
  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${TICKETS_SHEET}!A2:K`,
  });
  const rows = resp.data.values || [];
  const out = [];
  rows.forEach(r => {
    const priority = String(r[9] || "");
    const status   = String(r[10] || "");
    if (priority === "KRYTYCZNY" && status.includes("Nowe")) {
      out.push({
        id:       safeNumber(r[0], 0),
        date:     String(r[1] || ""),
        login:    String(r[3] || ""),
        name:     String(r[4] || ""),
        title:    String(r[6] || ""),
        location: String(r[8] || "") || "Nie podano",
      });
    }
  });
  return out;
}

// ── LIST ──────────────────────────────────────────────────────────────────────

async function getAllTickets(filterStatus) {
  const sheets = await getSheetsClient();
  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${TICKETS_SHEET}!A2:O`,
  });
  const rows = resp.data.values || [];
  const out = [];
  rows.forEach((r, i) => {
    const ticket = mapRow(r);
    if (filterStatus && filterStatus !== "all") {
      if (!ticket.status.includes(filterStatus)) return;
    }
    ticket.rowIndex = i + 2;
    out.push(ticket);
  });
  return out;
}

async function getMyTickets(userLogin) {
  const sheets = await getSheetsClient();
  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${TICKETS_SHEET}!A2:O`,
  });
  const rows = resp.data.values || [];
  const out = [];
  rows.forEach((r, i) => {
    if (String(r[3] || "") !== userLogin) return;
    const ticket = mapRow(r);
    ticket.rowIndex = i + 2;
    out.push(ticket);
  });
  out.sort((a, b) => b.id - a.id);
  return out;
}

// ── UPDATE ────────────────────────────────────────────────────────────────────

async function updateTicketStatus(ticketId, newStatus, managerComment) {
  const id = safeNumber(ticketId, 0);
  if (!id) return { success: false, message: "Brak ticketId" };

  const sheets = await getSheetsClient();
  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${TICKETS_SHEET}!A2:A`,
  });

  const rows = resp.data.values || [];
  let targetRow = -1;
  for (let i = 0; i < rows.length; i++) {
    if (safeNumber(rows[i][0], 0) === id) { targetRow = i + 2; break; }
  }
  if (targetRow === -1) return { success: false, message: `Nie znaleziono zgłoszenia #${id}` };

  const emojis = { "W trakcie": "🟡 ", "Zamknięte": "🟢 ", "Odrzucone": "🔴 " };
  const emoji   = emojis[newStatus] || "";
  const { dateStr } = nowWarsawStrings();

  const batchData = [
    { range: `${TICKETS_SHEET}!K${targetRow}`, values: [[emoji + newStatus]] },
    { range: `${TICKETS_SHEET}!L${targetRow}`, values: [[dateStr]] },
    { range: `${TICKETS_SHEET}!M${targetRow}`, values: [[managerComment || ""]] },
  ];

  if (newStatus === "Zamknięte" || newStatus === "Odrzucone") {
    batchData.push({ range: `${TICKETS_SHEET}!N${targetRow}`, values: [[dateStr]] });
    batchData.push({ range: `${TICKETS_SHEET}!O${targetRow}`, values: [[false]] });
  }

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: { valueInputOption: "RAW", data: batchData },
  });

  return { success: true, message: `Zgłoszenie #${id} - status zmieniony na: ${newStatus}` };
}

async function markTicketAsReadByEmployee(ticketId) {
  const id = safeNumber(ticketId, 0);
  if (!id) return { success: false, message: "Brak ticketId" };

  const sheets = await getSheetsClient();
  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${TICKETS_SHEET}!A2:A`,
  });

  const rows = resp.data.values || [];
  let targetRow = -1;
  for (let i = 0; i < rows.length; i++) {
    if (safeNumber(rows[i][0], 0) === id) { targetRow = i + 2; break; }
  }
  if (targetRow === -1) return { success: false, message: `Nie znaleziono zgłoszenia #${id}` };

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${TICKETS_SHEET}!O${targetRow}`,
    valueInputOption: "RAW",
    requestBody: { values: [[true]] },
  });

  return { success: true, message: `Zgłoszenie #${id} oznaczone jako przeczytane` };
}

module.exports = {
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
};
