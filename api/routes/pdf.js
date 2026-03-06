const express = require('express');
const router  = express.Router();
const { generateVacationPDF, generateDayOffPDF, generateOccasionalLeavePDF } = require('../services/pdf');

function isManager(loginRaw) {
  const login    = String(loginRaw || '').trim().toLowerCase();
  const managers = String(process.env.MANAGER_LOGINS || 'jerzyd')
    .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  return managers.includes(login);
}

// POST /pdf/vacation
// Body: { login, requestData: { name, login, dateFrom, dateTo, workingDays,
//           vacationType, commentEmployee, dateSubmitted,
//           decision?, commentManager?, requestId? } }
router.post('/vacation', async (req, res) => {
  try {
    const login       = String(req.body?.login || '').trim().toLowerCase();
    const requestData = req.body?.requestData || {};

    if (!login) {
      return res.status(400).json({ success: false, message: 'Brak login' });
    }

    // Pracownik może pobrać swój wniosek, kierownik — każdy
    const ownerLogin = String(requestData.login || '').trim().toLowerCase();
    if (ownerLogin !== login && !isManager(login)) {
      return res.status(403).json({ success: false, message: 'Brak uprawnień' });
    }

    const pdf = await generateVacationPDF(requestData);

    const safeName  = (requestData.login || 'pracownik').replace(/[^a-z0-9]/gi, '_');
    const safeDate  = (requestData.dateFrom || '').replace(/[^0-9\-]/g, '');
    const filename  = `wniosek-urlopowy-${safeName}-${safeDate}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdf.length);
    res.send(pdf);
  } catch (err) {
    console.error('PDF /vacation ERROR:', err);
    res.status(500).json({ success: false, message: 'Błąd generowania PDF' });
  }
});

// POST /pdf/dayoff
// Body: { login, requestData: { name, login, date, type, timeFrom?, timeTo?, reason?,
//           dateSubmitted, status?, managerComment?, requestId? } }
router.post('/dayoff', async (req, res) => {
  try {
    const login       = String(req.body?.login || '').trim().toLowerCase();
    const requestData = req.body?.requestData || {};

    if (!login) {
      return res.status(400).json({ success: false, message: 'Brak login' });
    }

    const ownerLogin = String(requestData.login || '').trim().toLowerCase();
    if (ownerLogin !== login && !isManager(login)) {
      return res.status(403).json({ success: false, message: 'Brak uprawnień' });
    }

    const pdf = await generateDayOffPDF(requestData);

    const safeName = (requestData.login || 'pracownik').replace(/[^a-z0-9]/gi, '_');
    const safeDate = (requestData.date || '').replace(/[^0-9\-]/g, '');
    const filename = `wniosek-dzien-wolny-${safeName}-${safeDate}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdf.length);
    res.send(pdf);
  } catch (err) {
    console.error('PDF /dayoff ERROR:', err);
    res.status(500).json({ success: false, message: 'Błąd generowania PDF' });
  }
});

// POST /pdf/occasional
// Body: { login, requestData: { name, login, dateFrom, dateTo, days, type,
//           note?, dateSubmitted, status?, managerComment?, requestId? } }
router.post('/occasional', async (req, res) => {
  try {
    const login       = String(req.body?.login || '').trim().toLowerCase();
    const requestData = req.body?.requestData || {};

    if (!login) {
      return res.status(400).json({ success: false, message: 'Brak login' });
    }

    const ownerLogin = String(requestData.login || '').trim().toLowerCase();
    if (ownerLogin !== login && !isManager(login)) {
      return res.status(403).json({ success: false, message: 'Brak uprawnień' });
    }

    const pdf = await generateOccasionalLeavePDF(requestData);

    const safeName = (requestData.login || 'pracownik').replace(/[^a-z0-9]/gi, '_');
    const safeDate = (requestData.dateFrom || '').replace(/[^0-9\-]/g, '');
    const filename = `wniosek-okolicznosciowy-${safeName}-${safeDate}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdf.length);
    res.send(pdf);
  } catch (err) {
    console.error('PDF /occasional ERROR:', err);
    res.status(500).json({ success: false, message: 'Błąd generowania PDF' });
  }
});

module.exports = router;
