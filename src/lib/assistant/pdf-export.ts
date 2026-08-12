import type { jsPDF } from "jspdf";
import type { AiResponse } from "../ai-intent";

/**
 * Professional Arabic PDF export for account statements using jsPDF.
 * All labels, headers, and content are in Arabic with RTL layout.
 * Includes: MIZAN AI logo header, customer data, stats, readings table,
 * monthly consumption, bills table, payments table, final balance,
 * QR code, issue date, footer.
 *
 * All data comes from the existing response — no new calculations.
 */

type StatementResponse = Extract<AiResponse, { kind: "account_statement" }>;

const PRIMARY: [number, number, number] = [14, 165, 233];
const DARK: [number, number, number] = [30, 41, 59];
const MUTED: [number, number, number] = [100, 116, 139];
const LIGHT: [number, number, number] = [241, 245, 249];
const DANGER: [number, number, number] = [239, 68, 68];
const OK: [number, number, number] = [22, 163, 74];
const WHITE: [number, number, number] = [255, 255, 255];

function statusLabel(s: string): string {
  return s === "paid" ? "مدفوعة" : s === "partial" ? "جزئية" : "غير مدفوعة";
}
function payStatusLabel(s: string): string {
  return s === "approved" ? "معتمدة" : s === "pending" ? "معلقة" : "مرفوضة";
}
function methodLabel(m: string): string {
  return m === "cash" ? "نقدي" : m === "wallet" ? "الكريمي" : "تحويل";
}
function readingStatusLabel(s: string): string {
  return s === "approved" ? "معتمدة" : s === "rejected" ? "مرفوضة" : "معلقة";
}

/**
 * Reverse Arabic text for jsPDF rendering.
 * jsPDF with helvetica renders left-to-right, so we reverse each line
 * character-by-character to approximate RTL display.
 * For numbers embedded in Arabic text, we keep digit sequences LTR
 * within the reversed string.
 */
function shapeArabic(text: string): string {
  if (!text) return "";
  // Split into tokens: digit sequences vs non-digit
  const tokens: string[] = [];
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (/[\d,.\s]/.test(ch)) {
      let j = i;
      while (j < text.length && /[\d,.\s]/.test(text[j])) j++;
      tokens.push(text.slice(i, j));
      i = j;
    } else {
      let j = i;
      while (j < text.length && !/[\d,.\s]/.test(text[j])) j++;
      tokens.push(text.slice(i, j));
      i = j;
    }
  }
  // Reverse the order of tokens to approximate RTL
  return tokens.reverse().join("");
}

export async function exportStatementPDF(response: StatementResponse): Promise<void> {
  const { customer, totals, stats, lastReading, readings, monthlyConsumption, bills, payments } = response;
  const { jsPDF } = await import("jspdf");
  const QRCode = await import("qrcode");
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 15;
  const rightEdge = pageW - margin;
  let y = margin;

  // ── Header band ─────────────────────────────────────────────────
  doc.setFillColor(...PRIMARY);
  doc.rect(0, 0, pageW, 25, "F");
  doc.setTextColor(...WHITE);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("MIZAN AI", rightEdge, 12, { align: "right" });
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(shapeArabic("مساعد ميزان الذكي - كشف حساب"), rightEdge, 18, { align: "right" });
  doc.setFontSize(8);
  doc.text(new Date().toLocaleString("en-GB"), margin, 12, { align: "left" });

  y = 32;
  doc.setTextColor(...DARK);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text(shapeArabic("كشف حساب مشترك"), pageW / 2, y, { align: "center" });
  y += 6;

  doc.setDrawColor(...PRIMARY);
  doc.setLineWidth(0.5);
  doc.line(margin, y, rightEdge, y);
  y += 5;

  // ── Customer info (RTL: labels on right, values to the left) ─────
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  const infoLines: Array<[string, string]> = [
    [shapeArabic("الاسم"), customer.name],
    [shapeArabic("رقم العداد"), customer.meterNumber ?? "-"],
    [shapeArabic("الهاتف"), customer.phone],
    [shapeArabic("الحالة"), customer.status === "active" ? shapeArabic("نشط") : shapeArabic("متوقف")],
  ];
  if (customer.directorate) infoLines.push([shapeArabic("المديرية"), customer.directorate]);

  for (const [label, value] of infoLines) {
    doc.setTextColor(...MUTED);
    doc.text(label, rightEdge, y, { align: "right" });
    doc.setTextColor(...DARK);
    doc.text(String(value), rightEdge - 35, y, { align: "right" });
    y += 5;
  }
  y += 3;

  // ── Summary boxes (4 across) ────────────────────────────────────
  const boxW = (pageW - margin * 2 - 9) / 4;
  const boxH = 14;
  const summaries: Array<{ label: string; value: string; color: [number, number, number] }> = [
    { label: shapeArabic("إجمالي مفوتر"), value: fmtYERShort(totals.billed), color: DARK },
    { label: shapeArabic("مدفوع"), value: fmtYERShort(totals.paid), color: OK },
    { label: shapeArabic("متأخرات"), value: fmtYERShort(totals.arrears), color: DANGER },
    { label: shapeArabic("الرصيد"), value: fmtYERShort(totals.balance), color: totals.balance > 0 ? DANGER : OK },
  ];

  summaries.forEach((s, i) => {
    const x = margin + i * (boxW + 3);
    doc.setFillColor(...LIGHT);
    doc.roundedRect(x, y, boxW, boxH, 1.5, 1.5, "F");
    doc.setTextColor(...MUTED);
    doc.setFontSize(7);
    doc.text(s.label, x + boxW - 2, y + 5, { align: "right" });
    doc.setTextColor(...s.color);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(s.value, x + boxW - 2, y + 11, { align: "right" });
    doc.setFont("helvetica", "normal");
  });
  y += boxH + 5;

  // ── Stats row ───────────────────────────────────────────────────
  if (stats) {
    const statBoxes: Array<{ label: string; value: string; color: [number, number, number] }> = [
      { label: shapeArabic("عدد الفواتير"), value: String(stats.billCount), color: DARK },
      { label: shapeArabic("نسبة التحصيل"), value: stats.collectionPct + "%", color: stats.collectionPct >= 70 ? OK : DANGER },
      { label: shapeArabic("أعلى فاتورة"), value: fmtYERShort(stats.highestBill), color: DARK },
      { label: shapeArabic("أدنى فاتورة"), value: fmtYERShort(stats.lowestBill), color: DARK },
    ];
    statBoxes.forEach((st, i) => {
      const x = margin + i * (boxW + 3);
      doc.setFillColor(...LIGHT);
      doc.roundedRect(x, y, boxW, boxH, 1.5, 1.5, "F");
      doc.setTextColor(...MUTED);
      doc.setFontSize(7);
      doc.text(st.label, x + boxW - 2, y + 5, { align: "right" });
      doc.setTextColor(...st.color);
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text(st.value, x + boxW - 2, y + 11, { align: "right" });
      doc.setFont("helvetica", "normal");
    });
    y += boxH + 5;
  }

  // ── Last reading ────────────────────────────────────────────────
  if (lastReading) {
    doc.setTextColor(...PRIMARY);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(shapeArabic("آخر قراءة"), rightEdge, y, { align: "right" });
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...DARK);
    const rd = new Date(lastReading.date).toLocaleDateString("en-GB");
    doc.text(`${shapeArabic("التاريخ:")} ${rd}`, rightEdge, y, { align: "right" });
    doc.text(`${shapeArabic("القراءة:")} ${lastReading.current}`, rightEdge - 55, y, { align: "right" });
    doc.text(`${shapeArabic("الاستهلاك:")} ${lastReading.consumption} m3`, rightEdge - 100, y, { align: "right" });
    y += 6;
  }

  // ── Readings table ──────────────────────────────────────────────
  if (readings && readings.length > 0) {
    y = drawTable(doc, margin, y, pageW - margin * 2, shapeArabic("سجل القراءات"),
      [shapeArabic("التاريخ"), shapeArabic("السابقة"), shapeArabic("الحالية"), shapeArabic("الاستهلاك"), shapeArabic("الحالة")],
      readings.slice(0, 20).map((r) => [
        new Date(r.date).toLocaleDateString("en-GB"),
        String(r.previous), String(r.current),
        String(r.consumption) + " m3",
        shapeArabic(readingStatusLabel(r.status)),
      ]),
      pageH, true);
  }

  // ── Monthly consumption ─────────────────────────────────────────
  if (monthlyConsumption && monthlyConsumption.length > 0) {
    if (y > pageH - 25) { doc.addPage(); y = margin; }
    doc.setTextColor(...PRIMARY);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(shapeArabic("الاستهلاك الشهري (آخر 12 شهر)"), rightEdge, y, { align: "right" });
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...DARK);
    const colW = (pageW - margin * 2) / Math.min(monthlyConsumption.length, 12);
    monthlyConsumption.slice(0, 12).forEach((m, i) => {
      const x = margin + i * colW;
      doc.text(m.month, x + 1, y);
      doc.text(String(m.consumption), x + 1, y + 4);
    });
    y += 10;
  }

  // ── Bills table ─────────────────────────────────────────────────
  y = drawTable(doc, margin, y, pageW - margin * 2, shapeArabic("سجل الفواتير"),
    [shapeArabic("التاريخ"), shapeArabic("رقم الفاتورة"), shapeArabic("الاستهلاك"), shapeArabic("المبلغ"), shapeArabic("المدفوع"), shapeArabic("الحالة")],
    bills.map((b) => [
      new Date(b.date).toLocaleDateString("en-GB"),
      b.serial,
      String(b.consumption) + " m3",
      fmtYERShort(b.total),
      fmtYERShort(b.paid),
      shapeArabic(statusLabel(b.status)),
    ]),
    pageH, true);

  // ── Payments table ──────────────────────────────────────────────
  y = drawTable(doc, margin, y, pageW - margin * 2, shapeArabic("سجل الدفعات"),
    [shapeArabic("التاريخ"), shapeArabic("المبلغ"), shapeArabic("الطريقة"), shapeArabic("الحالة")],
    payments.map((p) => [
      new Date(p.date).toLocaleDateString("en-GB"),
      fmtYERShort(p.amount),
      shapeArabic(methodLabel(p.method)),
      shapeArabic(payStatusLabel(p.status)),
    ]),
    pageH, true);

  // ── Final balance banner ────────────────────────────────────────
  if (y > pageH - 45) { doc.addPage(); y = margin; }
  y += 5;
  doc.setFillColor(...(totals.balance > 0 ? DANGER : OK));
  doc.roundedRect(margin, y, pageW - margin * 2, 12, 2, 2, "F");
  doc.setTextColor(...WHITE);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(shapeArabic("الرصيد النهائي:"), margin + 3, y + 8, { align: "left" });
  doc.text(fmtYERShort(totals.balance), rightEdge - 3, y + 8, { align: "right" });
  y += 16;

  // ── QR code ─────────────────────────────────────────────────────
  const qrData = JSON.stringify({ customer: customer.name, meter: customer.meterNumber ?? "", balance: totals.balance, date: new Date().toISOString().slice(0, 10) });
  try {
    const qrDataUrl = await QRCode.toDataURL(qrData, { width: 100, margin: 0 });
    const qrSize = 22;
    if (y + qrSize > pageH - 15) { doc.addPage(); y = margin; }
    doc.addImage(qrDataUrl, "PNG", margin, y, qrSize, qrSize);
    doc.setTextColor(...MUTED);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text(shapeArabic("امسح للتحقق"), margin, y + qrSize + 4);
  } catch { /* QR generation failed — non-fatal */ }

  // ── Footer ──────────────────────────────────────────────────────
  const footerY = pageH - 10;
  doc.setDrawColor(...LIGHT);
  doc.setLineWidth(0.3);
  doc.line(margin, footerY - 3, rightEdge, footerY - 3);
  doc.setTextColor(...MUTED);
  doc.setFontSize(7);
  doc.text(shapeArabic("صادر عن مساعد ميزان الذكي"), rightEdge, footerY, { align: "right" });
  doc.text(new Date().toLocaleString("en-GB"), margin, footerY, { align: "left" });

  const fileName = `MIZAN_Statement_${customer.name.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(fileName);
}

function fmtYERShort(n: number): string {
  return Math.round(n).toLocaleString("en-US") + " YER";
}

/**
 * Draw a table with RTL-aware headers.
 * When rtl is true, headers are right-aligned within their column.
 */
function drawTable(doc: jsPDF, x: number, y: number, w: number, title: string, headers: string[], rows: string[][], pageH: number, rtl = false): number {
  const colW = w / headers.length;
  const rowH = 6;
  const headerH = 7;
  if (y > pageH - 30) { doc.addPage(); y = 15; }
  doc.setTextColor(...PRIMARY);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text(title, rtl ? x + w : x, y, { align: rtl ? "right" : "left" });
  y += 4;
  doc.setFillColor(...PRIMARY);
  doc.rect(x, y, w, headerH, "F");
  doc.setTextColor(...WHITE);
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  headers.forEach((h, i) => {
    const colX = x + i * colW;
    if (rtl) {
      doc.text(h, colX + colW - 1.5, y + 5, { align: "right" });
    } else {
      doc.text(h, colX + 1.5, y + 5);
    }
  });
  y += headerH;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  rows.forEach((row, ri) => {
    if (y > pageH - 15) { doc.addPage(); y = 15; }
    if (ri % 2 === 0) { doc.setFillColor(...LIGHT); doc.rect(x, y, w, rowH, "F"); }
    doc.setTextColor(...DARK);
    row.forEach((cell, ci) => {
      const colX = x + ci * colW;
      if (rtl) {
        doc.text(cell.length > 18 ? cell.slice(0, 16) + ".." : cell, colX + colW - 1.5, y + 4.5, { align: "right" });
      } else {
        doc.text(cell.length > 18 ? cell.slice(0, 16) + ".." : cell, colX + 1.5, y + 4.5);
      }
    });
    y += rowH;
  });
  if (rows.length === 0) {
    doc.setTextColor(...MUTED);
    doc.text(shapeArabic("لا توجد سجلات"), rtl ? x + w - 2 : x + 2, y + 4, { align: rtl ? "right" : "left" });
    y += rowH;
  }
  return y + 4;
}

// ── Loss Analysis PDF ─────────────────────────────────────────────
type LossResponse = Extract<AiResponse, { kind: "loss_analysis" }>;

export async function exportLossPDF(response: LossResponse): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 15;
  const rightEdge = pageW - margin;
  let y = margin;

  // Header
  doc.setFillColor(...PRIMARY);
  doc.rect(0, 0, pageW, 25, "F");
  doc.setTextColor(...WHITE);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("MIZAN AI", rightEdge, 12, { align: "right" });
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(shapeArabic("تحليل الفاقد"), rightEdge, 18, { align: "right" });

  y = 32;
  doc.setTextColor(...DARK);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text(shapeArabic("تقرير الفاقد"), pageW / 2, y, { align: "center" });
  y += 6;
  doc.setDrawColor(...PRIMARY);
  doc.setLineWidth(0.5);
  doc.line(margin, y, rightEdge, y);
  y += 6;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...MUTED);
  doc.text(`${shapeArabic("الفترة:")}`, rightEdge, y, { align: "right" });
  doc.setTextColor(...DARK);
  doc.text(`${response.range.from} → ${response.range.to}`, rightEdge - 25, y, { align: "right" });
  y += 8;

  // Water and Electric summary
  const boxW = (pageW - margin * 2 - 6) / 2;
  const boxH = 22;
  const summaries = [
    { label: shapeArabic("فاقد المياه"), pct: response.water.pct, loss: response.water.loss, produced: response.water.produced, consumed: response.water.consumed, color: PRIMARY },
    { label: shapeArabic("فاقد الكهرباء"), pct: response.electric.pct, loss: response.electric.loss, produced: response.electric.produced, consumed: response.electric.consumed, color: DARK },
  ];
  summaries.forEach((s, i) => {
    const x = margin + i * (boxW + 6);
    doc.setFillColor(...LIGHT);
    doc.roundedRect(x, y, boxW, boxH, 2, 2, "F");
    doc.setTextColor(...s.color);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(s.label, x + boxW - 3, y + 6, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...DARK);
    doc.text(`${shapeArabic("النسبة:")} ${s.pct.toFixed(1)}%`, x + boxW - 3, y + 11, { align: "right" });
    doc.text(`${shapeArabic("المنتج:")} ${fmtNumShort(s.produced)}`, x + boxW - 3, y + 15, { align: "right" });
    doc.text(`${shapeArabic("المستهلك:")} ${fmtNumShort(s.consumed)}`, x + boxW - 3, y + 19, { align: "right" });
  });
  y += boxH + 8;

  // Alerts
  if (response.alerts.length > 0) {
    doc.setFillColor(...DANGER);
    doc.roundedRect(margin, y, pageW - margin * 2, 6 + response.alerts.length * 5, 2, 2, "F");
    doc.setTextColor(...WHITE);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text(shapeArabic("تنبيهات"), rightEdge, y + 5, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    response.alerts.forEach((a, i) => {
      doc.text(shapeArabic(a), rightEdge - 3, y + 10 + i * 5, { align: "right" });
    });
    y += 6 + response.alerts.length * 5 + 5;
  }

  // Footer
  doc.setDrawColor(...LIGHT);
  doc.setLineWidth(0.3);
  doc.line(margin, pageH - 10, rightEdge, pageH - 10);
  doc.setTextColor(...MUTED);
  doc.setFontSize(7);
  doc.text(shapeArabic("صادر عن مساعد ميزان الذكي"), rightEdge, pageH - 6, { align: "right" });

  doc.save(`MIZAN_Loss_${response.range.from}_${response.range.to}.pdf`);
}

// ── Revenue Report PDF ────────────────────────────────────────────
type RevenueResponse = Extract<AiResponse, { kind: "revenue_report" }>;

export async function exportRevenuePDF(response: RevenueResponse): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 15;
  const rightEdge = pageW - margin;
  let y = margin;

  doc.setFillColor(...PRIMARY);
  doc.rect(0, 0, pageW, 25, "F");
  doc.setTextColor(...WHITE);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("MIZAN AI", rightEdge, 12, { align: "right" });
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(shapeArabic("تقرير التحصيل"), rightEdge, 18, { align: "right" });

  y = 32;
  doc.setTextColor(...DARK);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text(shapeArabic("تقرير التحصيل المالي"), pageW / 2, y, { align: "center" });
  y += 6;
  doc.setDrawColor(...PRIMARY);
  doc.setLineWidth(0.5);
  doc.line(margin, y, rightEdge, y);
  y += 6;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...MUTED);
  doc.text(`${shapeArabic("الفترة:")} ${response.range.label}`, rightEdge, y, { align: "right" });
  doc.text(`${response.range.from} → ${response.range.to}`, rightEdge - 40, y, { align: "right" });
  y += 8;

  // Summary boxes
  const boxW = (pageW - margin * 2 - 9) / 4;
  const boxH = 14;
  const stats = [
    { label: shapeArabic("نقدي"), value: fmtYERShort(response.totals.cash), color: DARK },
    { label: shapeArabic("الكريمي"), value: fmtYERShort(response.totals.bank), color: DARK },
    { label: shapeArabic("الإجمالي"), value: fmtYERShort(response.totals.total), color: OK },
    { label: shapeArabic("متوسط الدفعة"), value: fmtYERShort(response.totals.avg), color: DARK },
  ];
  stats.forEach((st, i) => {
    const x = margin + i * (boxW + 3);
    doc.setFillColor(...LIGHT);
    doc.roundedRect(x, y, boxW, boxH, 1.5, 1.5, "F");
    doc.setTextColor(...MUTED);
    doc.setFontSize(7);
    doc.text(st.label, x + boxW - 2, y + 5, { align: "right" });
    doc.setTextColor(...st.color);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(st.value, x + boxW - 2, y + 11, { align: "right" });
    doc.setFont("helvetica", "normal");
  });
  y += boxH + 6;

  doc.setTextColor(...MUTED);
  doc.setFontSize(9);
  doc.text(`${shapeArabic("عدد العمليات:")} ${response.totals.count}`, rightEdge, y, { align: "right" });
  y += 8;

  // Daily series table
  if (response.series.length > 0) {
    y = drawTable(doc, margin, y, pageW - margin * 2, shapeArabic("تفاصيل التحصيل اليومي"),
      [shapeArabic("التاريخ"), shapeArabic("نقدي"), shapeArabic("الكريمي"), shapeArabic("الإجمالي")],
      response.series.map((r) => [
        r.day,
        fmtYERShort(r.cash),
        fmtYERShort(r.bank),
        fmtYERShort(r.total),
      ]),
      pageH, true);
  }

  doc.setDrawColor(...LIGHT);
  doc.setLineWidth(0.3);
  doc.line(margin, pageH - 10, rightEdge, pageH - 10);
  doc.setTextColor(...MUTED);
  doc.setFontSize(7);
  doc.text(shapeArabic("صادر عن مساعد ميزان الذكي"), rightEdge, pageH - 6, { align: "right" });

  doc.save(`MIZAN_Revenue_${response.range.from}_${response.range.to}.pdf`);
}

// ── Payment Status PDF ────────────────────────────────────────────
type PaymentStatusResponse = Extract<AiResponse, { kind: "payment_status" }>;

export async function exportPaymentStatusPDF(response: PaymentStatusResponse): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 15;
  const rightEdge = pageW - margin;
  let y = margin;

  doc.setFillColor(...PRIMARY);
  doc.rect(0, 0, pageW, 25, "F");
  doc.setTextColor(...WHITE);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("MIZAN AI", rightEdge, 12, { align: "right" });
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(shapeArabic("تقرير حالة الدفع"), rightEdge, 18, { align: "right" });

  y = 32;
  doc.setTextColor(...DARK);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text(shapeArabic("تقرير الفواتير المدفوعة وغير المدفوعة"), pageW / 2, y, { align: "center" });
  y += 6;
  doc.setDrawColor(...PRIMARY);
  doc.setLineWidth(0.5);
  doc.line(margin, y, rightEdge, y);
  y += 8;

  // Paid table
  doc.setTextColor(...OK);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text(`${shapeArabic("مدفوعة")} (${response.paid.length})`, rightEdge, y, { align: "right" });
  y += 5;
  doc.setFont("helvetica", "normal");
  y = drawTable(doc, margin, y, pageW - margin * 2, "",
    [shapeArabic("رقم الفاتورة"), shapeArabic("الاسم"), shapeArabic("المبلغ")],
    response.paid.map((p) => [p.serial, p.name, fmtYERShort(p.total)]),
    pageH, true);

  // Unpaid table
  if (y > pageH - 40) { doc.addPage(); y = margin; }
  y += 5;
  doc.setTextColor(...DANGER);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text(`${shapeArabic("غير مدفوعة")} (${response.unpaid.length})`, rightEdge, y, { align: "right" });
  y += 5;
  doc.setFont("helvetica", "normal");
  y = drawTable(doc, margin, y, pageW - margin * 2, "",
    [shapeArabic("رقم الفاتورة"), shapeArabic("الاسم"), shapeArabic("المتبقي")],
    response.unpaid.map((p) => [p.serial, p.name, fmtYERShort(p.balance)]),
    pageH, true);

  doc.setDrawColor(...LIGHT);
  doc.setLineWidth(0.3);
  doc.line(margin, pageH - 10, rightEdge, pageH - 10);
  doc.setTextColor(...MUTED);
  doc.setFontSize(7);
  doc.text(shapeArabic("صادر عن مساعد ميزان الذكي"), rightEdge, pageH - 6, { align: "right" });

  doc.save(`MIZAN_PaymentStatus_${new Date().toISOString().slice(0, 10)}.pdf`);
}

function fmtNumShort(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}
