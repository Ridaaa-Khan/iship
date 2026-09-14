const nodemailer = require('nodemailer');
const env = require('../config/env');
const { log, logError } = require('../utils/logger');
const qrService = require('./qr');
const pdfService = require('./pdf');
const pool = require('../config/db');
const { formatDisplay } = require('../utils/datetime');

let cachedTransport = null;

function formatDate(value) {
  return formatDisplay(value);
}

function formatTime(value) {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function wrapEmailHtml(heroTitle, bodyHtml) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet" />
</head>
<body style="margin:0;padding:0;background:#ffffff;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#ffffff;">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" width="700" cellspacing="0" cellpadding="0" style="width:700px;max-width:100%;border-collapse:collapse;">
          <tr>
            <td style="background:#f9f9fb;border-radius:8px;padding:10px;text-align:center;font-family:Inter,Helvetica,Arial,sans-serif;font-size:13px;color:#040b22;">
              iShip Club
            </td>
          </tr>
          <tr>
            <td style="height:16px;font-size:0;line-height:0;">&nbsp;</td>
          </tr>
          <tr>
            <td style="background:#040b22;border-radius:12px;padding:48px 24px;text-align:center;">
              <h1 style="margin:0;font-family:Inter,Helvetica,Arial,sans-serif;font-size:28px;font-weight:600;letter-spacing:-0.5px;line-height:1.25;color:#ffffff;">
                ${heroTitle}
              </h1>
            </td>
          </tr>
          <tr>
            <td style="background:#ffffff;padding:32px 28px;font-family:Inter,Helvetica,Arial,sans-serif;font-size:16px;line-height:1.6;color:#040b22;">
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:24px;text-align:center;font-family:Inter,Helvetica,Arial,sans-serif;font-size:12px;color:#6b7280;">
              © iShip
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

async function getTransport() {
  if (cachedTransport) return cachedTransport;

  if (env.email.host && env.email.user) {
    cachedTransport = nodemailer.createTransport({
      host: env.email.host,
      port: env.email.port,
      secure: env.email.port === 465,
      auth: {
        user: env.email.user,
        pass: env.email.pass,
      },
    });
    return cachedTransport;
  }

  if (env.nodeEnv === 'production') {
    throw new Error('SMTP is not configured.');
  }

  const testAccount = await nodemailer.createTestAccount();
  cachedTransport = nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false,
    auth: {
      user: testAccount.user,
      pass: testAccount.pass,
    },
  });
  log('Email using Ethereal test account', testAccount.user);
  return cachedTransport;
}

async function findPassOwner(registrationId) {
  const [rows] = await pool.execute(
    `SELECT r.id AS registration_id, m.user_id, u.email, m.full_name
     FROM event_registrations r
     INNER JOIN member_profiles m ON m.id = r.member_id
     INNER JOIN users u ON u.id = m.user_id
     WHERE r.id = :registrationId
     LIMIT 1`,
    { registrationId }
  );
  return rows[0] || null;
}

async function sendPassPdfEmail(registrationId) {
  try {
    const owner = await findPassOwner(registrationId);
    if (!owner || !owner.email) {
      log('Pass email skipped: no owner email', registrationId);
      return;
    }

    const pass = await qrService.getPassForMember(
      registrationId,
      owner.user_id
    );
    const pdfBuffer = await pdfService.buildPassPdf(pass);

    const userName = owner.full_name || 'there';
    const eventName = pass.eventTitle || 'the event';
    const eventDate = formatDate(pass.eventStartsAt);
    const eventTime = formatTime(pass.eventStartsAt);
    const eventVenue = pass.eventVenue || 'TBA';
    const addonCount = Number(pass.addonCount || 0);
    const partySize = Number(pass.partySize || 1 + addonCount);
    const addonText = addonCount > 0
      ? `Add-ons: ${addonCount} (up to ${partySize} people may enter with your pass)\n`
      : '';
    const addonHtml = addonCount > 0
      ? `<li><strong>Add-ons:</strong> ${addonCount} (up to ${partySize} people may enter with your pass)</li>`
      : '';

    const text =
      `Hi ${userName},\n\n` +
      `You're officially registered for ${eventName}!\n\n` +
      `We're looking forward to having you at the event.\n\n` +
      `Your QR entry pass is attached to this email as a PDF. Please keep it handy and present the QR code at the entry gate when you arrive.\n\n` +
      `Event Details\n` +
      `Event: ${eventName}\n` +
      `Date: ${eventDate}\n` +
      `Time: ${eventTime}\n` +
      `Venue: ${eventVenue}\n` +
      addonText +
      `\n` +
      `Important\n` +
      `Your QR code is your entry pass. Please do not share it with anyone, as it is uniquely assigned to your registration.\n\n` +
      `We recommend downloading the attached PDF before arriving so you can access your QR code easily, even without an internet connection.\n\n` +
      `See you at the event!\n\n` +
      `Iship\n`;

    const html = wrapEmailHtml(
      'You&#39;re registered!',
      `
        <p>Hi ${escapeHtml(userName)},</p>
        <p>You're officially registered for <strong>${escapeHtml(eventName)}</strong>! 🎉</p>
        <p>We're looking forward to having you at the event.</p>
        <p>Your <strong>QR entry pass</strong> is attached to this email as a PDF. Please keep it handy and present the QR code at the entry gate when you arrive.</p>
        <p><strong>Event Details</strong></p>
        <ul>
          <li><strong>Event:</strong> ${escapeHtml(eventName)}</li>
          <li><strong>Date:</strong> ${escapeHtml(eventDate)}</li>
          <li><strong>Time:</strong> ${escapeHtml(eventTime)}</li>
          <li><strong>Venue:</strong> ${escapeHtml(eventVenue)}</li>
          ${addonHtml}
        </ul>
        <p><strong>Important</strong></p>
        <p>Your QR code is your entry pass. Please do not share it with anyone, as it is uniquely assigned to your registration.</p>
        <p>We recommend downloading the attached PDF before arriving so you can access your QR code easily, even without an internet connection.</p>
        <p>See you at the event!</p>
        <p><strong>Iship</strong></p>
      `
    );

    const transport = await getTransport();
    const info = await transport.sendMail({
      from: env.email.from,
      to: owner.email,
      subject: `You're registered — ${eventName}`,
      text,
      html,
      attachments: [
        {
          filename: `iship-pass-${registrationId}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
      ],
    });

    const preview = nodemailer.getTestMessageUrl(info);
    if (preview) log('Pass email preview URL', preview);
    else log('Pass email sent', owner.email);
  } catch (err) {
    logError('Pass email failed', err.message || err);
  }
}

async function sendCheckInAlertEmail({
  toEmail,
  memberName,
  eventTitle,
  eventVenue,
  eventStartsAt,
  deviceLabel,
}) {
  try {
    if (!toEmail) return;

    const userName = memberName || 'there';
    const eventName = eventTitle || 'the event';
    const eventDate = formatDate(eventStartsAt);
    const venue = eventVenue || 'TBA';

    const text =
      `Hi ${userName},\n\n` +
      `Welcome to ${eventName}!\n\n` +
      `Your entry QR code has been successfully scanned, and your attendance has been confirmed.\n\n` +
      `We're glad to have you with us. Sit back, enjoy the event, meet new people, and most importantly — have a great time!\n\n` +
      `Event: ${eventName}\n` +
      `Venue: ${venue}\n` +
      `Date: ${eventDate}\n\n` +
      `We hope you have an amazing experience!\n\n` +
      `If you did not attend this event or believe this entry was recorded incorrectly, please report it to admin@iship.local.\n\n` +
      `See you around!\n\n` +
      `Iship\n`;

    const html = wrapEmailHtml(
      'Welcome!',
      `
        <p>Hi ${escapeHtml(userName)},</p>
        <p><strong>Welcome to ${escapeHtml(eventName)}! 🎉</strong></p>
        <p>Your entry QR code has been successfully scanned, and your attendance has been confirmed.</p>
        <p>We're glad to have you with us. Sit back, enjoy the event, meet new people, and most importantly — <strong>have a great time!</strong></p>
        <p>
          <strong>Event:</strong> ${escapeHtml(eventName)}<br/>
          <strong>Venue:</strong> ${escapeHtml(venue)}<br/>
          <strong>Date:</strong> ${escapeHtml(eventDate)}
        </p>
        <p>We hope you have an amazing experience!</p>
        <p>If you did not attend this event or believe this entry was recorded incorrectly, please report it to
          <a href="mailto:admin@iship.local">admin@iship.local</a>.
        </p>
        <p>See you around! 👋</p>
        <p><strong>Iship</strong></p>
      `
    );

    const transport = await getTransport();
    const info = await transport.sendMail({
      from: env.email.from,
      to: toEmail,
      subject: `Welcome to ${eventName}`,
      text,
      html,
    });

    const preview = nodemailer.getTestMessageUrl(info);
    if (preview) log('Check-in alert preview URL', preview);
    else log('Check-in alert sent', toEmail);
  } catch (err) {
    logError('Check-in alert email failed', err.message || err);
  }
}

async function sendAddonChangeEmail({
  registrationId,
  userId,
  toEmail,
  memberName,
  eventTitle,
  eventVenue,
  eventStartsAt,
  previousAddons,
  addonCount,
  amountPaise,
  status,
}) {
  try {
    if (!toEmail) return;

    const userName = memberName || 'there';
    const eventName = eventTitle || 'the event';
    const eventDate = formatDate(eventStartsAt);
    const venue = eventVenue || 'TBA';
    const partySize = 1 + Number(addonCount || 0);
    const amountLabel = Number(amountPaise) === 0
      ? 'Free'
      : `₹${(Number(amountPaise) / 100).toFixed(2)}`;

    const text =
      `Hi ${userName},\n\n` +
      `Your add-ons for ${eventName} have been updated.\n\n` +
      `Previous add-ons: ${previousAddons}\n` +
      `New add-ons: ${addonCount}\n` +
      `People allowed to enter: ${partySize}\n` +
      `Updated amount: ${amountLabel}\n` +
      `Event: ${eventName}\n` +
      `Date: ${eventDate}\n` +
      `Venue: ${venue}\n\n` +
      (status === 'PENDING_PAYMENT'
        ? `Please complete payment from My registrations if you have not already.\n\n`
        : `Your existing QR still works. Fewer people than ${partySize} may enter, but not more.\n\n`) +
      `Iship\n`;

    const html = wrapEmailHtml(
      'Add-ons updated',
      `
        <p>Hi ${escapeHtml(userName)},</p>
        <p>Your add-ons for <strong>${escapeHtml(eventName)}</strong> have been updated.</p>
        <ul>
          <li><strong>Previous add-ons:</strong> ${escapeHtml(previousAddons)}</li>
          <li><strong>New add-ons:</strong> ${escapeHtml(addonCount)}</li>
          <li><strong>People allowed to enter:</strong> ${escapeHtml(partySize)}</li>
          <li><strong>Updated amount:</strong> ${escapeHtml(amountLabel)}</li>
          <li><strong>Date:</strong> ${escapeHtml(eventDate)}</li>
          <li><strong>Venue:</strong> ${escapeHtml(venue)}</li>
        </ul>
        ${status === 'PENDING_PAYMENT'
          ? '<p>Please complete payment from <strong>My registrations</strong> if you have not already.</p>'
          : `<p>Your existing QR still works. Fewer people than ${partySize} may enter, but not more.</p>`}
        <p><strong>Iship</strong></p>
      `
    );

    const attachments = [];
    if (status === 'PAID' || status === 'CHECKED_IN') {
      try {
        const pass = await qrService.getPassForMember(registrationId, userId);
        const pdfBuffer = await pdfService.buildPassPdf(pass);
        attachments.push({
          filename: `iship-pass-${registrationId}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf',
        });
      } catch (err) {
        logError('Addon-change pass attach skipped', err.message || err);
      }
    }

    const transport = await getTransport();
    const info = await transport.sendMail({
      from: env.email.from,
      to: toEmail,
      subject: `Add-ons updated — ${eventName}`,
      text,
      html,
      attachments,
    });

    const preview = nodemailer.getTestMessageUrl(info);
    if (preview) log('Addon-change email preview URL', preview);
    else log('Addon-change email sent', toEmail);
  } catch (err) {
    logError('Addon-change email failed', err.message || err);
  }
}

async function sendCancelRegistrationEmail({
  toEmail,
  memberName,
  eventTitle,
  eventVenue,
  eventStartsAt,
  addonCount,
}) {
  try {
    if (!toEmail) return;

    const userName = memberName || 'there';
    const eventName = eventTitle || 'the event';
    const eventDate = formatDate(eventStartsAt);
    const venue = eventVenue || 'TBA';
    const addonLine = Number(addonCount) > 0
      ? `Add-ons that were released: ${addonCount}\n`
      : '';
    const addonHtml = Number(addonCount) > 0
      ? `<li><strong>Add-ons released:</strong> ${escapeHtml(addonCount)}</li>`
      : '';

    const text =
      `Hi ${userName},\n\n` +
      `Your registration for ${eventName} has been cancelled.\n\n` +
      `The seat(s) you held are available again.\n` +
      addonLine +
      `Event: ${eventName}\n` +
      `Date: ${eventDate}\n` +
      `Venue: ${venue}\n\n` +
      `Your QR pass is no longer valid.\n\n` +
      `Iship\n`;

    const html = wrapEmailHtml(
      'Registration cancelled',
      `
        <p>Hi ${escapeHtml(userName)},</p>
        <p>Your registration for <strong>${escapeHtml(eventName)}</strong> has been cancelled.</p>
        <p>The seat(s) you held are available again.</p>
        <ul>
          <li><strong>Event:</strong> ${escapeHtml(eventName)}</li>
          <li><strong>Date:</strong> ${escapeHtml(eventDate)}</li>
          <li><strong>Venue:</strong> ${escapeHtml(venue)}</li>
          ${addonHtml}
        </ul>
        <p>Your QR pass is no longer valid.</p>
        <p><strong>Iship</strong></p>
      `
    );

    const transport = await getTransport();
    const info = await transport.sendMail({
      from: env.email.from,
      to: toEmail,
      subject: `Registration cancelled — ${eventName}`,
      text,
      html,
    });

    const preview = nodemailer.getTestMessageUrl(info);
    if (preview) log('Cancel email preview URL', preview);
    else log('Cancel email sent', toEmail);
  } catch (err) {
    logError('Cancel email failed', err.message || err);
  }
}

module.exports = {
  sendPassPdfEmail,
  sendCheckInAlertEmail,
  sendAddonChangeEmail,
  sendCancelRegistrationEmail,
};
