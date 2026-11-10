function fromDatetimeLocal(value) {
    if (!value) return null;

    return value.replace('T', ' ') + (value.length === 16 ? ':00' : '');
  }
  
  function toDatetimeLocal(sqlDatetime) {
    if (!sqlDatetime) return '';
    const d = new Date(sqlDatetime);
    if (Number.isNaN(d.getTime())) {

      return String(sqlDatetime).replace(' ', 'T').slice(0, 16);
    }
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  
  function paiseToRupees(paise) {
    return (Number(paise) / 100).toFixed(2);
  }

  function pad2(n) {
    return String(n).padStart(2, '0');
  }

  
  function formatDisplay(value) {
    if (value == null || value === '') return '—';
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) {
      const match = String(value).match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})/);
      if (match) return `${match[1]} · ${match[2]}`;
      return String(value);
    }
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} · ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  }

  function greetingForNow(now = new Date()) {
    const hour = now.getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }

  function firstName(fullName, fallback = 'Member') {
    const part = String(fullName || '').trim().split(/\s+/)[0];
    return part || fallback;
  }

  function startOfMonth(now = new Date()) {
    return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-01 00:00:00`;
  }

  function daysAgoStart(days, now = new Date()) {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - (Number(days) - 1));
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} 00:00:00`;
  }

  function ymd(d) {
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }

  const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function eventDateParts(value) {
    if (value == null || value === '') {
      return { month: '', day: '', time: '', weekday: '' };
    }
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) {
      return { month: '', day: '', time: '', weekday: '' };
    }
    const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return {
      month: SHORT_MONTHS[d.getMonth()].toUpperCase(),
      day: String(d.getDate()),
      time: `${pad2(d.getHours())}:${pad2(d.getMinutes())}`,
      weekday: weekdays[d.getDay()],
    };
  }
  
  module.exports = {
    fromDatetimeLocal,
    toDatetimeLocal,
    paiseToRupees,
    formatDisplay,
    greetingForNow,
    firstName,
    startOfMonth,
    daysAgoStart,
    ymd,
    pad2,
    eventDateParts,
  };