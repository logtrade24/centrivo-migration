const PDFDocument = require('pdfkit');
const path = require('path');

const FONT_REGULAR = path.join(__dirname, '..', 'assets', 'DejaVuSans.ttf');
const FONT_BOLD    = path.join(__dirname, '..', 'assets', 'DejaVuSans-Bold.ttf');

const VACATION_TYPE_NAMES = {
  'planowany':    'Urlop wypoczynkowy (planowany)',
  'na_zadanie':   'Urlop wypoczynkowy na żądanie',
  'zaległy':      'Urlop wypoczynkowy zaległy',
  'bezpłatny':    'Urlop bezpłatny',
};

function getVacationTypeName(type) {
  return VACATION_TYPE_NAMES[type] || type || 'Urlop wypoczynkowy';
}

function todayPL() {
  return new Date().toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/**
 * Rysuje wiersz label: wartość (label bold, wartość regular)
 */
function labelRow(doc, label, value, opts = {}) {
  const y = doc.y;
  doc.font('Bold').text(label, opts.x || 50, y, { continued: true, width: opts.labelWidth || 200 });
  doc.font('Regular').text(value || '—', { width: opts.valueWidth || 300 });
}

/**
 * Rysuje poziomą linię przerywaną jako pole do podpisu
 */
function signatureLine(doc, x, y, width, caption) {
  doc.moveTo(x, y).lineTo(x + width, y).lineWidth(0.5).stroke('#333333');
  doc.font('Regular').fontSize(8).fillColor('#555555').text(caption, x, y + 3, { width });
  doc.fillColor('#000000').fontSize(10);
}

/**
 * Generuje PDF wniosku urlopowego.
 * @param {Object} data - pola wniosku
 * @returns {Promise<Buffer>} bufor PDF
 */
function generateVacationPDF(data) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 50, bottom: 50, left: 55, right: 55 },
        info: { Title: 'Wniosek urlopowy', Author: 'Centrivo' },
      });

      const chunks = [];
      doc.on('data', c => chunks.push(c));
      doc.on('end',  () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.registerFont('Regular', FONT_REGULAR);
      doc.registerFont('Bold',    FONT_BOLD);

      const PAGE_W   = doc.page.width - 110; // szerokość netto (marginesy 55+55)
      const LEFT     = 55;
      const RIGHT    = doc.page.width - 55;
      const today    = todayPL();

      const {
        name            = '',
        login           = '',
        dateFrom        = '',
        dateTo          = '',
        workingDays     = '',
        vacationType    = 'planowany',
        commentEmployee = '',
        dateSubmitted   = '',
        decision        = '',
        commentManager  = '',
        requestId       = '',
      } = data;

      // ── NAGŁÓWEK ──────────────────────────────────────────────────────────────
      doc.font('Regular').fontSize(8).fillColor('#666666')
         .text('Centrivo — system zarządzania obecnością pracowników', LEFT, 50, { align: 'right', width: PAGE_W });

      doc.moveDown(0.2);
      doc.moveTo(LEFT, doc.y).lineTo(RIGHT, doc.y).lineWidth(1).stroke('#cccccc');
      doc.moveDown(0.8);

      doc.font('Bold').fontSize(18).fillColor('#000000')
         .text('WNIOSEK URLOPOWY', LEFT, doc.y, { align: 'center', width: PAGE_W });
      doc.moveDown(0.3);
      doc.font('Regular').fontSize(10).fillColor('#444444')
         .text(getVacationTypeName(vacationType), LEFT, doc.y, { align: 'center', width: PAGE_W });
      doc.fillColor('#000000');
      doc.moveDown(0.6);
      doc.moveTo(LEFT, doc.y).lineTo(RIGHT, doc.y).lineWidth(1.5).stroke('#2c3e50');
      doc.moveDown(1);

      // ── DATA I MIEJSCE ───────────────────────────────────────────────────────
      doc.font('Regular').fontSize(10)
         .text(`Miejscowość i data złożenia:`, LEFT, doc.y, { continued: true, width: 240 });
      doc.font('Bold').text(`  ${dateSubmitted || today}`, { width: PAGE_W - 240 });
      doc.moveDown(1.2);

      // ── DANE PRACOWNIKA ──────────────────────────────────────────────────────
      const sectionY = doc.y;
      doc.font('Bold').fontSize(11).fillColor('#2c3e50')
         .text('DANE PRACOWNIKA', LEFT, sectionY);
      doc.fillColor('#000000').moveDown(0.4);

      doc.rect(LEFT, doc.y, PAGE_W, 52).fill('#f7f9fc').stroke('#dde3ea');
      const boxY = doc.y + 8;
      doc.font('Bold').fontSize(10).fillColor('#000000').text('Imię i nazwisko:', LEFT + 10, boxY);
      doc.font('Regular').text(name || '—', LEFT + 130, boxY);
      doc.font('Bold').text('Login / Nr pracownika:', LEFT + 10, boxY + 20);
      doc.font('Regular').text(login || '—', LEFT + 160, boxY + 20);
      doc.moveDown(0.2);
      doc.y = boxY + 52 + 4;
      doc.moveDown(0.8);

      // ── SZCZEGÓŁY WNIOSKU ────────────────────────────────────────────────────
      doc.font('Bold').fontSize(11).fillColor('#2c3e50')
         .text('SZCZEGÓŁY WNIOSKU', LEFT, doc.y);
      doc.fillColor('#000000').moveDown(0.4);

      const detailsY = doc.y;
      doc.rect(LEFT, detailsY, PAGE_W, commentEmployee ? 100 : 80).fill('#f7f9fc').stroke('#dde3ea');
      let dy = detailsY + 8;

      doc.font('Bold').fontSize(10).fillColor('#000000').text('Rodzaj urlopu:', LEFT + 10, dy);
      doc.font('Regular').text(getVacationTypeName(vacationType), LEFT + 130, dy);
      dy += 18;

      doc.font('Bold').text('Data od:', LEFT + 10, dy);
      doc.font('Regular').text(dateFrom || '—', LEFT + 130, dy);
      doc.font('Bold').text('Data do:', LEFT + 260, dy);
      doc.font('Regular').text(dateTo || '—', LEFT + 340, dy);
      dy += 18;

      doc.font('Bold').text('Liczba dni roboczych:', LEFT + 10, dy);
      doc.font('Regular').text(String(workingDays) || '—', LEFT + 160, dy);
      dy += 18;

      if (commentEmployee) {
        doc.font('Bold').text('Uwagi pracownika:', LEFT + 10, dy);
        doc.font('Regular').text(commentEmployee, LEFT + 130, dy, { width: PAGE_W - 140 });
        dy += 20;
      }

      doc.y = detailsY + (commentEmployee ? 104 : 84);
      doc.moveDown(1.2);

      // ── PODPIS PRACOWNIKA ────────────────────────────────────────────────────
      doc.font('Bold').fontSize(11).fillColor('#2c3e50')
         .text('PODPIS PRACOWNIKA', LEFT, doc.y);
      doc.fillColor('#000000').moveDown(0.4);
      doc.font('Regular').fontSize(10)
         .text('Składając niniejszy wniosek potwierdzam poprawność podanych danych.', LEFT);
      doc.moveDown(1.8);

      const sigY1 = doc.y;
      signatureLine(doc, LEFT, sigY1, 200, '(podpis pracownika)');
      signatureLine(doc, RIGHT - 130, sigY1, 130, '(data)');
      doc.moveDown(2);

      // ── SEPARATOR ───────────────────────────────────────────────────────────
      doc.moveTo(LEFT, doc.y).lineTo(RIGHT, doc.y).dash(3, { space: 3 }).lineWidth(0.5).stroke('#aaaaaa');
      doc.undash();
      doc.moveDown(1);

      // ── DECYZJA KIEROWNIKA ───────────────────────────────────────────────────
      doc.font('Bold').fontSize(11).fillColor('#2c3e50')
         .text('DECYZJA KIEROWNIKA', LEFT, doc.y);
      doc.fillColor('#000000').moveDown(0.4);

      const statusColor = decision === 'Zatwierdzony' ? '#27ae60'
                        : decision === 'Odrzucony'    ? '#c0392b'
                        : '#e67e22';
      const statusLabel = decision || 'Oczekujący';

      doc.font('Bold').fontSize(10).fillColor('#000000').text('Status wniosku: ', LEFT, doc.y, { continued: true });
      doc.fillColor(statusColor).font('Bold').fontSize(11).text(statusLabel);
      doc.fillColor('#000000').fontSize(10);
      doc.moveDown(0.4);

      if (commentManager) {
        doc.font('Bold').text('Komentarz kierownika: ', LEFT, doc.y, { continued: true });
        doc.font('Regular').text(commentManager);
        doc.moveDown(0.4);
      }

      doc.moveDown(1.5);
      const sigY2 = doc.y;
      signatureLine(doc, LEFT, sigY2, 200, '(podpis i pieczątka kierownika)');
      signatureLine(doc, RIGHT - 130, sigY2, 130, '(data zatwierdzenia)');
      doc.moveDown(2.5);

      // ── STOPKA ──────────────────────────────────────────────────────────────
      doc.moveTo(LEFT, doc.y).lineTo(RIGHT, doc.y).lineWidth(0.5).stroke('#cccccc');
      doc.moveDown(0.3);
      doc.font('Regular').fontSize(7).fillColor('#888888')
         .text(
           `Wygenerowano: ${today} | Nr wniosku: ${requestId || 'N/A'} | System Centrivo`,
           LEFT, doc.y, { align: 'center', width: PAGE_W }
         );

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Generuje PDF wniosku o dzień wolny.
 * @param {Object} data - pola wniosku
 * @returns {Promise<Buffer>} bufor PDF
 */
function generateDayOffPDF(data) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 50, bottom: 50, left: 55, right: 55 },
        info: { Title: 'Wniosek o dzień wolny', Author: 'Centrivo' },
      });

      const chunks = [];
      doc.on('data', c => chunks.push(c));
      doc.on('end',  () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.registerFont('Regular', FONT_REGULAR);
      doc.registerFont('Bold',    FONT_BOLD);

      const PAGE_W = doc.page.width - 110;
      const LEFT   = 55;
      const RIGHT  = doc.page.width - 55;
      const today  = todayPL();

      const {
        name           = '',
        login          = '',
        dateSubmitted  = '',
        date           = '',
        type           = '',
        timeFrom       = '',
        timeTo         = '',
        reason         = '',
        status         = '',
        managerComment = '',
        requestId      = '',
      } = data;

      // ── NAGŁÓWEK ────────────────────────────────────────────────────────────
      doc.font('Regular').fontSize(8).fillColor('#666666')
         .text('Centrivo — system zarządzania obecnością pracowników', LEFT, 50, { align: 'right', width: PAGE_W });

      doc.moveDown(0.2);
      doc.moveTo(LEFT, doc.y).lineTo(RIGHT, doc.y).lineWidth(1).stroke('#cccccc');
      doc.moveDown(0.8);

      doc.font('Bold').fontSize(18).fillColor('#000000')
         .text('WNIOSEK O DZIEŃ WOLNY', LEFT, doc.y, { align: 'center', width: PAGE_W });
      doc.moveDown(0.3);
      doc.font('Regular').fontSize(10).fillColor('#444444')
         .text(type || 'Dzień wolny', LEFT, doc.y, { align: 'center', width: PAGE_W });
      doc.fillColor('#000000');
      doc.moveDown(0.6);
      doc.moveTo(LEFT, doc.y).lineTo(RIGHT, doc.y).lineWidth(1.5).stroke('#2c3e50');
      doc.moveDown(1);

      // ── DATA ZŁOŻENIA ────────────────────────────────────────────────────────
      doc.font('Regular').fontSize(10)
         .text('Miejscowość i data złożenia:', LEFT, doc.y, { continued: true, width: 240 });
      doc.font('Bold').text(`  ${dateSubmitted || today}`, { width: PAGE_W - 240 });
      doc.moveDown(1.2);

      // ── DANE PRACOWNIKA ──────────────────────────────────────────────────────
      doc.font('Bold').fontSize(11).fillColor('#2c3e50').text('DANE PRACOWNIKA', LEFT, doc.y);
      doc.fillColor('#000000').moveDown(0.4);

      doc.rect(LEFT, doc.y, PAGE_W, 52).fill('#f7f9fc').stroke('#dde3ea');
      const boxY = doc.y + 8;
      doc.font('Bold').fontSize(10).fillColor('#000000').text('Imię i nazwisko:', LEFT + 10, boxY);
      doc.font('Regular').text(name || '—', LEFT + 130, boxY);
      doc.font('Bold').text('Login / Nr pracownika:', LEFT + 10, boxY + 20);
      doc.font('Regular').text(login || '—', LEFT + 160, boxY + 20);
      doc.y = boxY + 52 + 4;
      doc.moveDown(0.8);

      // ── SZCZEGÓŁY WNIOSKU ────────────────────────────────────────────────────
      doc.font('Bold').fontSize(11).fillColor('#2c3e50').text('SZCZEGÓŁY WNIOSKU', LEFT, doc.y);
      doc.fillColor('#000000').moveDown(0.4);

      const hasTime   = timeFrom && timeTo;
      const hasReason = !!reason;
      const boxH = 60 + (hasTime ? 18 : 0) + (hasReason ? 20 : 0);

      const detailsY = doc.y;
      doc.rect(LEFT, detailsY, PAGE_W, boxH).fill('#f7f9fc').stroke('#dde3ea');
      let dy = detailsY + 8;

      doc.font('Bold').fontSize(10).fillColor('#000000').text('Rodzaj:', LEFT + 10, dy);
      doc.font('Regular').text(type || '—', LEFT + 130, dy);
      dy += 18;

      doc.font('Bold').text('Data:', LEFT + 10, dy);
      doc.font('Regular').text(date || '—', LEFT + 130, dy);
      dy += 18;

      if (hasTime) {
        doc.font('Bold').text('Godziny:', LEFT + 10, dy);
        doc.font('Regular').text(`${timeFrom} – ${timeTo}`, LEFT + 130, dy);
        dy += 18;
      }

      if (hasReason) {
        doc.font('Bold').text('Uzasadnienie:', LEFT + 10, dy);
        doc.font('Regular').text(reason, LEFT + 130, dy, { width: PAGE_W - 140 });
        dy += 20;
      }

      doc.y = detailsY + boxH + 4;
      doc.moveDown(1.2);

      // ── PODPIS PRACOWNIKA ────────────────────────────────────────────────────
      doc.font('Bold').fontSize(11).fillColor('#2c3e50').text('PODPIS PRACOWNIKA', LEFT, doc.y);
      doc.fillColor('#000000').moveDown(0.4);
      doc.font('Regular').fontSize(10)
         .text('Składając niniejszy wniosek potwierdzam poprawność podanych danych.', LEFT);
      doc.moveDown(1.8);

      const sigY1 = doc.y;
      signatureLine(doc, LEFT, sigY1, 200, '(podpis pracownika)');
      signatureLine(doc, RIGHT - 130, sigY1, 130, '(data)');
      doc.moveDown(2);

      // ── SEPARATOR ────────────────────────────────────────────────────────────
      doc.moveTo(LEFT, doc.y).lineTo(RIGHT, doc.y).dash(3, { space: 3 }).lineWidth(0.5).stroke('#aaaaaa');
      doc.undash();
      doc.moveDown(1);

      // ── DECYZJA KIEROWNIKA ────────────────────────────────────────────────────
      doc.font('Bold').fontSize(11).fillColor('#2c3e50').text('DECYZJA KIEROWNIKA', LEFT, doc.y);
      doc.fillColor('#000000').moveDown(0.4);

      const statusColor = status === 'Zatwierdzony' ? '#27ae60'
                        : status === 'Odrzucony'    ? '#c0392b'
                        : '#e67e22';
      const statusLabel = status || 'Oczekujący';

      doc.font('Bold').fontSize(10).fillColor('#000000').text('Status wniosku: ', LEFT, doc.y, { continued: true });
      doc.fillColor(statusColor).font('Bold').fontSize(11).text(statusLabel);
      doc.fillColor('#000000').fontSize(10);
      doc.moveDown(0.4);

      if (managerComment) {
        doc.font('Bold').text('Komentarz kierownika: ', LEFT, doc.y, { continued: true });
        doc.font('Regular').text(managerComment);
        doc.moveDown(0.4);
      }

      doc.moveDown(1.5);
      const sigY2 = doc.y;
      signatureLine(doc, LEFT, sigY2, 200, '(podpis i pieczątka kierownika)');
      signatureLine(doc, RIGHT - 130, sigY2, 130, '(data zatwierdzenia)');
      doc.moveDown(2.5);

      // ── STOPKA ───────────────────────────────────────────────────────────────
      doc.moveTo(LEFT, doc.y).lineTo(RIGHT, doc.y).lineWidth(0.5).stroke('#cccccc');
      doc.moveDown(0.3);
      doc.font('Regular').fontSize(7).fillColor('#888888')
         .text(
           `Wygenerowano: ${today} | Nr wniosku: ${requestId || 'N/A'} | System Centrivo`,
           LEFT, doc.y, { align: 'center', width: PAGE_W }
         );

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Generuje PDF wniosku o urlop okolicznościowy.
 * @param {Object} data - pola wniosku
 * @returns {Promise<Buffer>} bufor PDF
 */
function generateOccasionalLeavePDF(data) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 50, bottom: 50, left: 55, right: 55 },
        info: { Title: 'Wniosek o urlop okolicznościowy', Author: 'Centrivo' },
      });

      const chunks = [];
      doc.on('data', c => chunks.push(c));
      doc.on('end',  () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.registerFont('Regular', FONT_REGULAR);
      doc.registerFont('Bold',    FONT_BOLD);

      const PAGE_W = doc.page.width - 110;
      const LEFT   = 55;
      const RIGHT  = doc.page.width - 55;
      const today  = todayPL();

      const {
        name           = '',
        login          = '',
        dateSubmitted  = '',
        dateFrom       = '',
        dateTo         = '',
        days           = '',
        type           = '',
        note           = '',
        status         = '',
        managerComment = '',
        requestId      = '',
      } = data;

      // ── NAGŁÓWEK ────────────────────────────────────────────────────────────
      doc.font('Regular').fontSize(8).fillColor('#666666')
         .text('Centrivo — system zarządzania obecnością pracowników', LEFT, 50, { align: 'right', width: PAGE_W });

      doc.moveDown(0.2);
      doc.moveTo(LEFT, doc.y).lineTo(RIGHT, doc.y).lineWidth(1).stroke('#cccccc');
      doc.moveDown(0.8);

      doc.font('Bold').fontSize(18).fillColor('#000000')
         .text('WNIOSEK O URLOP OKOLICZNOŚCIOWY', LEFT, doc.y, { align: 'center', width: PAGE_W });
      doc.moveDown(0.3);
      doc.font('Regular').fontSize(10).fillColor('#444444')
         .text(type || 'Urlop okolicznościowy', LEFT, doc.y, { align: 'center', width: PAGE_W });
      doc.fillColor('#000000');
      doc.moveDown(0.6);
      doc.moveTo(LEFT, doc.y).lineTo(RIGHT, doc.y).lineWidth(1.5).stroke('#2c3e50');
      doc.moveDown(1);

      // ── DATA ZŁOŻENIA ────────────────────────────────────────────────────────
      doc.font('Regular').fontSize(10)
         .text('Miejscowość i data złożenia:', LEFT, doc.y, { continued: true, width: 240 });
      doc.font('Bold').text(`  ${dateSubmitted || today}`, { width: PAGE_W - 240 });
      doc.moveDown(1.2);

      // ── DANE PRACOWNIKA ──────────────────────────────────────────────────────
      doc.font('Bold').fontSize(11).fillColor('#2c3e50').text('DANE PRACOWNIKA', LEFT, doc.y);
      doc.fillColor('#000000').moveDown(0.4);

      doc.rect(LEFT, doc.y, PAGE_W, 52).fill('#f7f9fc').stroke('#dde3ea');
      const boxY = doc.y + 8;
      doc.font('Bold').fontSize(10).fillColor('#000000').text('Imię i nazwisko:', LEFT + 10, boxY);
      doc.font('Regular').text(name || '—', LEFT + 130, boxY);
      doc.font('Bold').text('Login / Nr pracownika:', LEFT + 10, boxY + 20);
      doc.font('Regular').text(login || '—', LEFT + 160, boxY + 20);
      doc.y = boxY + 52 + 4;
      doc.moveDown(0.8);

      // ── SZCZEGÓŁY WNIOSKU ────────────────────────────────────────────────────
      doc.font('Bold').fontSize(11).fillColor('#2c3e50').text('SZCZEGÓŁY WNIOSKU', LEFT, doc.y);
      doc.fillColor('#000000').moveDown(0.4);

      const hasNote = !!note;
      const boxH = 80 + (hasNote ? 20 : 0);

      const detailsY = doc.y;
      doc.rect(LEFT, detailsY, PAGE_W, boxH).fill('#f7f9fc').stroke('#dde3ea');
      let dy = detailsY + 8;

      doc.font('Bold').fontSize(10).fillColor('#000000').text('Rodzaj urlopu:', LEFT + 10, dy);
      doc.font('Regular').text(type || '—', LEFT + 130, dy);
      dy += 18;

      doc.font('Bold').text('Data od:', LEFT + 10, dy);
      doc.font('Regular').text(dateFrom || '—', LEFT + 130, dy);
      doc.font('Bold').text('Data do:', LEFT + 260, dy);
      doc.font('Regular').text(dateTo || '—', LEFT + 340, dy);
      dy += 18;

      doc.font('Bold').text('Liczba dni:', LEFT + 10, dy);
      doc.font('Regular').text(String(days) || '—', LEFT + 130, dy);
      dy += 18;

      if (hasNote) {
        doc.font('Bold').text('Uwagi:', LEFT + 10, dy);
        doc.font('Regular').text(note, LEFT + 130, dy, { width: PAGE_W - 140 });
        dy += 20;
      }

      doc.y = detailsY + boxH + 4;
      doc.moveDown(1.2);

      // ── PODPIS PRACOWNIKA ────────────────────────────────────────────────────
      doc.font('Bold').fontSize(11).fillColor('#2c3e50').text('PODPIS PRACOWNIKA', LEFT, doc.y);
      doc.fillColor('#000000').moveDown(0.4);
      doc.font('Regular').fontSize(10)
         .text('Składając niniejszy wniosek potwierdzam poprawność podanych danych.', LEFT);
      doc.moveDown(1.8);

      const sigY1 = doc.y;
      signatureLine(doc, LEFT, sigY1, 200, '(podpis pracownika)');
      signatureLine(doc, RIGHT - 130, sigY1, 130, '(data)');
      doc.moveDown(2);

      // ── SEPARATOR ────────────────────────────────────────────────────────────
      doc.moveTo(LEFT, doc.y).lineTo(RIGHT, doc.y).dash(3, { space: 3 }).lineWidth(0.5).stroke('#aaaaaa');
      doc.undash();
      doc.moveDown(1);

      // ── DECYZJA KIEROWNIKA ────────────────────────────────────────────────────
      doc.font('Bold').fontSize(11).fillColor('#2c3e50').text('DECYZJA KIEROWNIKA', LEFT, doc.y);
      doc.fillColor('#000000').moveDown(0.4);

      const statusColor = status === 'Zatwierdzony' ? '#27ae60'
                        : status === 'Odrzucony'    ? '#c0392b'
                        : '#e67e22';
      const statusLabel = status || 'Oczekujący';

      doc.font('Bold').fontSize(10).fillColor('#000000').text('Status wniosku: ', LEFT, doc.y, { continued: true });
      doc.fillColor(statusColor).font('Bold').fontSize(11).text(statusLabel);
      doc.fillColor('#000000').fontSize(10);
      doc.moveDown(0.4);

      if (managerComment) {
        doc.font('Bold').text('Komentarz kierownika: ', LEFT, doc.y, { continued: true });
        doc.font('Regular').text(managerComment);
        doc.moveDown(0.4);
      }

      doc.moveDown(1.5);
      const sigY2 = doc.y;
      signatureLine(doc, LEFT, sigY2, 200, '(podpis i pieczątka kierownika)');
      signatureLine(doc, RIGHT - 130, sigY2, 130, '(data zatwierdzenia)');
      doc.moveDown(2.5);

      // ── STOPKA ───────────────────────────────────────────────────────────────
      doc.moveTo(LEFT, doc.y).lineTo(RIGHT, doc.y).lineWidth(0.5).stroke('#cccccc');
      doc.moveDown(0.3);
      doc.font('Regular').fontSize(7).fillColor('#888888')
         .text(
           `Wygenerowano: ${today} | Nr wniosku: ${requestId || 'N/A'} | System Centrivo`,
           LEFT, doc.y, { align: 'center', width: PAGE_W }
         );

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { generateVacationPDF, generateDayOffPDF, generateOccasionalLeavePDF };
