const PDFDocument = require('pdfkit');
const { formatDisplay } = require('../utils/datetime');

function formatWhen(value) {
  return formatDisplay(value);
}

function cardLabel(doc, text, x, y, width, color) {
  doc.font('Helvetica').fontSize(8).fillColor(color)
    .text(String(text).toUpperCase(), x, y, { width, align: 'center', characterSpacing: 1.2 });
}

function field(doc, label, value, x, y, width) {
  doc.font('Helvetica').fontSize(8).fillColor('#6b7280').text(label, x, y, { width });
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#1f2937')
    .text(String(value ?? '—'), x, y + 11, { width });
  return y + 32;
}


function buildPassPdf(pass) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const pageW = doc.page.width;
    const left = doc.page.margins.left;
    const contentW = pageW - doc.page.margins.left - doc.page.margins.right;


    const titleColor = '#1e3a5f';
    const eventFill = '#e8f2f7';
    const eventStroke = '#b7d3e3';
    const eventAccent = '#3d6f8c';
    const memberFill = '#f3eee8';
    const memberStroke = '#dccfc2';
    const memberAccent = '#8a6d55';
    const qrFill = '#eef0f7';
    const qrStroke = '#c9cee0';
    const qrAccent = '#5c6490';


    doc.rect(0, 0, pageW, 6).fill(titleColor);


    doc.moveDown(1.4);
    doc.font('Helvetica-Bold').fontSize(26).fillColor(titleColor)
      .text('EVENT PASS', left, doc.y, { width: contentW, align: 'center' });
    doc.moveDown(0.25);
    doc.font('Helvetica-Oblique').fontSize(11).fillColor('#6b7280')
      .text('Entry Confirmation', left, doc.y, { width: contentW, align: 'center' });
    doc.moveDown(0.35);
    doc.font('Helvetica').fontSize(9).fillColor('#9ca3af')
      .text(`Registration No. REG-${pass.registrationId}`, left, doc.y, {
        width: contentW,
        align: 'center',
      });

    doc.moveDown(1.1);


    const gap = 14;
    const cardW = (contentW - gap * 2) / 3;
    const cardH = cardW;
    const cardsY = doc.y;
    const pad = 14;

    const eventX = left;
    const memberX = left + cardW + gap;
    const qrX = left + (cardW + gap) * 2;


    doc.roundedRect(eventX, cardsY, cardW, cardH, 10).fillAndStroke(eventFill, eventStroke);
    cardLabel(doc, 'Event', eventX + pad, cardsY + 14, cardW - pad * 2, eventAccent);

    let ey = cardsY + 36;
    doc.font('Helvetica-Bold').fontSize(13).fillColor('#1f2937')
      .text(pass.eventTitle || 'Event', eventX + pad, ey, {
        width: cardW - pad * 2,
        align: 'center',
      });
    ey = doc.y + 6;
    doc.font('Helvetica').fontSize(9).fillColor('#6b7280')
      .text(pass.eventVenue || 'Venue TBA', eventX + pad, ey, {
        width: cardW - pad * 2,
        align: 'center',
      });
    ey = doc.y + 16;
    ey = field(doc, 'Starts', formatWhen(pass.eventStartsAt), eventX + pad, ey, cardW - pad * 2);
    ey = field(doc, 'Ends', formatWhen(pass.eventEndsAt), eventX + pad, ey, cardW - pad * 2);


    doc.roundedRect(memberX, cardsY, cardW, cardH, 10).fillAndStroke(memberFill, memberStroke);
    cardLabel(doc, 'Member', memberX + pad, cardsY + 14, cardW - pad * 2, memberAccent);

    let my = cardsY + 36;
    doc.font('Helvetica-Bold').fontSize(13).fillColor('#1f2937')
      .text(pass.memberName || 'Member', memberX + pad, my, {
        width: cardW - pad * 2,
        align: 'center',
      });
    my = doc.y + 6;
    doc.font('Helvetica').fontSize(9).fillColor('#6b7280')
      .text(pass.memberEmail || '—', memberX + pad, my, {
        width: cardW - pad * 2,
        align: 'center',
      });
    my = doc.y + 16;
    my = field(
      doc,
      'Registration',
      pass.registrationStatus || '—',
      memberX + pad,
      my,
      cardW - pad * 2
    );
    if (Number(pass.addonCount) > 0) {
      my = field(
        doc,
        'Add-ons',
        String(pass.addonCount),
        memberX + pad,
        my,
        cardW - pad * 2
      );
    }


    doc.roundedRect(qrX, cardsY, cardW, cardH, 10).fillAndStroke(qrFill, qrStroke);
    cardLabel(doc, 'Entry QR', qrX + pad, cardsY + 14, cardW - pad * 2, qrAccent);

    const base64 = (pass.qrDataUrl || '').split(',')[1];
    if (base64) {
      const img = Buffer.from(base64, 'base64');
      const maxImg = Math.min(cardW - pad * 2, cardH - 48);
      const imgSize = Math.min(120, maxImg);
      const imgX = qrX + (cardW - imgSize) / 2;
      const imgY = cardsY + 40 + (cardH - 56 - imgSize) / 2;
      doc.image(img, imgX, imgY, { width: imgSize, height: imgSize });
    }


    doc.y = cardsY + cardH + 28;


    doc.font('Helvetica-Bold').fontSize(10).fillColor(titleColor)
      .text('NOTES', left, doc.y, { width: contentW, align: 'left', characterSpacing: 1 });
    doc.moveDown(0.5);
    const addonNote = Number(pass.addonCount) > 0
      ? ` Add-ons: ${pass.addonCount}.`
      : '';
    doc.font('Helvetica').fontSize(10).fillColor('#374151')
      .text(
        `Show this QR at the gate.${addonNote} Do not share this pass publicly.`,
        left,
        doc.y,
        { width: contentW }
      );
    doc.moveDown(0.35);
    doc.font('Helvetica-Oblique').fontSize(10).fillColor('#4b5563')
      .text(
        `QR is valid only between ${formatWhen(pass.doorsOpenAt)} and ${formatWhen(pass.doorsCloseAt)}.`,
        left,
        doc.y,
        { width: contentW }
      );

    doc.moveDown(1.4);
    doc.font('Helvetica').fontSize(9).fillColor('#9ca3af')
      .text('Thank you for being part of iShip.', left, doc.y, {
        width: contentW,
        align: 'center',
      });

    doc.rect(0, doc.page.height - 6, pageW, 6).fill(titleColor);

    doc.end();
  });
}


function buildAttendancePdf({ event, rows }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40, layout: 'landscape' });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const pageW = doc.page.width;
    const left = doc.page.margins.left;
    const contentW = pageW - doc.page.margins.left - doc.page.margins.right;
    const titleColor = '#1e3a5f';

    doc.rect(0, 0, pageW, 6).fill(titleColor);

    doc.moveDown(1);
    doc.font('Helvetica-Bold').fontSize(22).fillColor(titleColor)
      .text('ATTENDANCE', left, doc.y, { width: contentW, align: 'center' });
    doc.moveDown(0.3);
    doc.font('Helvetica-Bold').fontSize(14).fillColor('#1f2937')
      .text(event.title || 'Event', left, doc.y, { width: contentW, align: 'center' });
    doc.moveDown(0.25);
    doc.font('Helvetica').fontSize(10).fillColor('#6b7280')
      .text(
        `${event.venue || 'Venue TBA'}  ·  Starts ${formatWhen(event.starts_at)}`,
        left,
        doc.y,
        { width: contentW, align: 'center' }
      );
    doc.moveDown(0.2);
    doc.font('Helvetica').fontSize(9).fillColor('#9ca3af')
      .text(`Generated ${formatWhen(new Date())}  ·  ${rows.length} registration(s)`, {
        width: contentW,
        align: 'center',
      });

    doc.moveDown(1);


    const cols = [
      { key: 'full_name', label: 'Name', w: 0.20 },
      { key: 'email', label: 'Email', w: 0.24 },
      { key: 'registration_status', label: 'Reg status', w: 0.14 },
      { key: 'addon_count', label: 'Add-ons', w: 0.10 },
      { key: 'qr_status', label: 'QR', w: 0.10 },
      { key: 'checked_in_at', label: 'Checked in', w: 0.22 },
    ];

    let x = left;
    cols.forEach((c) => {
      c.x = x;
      c.width = contentW * c.w;
      x += c.width;
    });

    const drawHeader = (y) => {
      doc.rect(left, y - 4, contentW, 22).fill('#e8f2f7');
      doc.font('Helvetica-Bold').fontSize(9).fillColor(titleColor);
      cols.forEach((c) => {
        doc.text(c.label, c.x + 4, y, { width: c.width - 8, align: 'left' });
      });
      return y + 22;
    };

    let y = drawHeader(doc.y);

    const rowH = 20;
    const bottomLimit = doc.page.height - 40;

    if (!rows.length) {
      doc.font('Helvetica-Oblique').fontSize(11).fillColor('#6b7280')
        .text('No registrations for this event.', left, y + 10, { width: contentW });
    } else {
      rows.forEach((row, i) => {
        if (y + rowH > bottomLimit) {
          doc.addPage({ size: 'A4', layout: 'landscape', margin: 40 });
          y = drawHeader(50);
        }

        if (i % 2 === 1) {
          doc.rect(left, y - 4, contentW, rowH).fill('#f8fafc');
        }

        doc.font('Helvetica').fontSize(8).fillColor('#1f2937');
        cols.forEach((c) => {
          let value = row[c.key];
          if (c.key === 'checked_in_at') value = formatWhen(value);
          if (value == null || value === '') value = '—';
          doc.fillColor('#1f2937').text(String(value), c.x + 4, y, {
            width: c.width - 8,
            align: 'left',
            ellipsis: true,
          });
        });
        y += rowH;
      });
    }


    const checkedIn = rows.filter((r) => r.registration_status === 'CHECKED_IN').length;
    const paid = rows.filter((r) => r.registration_status === 'PAID').length;
    const cancelled = rows.filter((r) => r.registration_status === 'CANCELLED').length;
    doc.font('Helvetica').fontSize(9).fillColor('#6b7280')
      .text(
        `Checked in: ${checkedIn}  ·  Paid (not checked in): ${paid}  ·  Cancelled: ${cancelled}  ·  Total rows: ${rows.length}`,
        left,
        doc.page.height - 30,
        { width: contentW, align: 'center' }
      );

    doc.rect(0, doc.page.height - 6, pageW, 6).fill(titleColor);
    doc.end();
  });
}

module.exports = {
  buildPassPdf,
  buildAttendancePdf,
};