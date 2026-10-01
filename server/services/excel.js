/**
 * Excel exports (exceljs). Amounts are written as rupees (paise / 100) with an Indian-grouping
 * rupee number format. Malayalam text is plain UTF-8; a font with Malayalam coverage is set on
 * text cells so it renders correctly even on a fresh Excel install.
 */
import ExcelJS from 'exceljs';
import { BRAND_NAME } from '../config/brand.js';
import { MONTH_NAMES, monthLabel } from '../utils/money.js';

const PRIMARY = 'FF144A9F';
const PRIMARY_DARK = 'FF0A2A63';
const BAND = 'FFEAF1FB';
const BORDER = { style: 'thin', color: { argb: 'FFD0DBEA' } };
const ALL_BORDERS = { top: BORDER, left: BORDER, bottom: BORDER, right: BORDER };
const TEXT_FONT = 'Nirmala UI'; // Windows font with Malayalam; Excel falls back elsewhere
const RUPEE = '[>=10000000]"₹"##\\,##\\,##\\,##0.00;[>=100000]"₹"##\\,##\\,##0.00;"₹"##,##0.00';
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const STATUS_LABEL = { paid: 'Paid', partial: 'Partial', unpaid: 'Unpaid' };

const rupees = (paise) => (paise || 0) / 100;
/** Shift a stored-UTC Date forward to IST wall-clock for display-only spreadsheet cells. */
const toIST = (date) => new Date(new Date(date).getTime() + (5 * 60 + 30) * 60000);
const CATEGORY_LABEL = {
  service: 'Service', tyre: 'Tyre', brake: 'Brake', engine: 'Engine', battery: 'Battery', electrical: 'Electrical', accident: 'Accident', other: 'Other',
  rent: 'Rent', electricity: 'Electricity', 'phone-internet': 'Phone/Internet', 'stationery-packing': 'Stationery/Packing', 'publisher-payment': 'Publisher payment', miscellaneous: 'Miscellaneous',
  fuel: 'Fuel', repair: 'Repair', salary: 'Salary',
};

function newWorkbook() {
  const wb = new ExcelJS.Workbook();
  wb.creator = BRAND_NAME;
  wb.created = new Date();
  return wb;
}

function title(ws, text, subtitle, lastCol) {
  ws.mergeCells(1, 1, 1, lastCol);
  const t = ws.getCell(1, 1);
  t.value = `${BRAND_NAME} — ${text}`;
  t.font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
  t.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PRIMARY_DARK } };
  t.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  ws.getRow(1).height = 30;

  ws.mergeCells(2, 1, 2, lastCol);
  const s = ws.getCell(2, 1);
  s.value = subtitle;
  s.font = { name: TEXT_FONT, size: 11, color: { argb: PRIMARY_DARK } };
  s.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BAND } };
  s.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  ws.getRow(2).height = 20;
}

function headerRow(row, from = 1, to = row.cellCount) {
  for (let c = from; c <= to; c++) {
    const cell = row.getCell(c);
    cell.font = { name: 'Calibri', bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PRIMARY } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = ALL_BORDERS;
  }
  row.height = 22;
}

function bodyRow(row, moneyCols = [], textCols = []) {
  row.eachCell({ includeEmpty: true }, (cell, c) => {
    cell.border = ALL_BORDERS;
    if (moneyCols.includes(c)) cell.numFmt = RUPEE;
    if (textCols.includes(c)) cell.font = { name: TEXT_FONT, size: 11 };
    cell.alignment = { vertical: 'middle', ...(moneyCols.includes(c) ? { horizontal: 'right' } : {}) };
  });
}

function totalsRow(row, moneyCols = []) {
  row.eachCell({ includeEmpty: true }, (cell, c) => {
    cell.font = { name: 'Calibri', bold: true };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BAND } };
    cell.border = { ...ALL_BORDERS, top: { style: 'medium', color: { argb: PRIMARY } } };
    if (moneyCols.includes(c)) {
      cell.numFmt = RUPEE;
      cell.alignment = { horizontal: 'right' };
    }
  });
}

function printSetup(ws, { landscape = false, titleRows } = {}) {
  ws.pageSetup = {
    paperSize: 9, // A4
    orientation: landscape ? 'landscape' : 'portrait',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: { left: 0.4, right: 0.4, top: 0.6, bottom: 0.6, header: 0.3, footer: 0.3 },
    ...(titleRows ? { printTitlesRow: titleRows } : {}),
  };
  ws.headerFooter.oddFooter = `&L${BRAND_NAME}&CPage &P of &N&R&D`;
}

export async function sendWorkbook(res, wb, filename) {
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  await wb.xlsx.write(res);
  res.end();
}

const rateText = (line) =>
  line.segments && line.segments.length > 1
    ? line.segments.map((s) => `₹${rupees(s.ratePerCopy).toFixed(2)}×${s.copies}`).join(' + ')
    : rupees(line.ratePerCopy);

/** Customer monthly bill: sheet 1 invoice, sheet 2 day-by-day breakdown. */
export function customerBillWorkbook(bill, customer) {
  const wb = newWorkbook();
  const label = monthLabel(bill.year, bill.month);

  // ---- Sheet 1: invoice ----
  const ws = wb.addWorksheet('Monthly Bill', { views: [{ showGridLines: false }] });
  ws.columns = [{ width: 34 }, { width: 12 }, { width: 24 }, { width: 18 }];
  title(ws, 'Monthly Bill', label, 4);

  const info = [
    ['Customer', customer.name],
    ['Address', customer.address],
    ['Phone', customer.phone],
    ['Billing month', label],
  ];
  info.forEach(([k, v], i) => {
    const r = 4 + i;
    ws.getCell(r, 1).value = k;
    ws.getCell(r, 1).font = { name: 'Calibri', bold: true, color: { argb: PRIMARY_DARK } };
    ws.mergeCells(r, 2, r, 4);
    const c = ws.getCell(r, 2);
    c.value = v;
    c.font = { name: TEXT_FONT, size: 11 };
    c.alignment = { wrapText: true, vertical: 'top' };
  });
  ws.getRow(5).height = 32;

  const headIdx = 9;
  const head = ws.getRow(headIdx);
  head.values = ['Publication', 'Copies', 'Rate per copy', 'Amount'];
  headerRow(head);

  const first = headIdx + 1;
  let r = first;
  if (bill.lineItems.length === 0) {
    ws.getRow(r).values = ['No deliveries this month', 0, '', 0];
    bodyRow(ws.getRow(r), [4], [1]);
    r++;
  }
  for (const l of bill.lineItems) {
    const row = ws.getRow(r);
    row.values = [l.publicationName, l.copies, rateText(l), rupees(l.amount)];
    bodyRow(row, [4], [1]);
    row.getCell(2).alignment = { horizontal: 'center' };
    const rc = row.getCell(3);
    if (typeof rc.value === 'number') {
      rc.numFmt = RUPEE;
      rc.alignment = { horizontal: 'right' };
    } else {
      rc.alignment = { horizontal: 'right', wrapText: true };
    }
    r++;
  }
  const last = r - 1;
  r++; // spacer

  // ---- Previous dues, broken down by month (never a single rolled-up number) ----
  if (bill.dueBreakdown && bill.dueBreakdown.length) {
    ws.mergeCells(r, 1, r, 4);
    const dueTitle = ws.getCell(r, 1);
    dueTitle.value = `Previous dues — pending since ${monthLabel(bill.dueBreakdown[0].year, bill.dueBreakdown[0].month)} (${bill.dueBreakdown.length} month${bill.dueBreakdown.length > 1 ? 's' : ''})`;
    dueTitle.font = { name: 'Calibri', bold: true, color: { argb: PRIMARY_DARK } };
    r++;
    const dueHead = ws.getRow(r);
    dueHead.values = ['Month', 'Billed', 'Paid', 'Pending'];
    headerRow(dueHead);
    r++;
    const dueFirst = r;
    for (const d of bill.dueBreakdown) {
      const row = ws.getRow(r);
      row.values = [monthLabel(d.year, d.month), rupees(d.billed), rupees(d.paid), rupees(d.pending)];
      bodyRow(row, [2, 3, 4], [1]);
      r++;
    }
    const dueLast = r - 1;
    const dueTotal = ws.getRow(r);
    dueTotal.values = ['Total previous dues', '', '', { formula: `SUM(D${dueFirst}:D${dueLast})`, result: rupees(bill.previousDue) }];
    totalsRow(dueTotal, [4]);
    r += 2;
  }

  const summary = (label, value, opts = {}) => {
    ws.mergeCells(r, 1, r, 3);
    const lc = ws.getCell(r, 1);
    lc.value = label;
    lc.alignment = { horizontal: 'right' };
    lc.font = { name: 'Calibri', bold: !!opts.bold };
    const vc = ws.getCell(r, 4);
    vc.value = value;
    vc.numFmt = RUPEE;
    vc.font = { name: 'Calibri', bold: !!opts.bold };
    vc.alignment = { horizontal: 'right' };
    if (opts.strong) {
      for (let c = 1; c <= 4; c++) {
        ws.getCell(r, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BAND } };
        ws.getCell(r, c).border = { top: { style: 'medium', color: { argb: PRIMARY } }, bottom: BORDER };
      }
    }
    return r++;
  };

  const cur = summary('Current charges', { formula: `SUM(D${first}:D${last})`, result: rupees(bill.currentCharges) });
  const prev = summary(bill.dueBreakdown?.length ? 'Previous dues (see breakdown above)' : 'Previous due', rupees(bill.previousDue));
  const tot = summary('Total payable', { formula: `D${cur}+D${prev}`, result: rupees(bill.totalPayable) }, { bold: true, strong: true });
  const paid = summary('Amount paid', rupees(bill.amountPaid));
  summary('Balance due', { formula: `MAX(0,D${tot}-D${paid})`, result: rupees(bill.balance) }, { bold: true, strong: true });

  ws.mergeCells(r, 1, r, 3);
  ws.getCell(r, 1).value = 'Status';
  ws.getCell(r, 1).alignment = { horizontal: 'right' };
  const st = ws.getCell(r, 4);
  st.value = STATUS_LABEL[bill.status] || bill.status;
  st.font = { bold: true, color: { argb: bill.status === 'paid' ? 'FF15803D' : bill.status === 'partial' ? 'FFB45309' : 'FFB91C1C' } };
  st.alignment = { horizontal: 'right' };
  ws.views = [{ showGridLines: false, state: 'frozen', ySplit: headIdx }];
  printSetup(ws, { titleRows: `${headIdx}:${headIdx}` });

  // ---- Sheet 2: daily breakdown ----
  const ds = wb.addWorksheet('Daily Breakdown');
  ds.columns = [{ width: 14 }, { width: 8 }, { width: 52 }, { width: 10 }, { width: 16 }, { width: 18 }];
  title(ds, 'Daily Breakdown', `${customer.name} · ${label}`, 6);
  const dh = ds.getRow(4);
  dh.values = ['Date', 'Day', 'Delivered', 'Copies', 'Amount', 'Running total'];
  headerRow(dh);
  let dr = 5;
  for (const d of bill.days) {
    const [y, m, dd] = d.date.split('-').map(Number);
    const row = ds.getRow(dr);
    row.values = [
      new Date(Date.UTC(y, m - 1, dd)),
      DAYS[d.weekday],
      d.items.map((i) => `${i.publicationName} ×${i.copies}`).join(', ') || '—',
      d.copies,
      rupees(d.amount),
      rupees(d.runningTotal),
    ];
    bodyRow(row, [5, 6], [3]);
    row.getCell(1).numFmt = 'dd-mmm-yyyy';
    row.getCell(1).alignment = { horizontal: 'left' };
    row.getCell(2).alignment = { horizontal: 'center' };
    row.getCell(4).alignment = { horizontal: 'center' };
    if (d.weekday === 0) row.eachCell((c) => (c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F8FC' } }));
    dr++;
  }
  const tr = ds.getRow(dr);
  tr.values = [
    'Total', '', '',
    { formula: `SUM(D5:D${dr - 1})`, result: bill.days.reduce((n, d) => n + d.copies, 0) },
    { formula: `SUM(E5:E${dr - 1})`, result: rupees(bill.currentCharges) },
    rupees(bill.currentCharges),
  ];
  totalsRow(tr, [5, 6]);
  tr.getCell(4).alignment = { horizontal: 'center' };
  ds.views = [{ state: 'frozen', ySplit: 4 }];
  printSetup(ds, { titleRows: '4:4' });

  return wb;
}

/** All customers' bills for a month. */
export function monthlyWorkbook(bills, year, month) {
  const wb = newWorkbook();
  const label = monthLabel(year, month);
  const ws = wb.addWorksheet(`${MONTH_NAMES[month - 1].slice(0, 3)} ${year}`);
  ws.columns = [
    { width: 6 }, { width: 30 }, { width: 14 }, { width: 16 }, { width: 16 },
    { width: 16 }, { width: 16 }, { width: 16 }, { width: 12 }, { width: 26 },
  ];
  title(ws, 'Monthly Bills — All Customers', label, 10);
  const head = ws.getRow(4);
  head.values = ['#', 'Customer', 'Phone', 'Current charges', 'Previous due', 'Total payable', 'Paid', 'Balance', 'Status', 'Due months'];
  headerRow(head);
  let r = 5;
  bills.forEach((b, i) => {
    const row = ws.getRow(r);
    const dueMonths = (b.dueMonths || []).map((d) => MONTH_NAMES[d.month - 1].slice(0, 3) + ' ' + d.year).join(', ');
    row.values = [
      i + 1, b.customer?.name || '', b.customer?.phone || '',
      rupees(b.currentCharges), rupees(b.previousDue), rupees(b.totalPayable),
      rupees(b.amountPaid), rupees(b.balance), STATUS_LABEL[b.status] || b.status, dueMonths || '—',
    ];
    bodyRow(row, [4, 5, 6, 7, 8], [2, 10]);
    row.getCell(1).alignment = { horizontal: 'center' };
    row.getCell(9).alignment = { horizontal: 'center' };
    row.getCell(9).font = {
      bold: true,
      color: { argb: b.status === 'paid' ? 'FF15803D' : b.status === 'partial' ? 'FFB45309' : 'FFB91C1C' },
    };
    r++;
  });
  const t = ws.getRow(r);
  const sum = (col, field) => ({
    formula: bills.length ? `SUM(${col}5:${col}${r - 1})` : '0',
    result: rupees(bills.reduce((n, b) => n + b[field], 0)),
  });
  t.values = [
    '', 'Total', '',
    sum('D', 'currentCharges'), sum('E', 'previousDue'), sum('F', 'totalPayable'),
    sum('G', 'amountPaid'), sum('H', 'balance'), '',
  ];
  totalsRow(t, [4, 5, 6, 7, 8]);
  ws.views = [{ state: 'frozen', xSplit: 2, ySplit: 4 }];
  printSetup(ws, { landscape: true, titleRows: '4:4' });
  return wb;
}

/** Year matrix (Jan-Dec x billed/paid/balance). */
export function yearlyWorkbook(report) {
  const wb = newWorkbook();
  const ws = wb.addWorksheet(`Year ${report.year}`);
  const lastCol = 1 + 12 * 3 + 3;
  ws.getColumn(1).width = 28;
  for (let c = 2; c <= lastCol; c++) ws.getColumn(c).width = c > 1 + 36 ? 16 : 13;
  title(ws, 'Yearly Report', `Calendar year ${report.year}`, lastCol);

  // Two-row header: month names merged over Billed / Paid / Balance
  const h1 = ws.getRow(4);
  const h2 = ws.getRow(5);
  h1.getCell(1).value = 'Customer';
  ws.mergeCells(4, 1, 5, 1);
  for (let m = 1; m <= 12; m++) {
    const c = 2 + (m - 1) * 3;
    ws.mergeCells(4, c, 4, c + 2);
    h1.getCell(c).value = MONTH_NAMES[m - 1];
    h2.getCell(c).value = 'Billed';
    h2.getCell(c + 1).value = 'Paid';
    h2.getCell(c + 2).value = 'Balance';
  }
  const tc = 2 + 36;
  ws.mergeCells(4, tc, 4, tc + 2);
  h1.getCell(tc).value = `Total ${report.year}`;
  h2.getCell(tc).value = 'Billed';
  h2.getCell(tc + 1).value = 'Paid';
  h2.getCell(tc + 2).value = 'Outstanding';
  headerRow(h1, 1, lastCol);
  headerRow(h2, 1, lastCol);

  const moneyCols = Array.from({ length: lastCol - 1 }, (_, i) => i + 2);
  const first = 6;
  let r = first;
  for (const row of report.rows) {
    const xl = ws.getRow(r);
    xl.getCell(1).value = row.customer.name;
    for (let m = 1; m <= 12; m++) {
      const cell = row.months[m];
      const c = 2 + (m - 1) * 3;
      if (cell) {
        xl.getCell(c).value = rupees(cell.billed);
        xl.getCell(c + 1).value = rupees(cell.paid);
        xl.getCell(c + 2).value = rupees(cell.balance);
      }
    }
    xl.getCell(tc).value = rupees(row.totalBilled);
    xl.getCell(tc + 1).value = rupees(row.totalPaid);
    xl.getCell(tc + 2).value = rupees(row.outstanding);
    bodyRow(xl, moneyCols, [1]);
    r++;
  }
  const last = r - 1;
  const t = ws.getRow(r);
  t.getCell(1).value = 'Total';
  for (let c = 2; c <= lastCol; c++) {
    const L = ws.getColumn(c).letter;
    let result = 0;
    if (c < tc) {
      const m = Math.floor((c - 2) / 3) + 1;
      const kind = (c - 2) % 3;
      result = rupees(report.monthTotals[m][['billed', 'paid', 'balance'][kind]]);
    } else {
      result = rupees([report.totals.billed, report.totals.paid, report.totals.outstanding][c - tc]);
    }
    t.getCell(c).value = report.rows.length ? { formula: `SUM(${L}${first}:${L}${last})`, result } : 0;
  }
  totalsRow(t, moneyCols);
  ws.views = [{ state: 'frozen', xSplit: 1, ySplit: 5 }];
  printSetup(ws, { landscape: true, titleRows: '4:5' });
  return wb;
}

/* ================= Expense module exports ================= */

/** Fuel log. */
export function fuelLogWorkbook(entries, filterLabel) {
  const wb = newWorkbook();
  const ws = wb.addWorksheet('Fuel Log');
  ws.columns = [{ width: 18 }, { width: 16 }, { width: 18 }, { width: 10 }, { width: 14 }, { width: 14 }, { width: 10 }, { width: 18 }, { width: 10 }];
  title(ws, 'Fuel Log', filterLabel, 9);
  const head = ws.getRow(4);
  head.values = ['Date/time (IST)', 'Vehicle', 'Employee', 'Litres', 'Price/litre', 'Amount', 'Odometer', 'Station', 'Full tank'];
  headerRow(head);
  let r = 5;
  for (const e of entries) {
    const row = ws.getRow(r);
    row.values = [toIST(e.fuelledAt), e.vehicle?.registrationNumber || '', e.employee?.name || '', e.litres, rupees(e.pricePerLitre), rupees(e.amount), e.odometer, e.station, e.fullTank ? 'Yes' : 'No'];
    bodyRow(row, [5, 6], [2, 3, 8]);
    row.getCell(1).numFmt = 'dd-mmm-yyyy hh:mm AM/PM';
    r++;
  }
  const last = r - 1;
  const t = ws.getRow(r);
  t.values = ['Total', '', '', { formula: entries.length ? `SUM(D5:D${last})` : '0', result: entries.reduce((n, e) => n + e.litres, 0) }, '', { formula: entries.length ? `SUM(F5:F${last})` : '0', result: rupees(entries.reduce((n, e) => n + e.amount, 0)) }, '', '', ''];
  totalsRow(t, [6]);
  ws.views = [{ state: 'frozen', ySplit: 4 }];
  printSetup(ws, { landscape: true, titleRows: '4:4' });
  return wb;
}

/** Repairs log. */
export function repairsLogWorkbook(entries, filterLabel) {
  const wb = newWorkbook();
  const ws = wb.addWorksheet('Repairs Log');
  ws.columns = [{ width: 18 }, { width: 16 }, { width: 14 }, { width: 36 }, { width: 18 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 12 }];
  title(ws, 'Repairs Log', filterLabel, 9);
  const head = ws.getRow(4);
  head.values = ['Date/time (IST)', 'Vehicle', 'Category', 'Description', 'Workshop', 'Parts', 'Labour', 'Total', 'Status'];
  headerRow(head);
  let r = 5;
  for (const e of entries) {
    const row = ws.getRow(r);
    row.values = [toIST(e.repairedAt), e.vehicle?.registrationNumber || '', CATEGORY_LABEL[e.category] || e.category, e.description, e.workshop, rupees(e.partsCost), rupees(e.labourCost), rupees(e.total), e.status === 'pending' ? 'Pending' : 'Completed'];
    bodyRow(row, [6, 7, 8], [2, 4, 5]);
    row.getCell(1).numFmt = 'dd-mmm-yyyy hh:mm AM/PM';
    r++;
  }
  const last = r - 1;
  const t = ws.getRow(r);
  t.values = ['Total', '', '', '', '', { formula: entries.length ? `SUM(F5:F${last})` : '0', result: rupees(entries.reduce((n, e) => n + e.partsCost, 0)) }, { formula: entries.length ? `SUM(G5:G${last})` : '0', result: rupees(entries.reduce((n, e) => n + e.labourCost, 0)) }, { formula: entries.length ? `SUM(H5:H${last})` : '0', result: rupees(entries.reduce((n, e) => n + e.total, 0)) }, ''];
  totalsRow(t, [6, 7, 8]);
  ws.views = [{ state: 'frozen', ySplit: 4 }];
  printSetup(ws, { landscape: true, titleRows: '4:4' });
  return wb;
}

/** Salary register for a month or a year. */
export function salaryRegisterWorkbook(payments, label) {
  const wb = newWorkbook();
  const ws = wb.addWorksheet('Salary Register');
  ws.columns = [{ width: 24 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 20 }, { width: 10 }];
  title(ws, 'Salary Register', label, 9);
  const head = ws.getRow(4);
  head.values = ['Employee', 'Month', 'Base salary', 'Bonus', 'Deductions', 'Advance recovered', 'Net paid', 'Paid on (IST)', 'Mode'];
  headerRow(head);
  let r = 5;
  for (const p of payments) {
    const row = ws.getRow(r);
    row.values = [p.employee?.name || '', monthLabel(p.forYear, p.forMonth), rupees(p.baseSalary), rupees(p.bonus), rupees(p.deductions), rupees(p.advanceRecovered), rupees(p.netPaid), toIST(p.paidOn), p.mode.toUpperCase()];
    bodyRow(row, [3, 4, 5, 6, 7], [1]);
    row.getCell(8).numFmt = 'dd-mmm-yyyy hh:mm AM/PM';
    r++;
  }
  const last = r - 1;
  const t = ws.getRow(r);
  const sum = (col, field) => ({ formula: payments.length ? `SUM(${col}5:${col}${last})` : '0', result: rupees(payments.reduce((n, p) => n + p[field], 0)) });
  t.values = ['Total', '', sum('C', 'baseSalary'), sum('D', 'bonus'), sum('E', 'deductions'), sum('F', 'advanceRecovered'), sum('G', 'netPaid'), '', ''];
  totalsRow(t, [3, 4, 5, 6, 7]);
  ws.views = [{ state: 'frozen', ySplit: 4 }];
  printSetup(ws, { landscape: true, titleRows: '4:4' });
  return wb;
}

/** Unified expense ledger across fuel/repair/salary/other. */
export function ledgerWorkbook(rows, filterLabel) {
  const wb = newWorkbook();
  const ws = wb.addWorksheet('Expense Ledger');
  ws.columns = [{ width: 18 }, { width: 12 }, { width: 44 }, { width: 16 }, { width: 18 }, { width: 14 }, { width: 18 }];
  title(ws, 'Expense Ledger', filterLabel, 7);
  const head = ws.getRow(4);
  head.values = ['Date', 'Type', 'Description', 'Vehicle/Employee', 'Amount', 'Recorded', 'Created at (IST)'];
  headerRow(head);
  let r = 5;
  for (const row of rows) {
    const xl = ws.getRow(r);
    xl.values = [new Date(row.date), CATEGORY_LABEL[row.type] || row.type, row.description, row.vehicle || row.employee || '', rupees(row.amount), '', toIST(row.createdAt)];
    bodyRow(xl, [5], [3, 4]);
    xl.getCell(1).numFmt = 'dd-mmm-yyyy';
    xl.getCell(7).numFmt = 'dd-mmm-yyyy hh:mm AM/PM';
    r++;
  }
  const last = r - 1;
  const t = ws.getRow(r);
  t.values = ['Total', '', '', '', { formula: rows.length ? `SUM(E5:E${last})` : '0', result: rupees(rows.reduce((n, x) => n + x.amount, 0)) }, '', ''];
  totalsRow(t, [5]);
  ws.views = [{ state: 'frozen', ySplit: 4 }];
  printSetup(ws, { landscape: true, titleRows: '4:4' });
  return wb;
}

/** Profit & Loss report. */
export function profitLossWorkbook(pnl, label) {
  const wb = newWorkbook();
  const ws = wb.addWorksheet('Profit & Loss');
  ws.columns = [{ width: 30 }, { width: 20 }];
  title(ws, 'Profit & Loss', label, 2);
  const rows = [
    ['Income collected', pnl.income],
    ['', null],
    ['Fuel', -pnl.fuel],
    ['Repairs', -pnl.repairs],
    ['Salaries', -pnl.salaries],
    ['Other expenses', -pnl.other],
    ['Publisher cost', -pnl.publisherCost],
    ['Total expenses', -pnl.totalExpenses],
    ['', null],
    ['Net profit / (loss)', pnl.netProfit],
  ];
  let r = 4;
  for (const [l, v] of rows) {
    const row = ws.getRow(r);
    row.getCell(1).value = l;
    row.getCell(1).font = { name: 'Calibri', bold: ['Total expenses', 'Net profit / (loss)', 'Income collected'].includes(l) };
    if (v != null) {
      row.getCell(2).value = rupees(v);
      row.getCell(2).numFmt = RUPEE;
      row.getCell(2).alignment = { horizontal: 'right' };
      row.getCell(2).font = { bold: ['Total expenses', 'Net profit / (loss)', 'Income collected'].includes(l), color: { argb: v < 0 ? 'FFB91C1C' : v > 0 && l === 'Net profit / (loss)' ? 'FF15803D' : undefined } };
    }
    if (l === 'Total expenses' || l === 'Net profit / (loss)') {
      row.getCell(1).border = { top: { style: 'medium', color: { argb: PRIMARY } } };
      row.getCell(2).border = { top: { style: 'medium', color: { argb: PRIMARY } } };
    }
    r++;
  }
  if (pnl.marginPct != null) {
    ws.getCell(r + 1, 1).value = 'Net margin';
    ws.getCell(r + 1, 2).value = `${pnl.marginPct.toFixed(1)}%`;
    ws.getCell(r + 1, 2).alignment = { horizontal: 'right' };
  }
  printSetup(ws);
  return wb;
}
