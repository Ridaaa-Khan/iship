const membersDb = require('../db/members');
const checkInsDb = require('../db/checkIns');
const registrationsDb = require('../db/registrations');
const registrationService = require('./registration');
const {
  formatDisplay,
  greetingForNow,
  firstName,
  startOfMonth,
  daysAgoStart,
  ymd,
  pad2,
} = require('../utils/datetime');

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function fillDaySeries(rows, days) {
  const counts = new Map();
  rows.forEach((row) => {
    const raw = row.day;
    const d = raw instanceof Date ? raw : new Date(raw);
    if (Number.isNaN(d.getTime())) return;
    counts.set(ymd(d), Number(row.count) || 0);
  });

  const labels = [];
  const values = [];
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    labels.push(`${SHORT_MONTHS[d.getMonth()]} ${d.getDate()}`);
    values.push(counts.get(ymd(d)) || 0);
  }

  return { labels, values };
}

function scanResultLabel(row) {
  if (row.result === 'ALLOWED') return 'Valid';
  const reason = String(row.denial_reason || '').toUpperCase();
  if (reason.includes('EXPIRED') || reason.includes('DOORS_CLOSED')) return 'Expired';
  return 'Invalid';
}

async function getAdminDashboard() {
  const counts = await membersDb.countMembers();
  const todayVisits = await checkInsDb.countAllowedToday();
  const recent = await checkInsDb.listRecent(8);
  const series7 = await checkInsDb.countAllowedByDay(daysAgoStart(7));
  const series30 = await checkInsDb.countAllowedByDay(daysAgoStart(30));

  return {
    greeting: `${greetingForNow()}, Admin`,
    subtitle: "Here's what's happening with your club today.",
    todayLabel: formatDisplay(new Date()),
    stats: {
      members: counts.total,
      active: counts.active,
      todayVisits,
    },
    charts: {
      days7: fillDaySeries(series7, 7),
      days30: fillDaySeries(series30, 30),
    },
    recent,
  };
}

async function getMemberDashboard(userId) {
  const profile = await membersDb.findMemberWithUserByUserId(userId);
  const name = firstName(profile && profile.full_name, 'Member');
  const totalVisits = await checkInsDb.countAllowedForUser(userId);
  const monthVisits = await checkInsDb.countAllowedForUser(userId, startOfMonth());
  const lastScan = await checkInsDb.findLastAllowedForUser(userId);
  const recent = await checkInsDb.listRecentForUser(userId, 8);
  const upcoming = profile
    ? await registrationsDb.listUpcomingForMember(profile.id, 5)
    : [];

  let openEvents = [];
  try {
    const listed = await registrationService.listPublishedEventsForMember(userId);
    openEvents = (listed.events || [])
      .filter((event) => {
        const mine = event.myRegistration;
        const taken = mine && mine.status !== 'CANCELLED';
        return event.status === 'PUBLISHED' && !taken;
      })
      .slice(0, 3);
  } catch (err) {
    openEvents = [];
  }

  return {
    greeting: `Welcome, ${name}`,
    greetingName: name,
    subtitle: "Here's an overview of your activity.",
    todayLabel: formatDisplay(new Date()),
    stats: {
      totalVisits,
      lastScan,
      monthVisits,
      monthRange: `${new Date().getFullYear()}-${pad2(new Date().getMonth() + 1)}-01 – ${ymd(new Date())}`,
    },
    recent,
    upcoming,
    openEvents,
  };
}

async function getScannerDashboard() {
  const breakdown = await checkInsDb.countTodayBreakdown();
  const currentInside = await checkInsDb.countCurrentInside();
  const recent = await checkInsDb.listRecent(8);

  return {
    greeting: 'Scanner dashboard',
    subtitle: 'Monitor entry scans and manage access at the gate.',
    todayLabel: formatDisplay(new Date()),
    stats: {
      scansToday: breakdown.scans,
      successful: breakdown.successful,
      denied: breakdown.denied,
      currentInside,
    },
    recent: recent.map((row) => ({
      ...row,
      resultLabel: scanResultLabel(row),
    })),
  };
}

module.exports = {
  getAdminDashboard,
  getMemberDashboard,
  getScannerDashboard,
};
