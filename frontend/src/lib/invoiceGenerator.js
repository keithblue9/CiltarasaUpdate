// Utility untuk generate PDF invoice/struk pembelian client-side via jsPDF.
// Wording semua diambil dari storeConfig.invoice_texts (configurable seller).
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const fmtRp = (n) => `Rp ${Number(n || 0).toLocaleString('id-ID')}`;

const fmtDate = (iso) => {
  if (!iso) return '-';
  try {
    return new Date(iso).toLocaleString('id-ID', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    }) + ' WIB';
  } catch { return iso; }
};

const STATUS_LABEL_ID = {
  menunggu: 'Menunggu Konfirmasi', diproses: 'Diproses',
  siap: 'Siap Diambil/Dikirim', selesai: 'Selesai', dibatalkan: 'Dibatalkan',
};

const PAYMENT_LABEL = {
  transfer: 'Transfer Bank', qris: 'QRIS', cod: 'COD (Tunai)', ewallet: 'E-Wallet', card: 'Kartu',
};

export function generateInvoicePdf(order, storeConfig) {
  const texts = storeConfig?.invoice_texts || {};
  const T = (k, fb) => texts[k] || fb;

  const doc = new jsPDF({ unit: 'mm', format: 'a5', orientation: 'portrait' });
  const W = doc.internal.pageSize.getWidth();
  const M = 12; // margin
  let y = M;

  // ─── Header (Logo + Store Name) ─────────────────────────────────────
  const storeName = storeConfig?.name || 'Ciltarasa';
  const tagline = storeConfig?.tagline || '';
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(217, 119, 6); // amber-600
  doc.text(storeName.toUpperCase(), M, y);
  y += 5;
  if (tagline) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(120, 53, 15); // amber-900
    doc.text(tagline, M, y);
    y += 4;
  }
  if (storeConfig?.address) {
    doc.setFontSize(7);
    doc.setTextColor(100, 100, 100);
    doc.text(storeConfig.address.slice(0, 80), M, y);
    y += 3.5;
  }
  if (storeConfig?.whatsapp) {
    doc.setFontSize(7);
    doc.text(`WhatsApp: +${storeConfig.whatsapp}`, M, y);
    y += 3.5;
  }

  // Divider
  y += 1;
  doc.setDrawColor(217, 119, 6);
  doc.setLineWidth(0.5);
  doc.line(M, y, W - M, y);
  y += 6;

  // ─── Title ────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(60, 30, 0);
  doc.text(T('title', 'INVOICE'), W / 2, y, { align: 'center' });
  y += 4.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(120, 53, 15);
  doc.text(T('subtitle', 'Terima kasih telah berbelanja'), W / 2, y, { align: 'center' });
  y += 6;

  // ─── Order meta (2 cols) ──────────────────────────────────────────
  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);
  const metaLeft = [
    [T('order_number_label', 'No. Pesanan'), '#' + (order.order_number || '-')],
    [T('order_date_label', 'Tanggal'), fmtDate(order.created_at)],
  ];
  const metaRight = [
    [T('payment_method_label', 'Metode Bayar'), PAYMENT_LABEL[order.payment_method] || order.payment_method || '-'],
    [T('delivery_method_label', 'Pengiriman'), order.delivery_method === 'pickup' ? 'Ambil Sendiri' : 'Diantar'],
  ];
  const metaY = y;
  metaLeft.forEach(([k, v], i) => {
    doc.setFont('helvetica', 'normal'); doc.text(k + ':', M, metaY + i * 5);
    doc.setFont('helvetica', 'bold'); doc.text(String(v), M + 22, metaY + i * 5);
  });
  metaRight.forEach(([k, v], i) => {
    doc.setFont('helvetica', 'normal'); doc.text(k + ':', W / 2, metaY + i * 5);
    doc.setFont('helvetica', 'bold'); doc.text(String(v), W / 2 + 25, metaY + i * 5);
  });
  y = metaY + 5 * Math.max(metaLeft.length, metaRight.length) + 2;

  // ─── Buyer Section ────────────────────────────────────────────────
  doc.setFillColor(254, 243, 199); // amber-100
  doc.rect(M, y, W - 2 * M, 5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(120, 53, 15);
  doc.text(T('buyer_section_label', 'DITAGIH KEPADA'), M + 1.5, y + 3.5);
  y += 7;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(40, 40, 40);
  doc.text(`${order.customer_name || '-'}`, M, y);
  y += 4;
  doc.text(`+${order.customer_phone || '-'}`, M, y);
  y += 4;
  if (order.customer_address) {
    const addrLines = doc.splitTextToSize(order.customer_address, W - 2 * M);
    addrLines.forEach((line) => { doc.text(line, M, y); y += 3.5; });
  }
  y += 2;

  // ─── Items Table ──────────────────────────────────────────────────
  doc.setFillColor(254, 243, 199);
  doc.rect(M, y, W - 2 * M, 5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(120, 53, 15);
  doc.text(T('items_section_label', 'RINCIAN PESANAN'), M + 1.5, y + 3.5);
  y += 6;

  const rows = (order.items || []).map(it => [
    it.product_name,
    String(it.quantity),
    fmtRp(it.price),
    fmtRp(it.subtotal),
  ]);

  autoTable(doc, {
    startY: y,
    head: [['Produk', 'Qty', 'Harga', 'Subtotal']],
    body: rows,
    theme: 'striped',
    margin: { left: M, right: M },
    styles: { fontSize: 7.5, cellPadding: 1.5 },
    headStyles: { fillColor: [217, 119, 6], textColor: 255, halign: 'left' },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { cellWidth: 10, halign: 'center' },
      2: { cellWidth: 22, halign: 'right' },
      3: { cellWidth: 25, halign: 'right' },
    },
  });
  y = doc.lastAutoTable.finalY + 4;

  // ─── Summary ───────────────────────────────────────────────────────
  const sumX = W - M - 50;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(60, 60, 60);
  const subtotal = order.subtotal || 0;
  const deliveryFee = order.delivery_fee || 0;
  doc.text(T('subtotal_label', 'Subtotal') + ':', sumX, y);
  doc.text(fmtRp(subtotal), W - M, y, { align: 'right' });
  y += 4.5;
  if (deliveryFee > 0) {
    doc.text(T('delivery_fee_label', 'Ongkir') + ':', sumX, y);
    doc.text(fmtRp(deliveryFee), W - M, y, { align: 'right' });
    y += 4.5;
  }
  doc.setDrawColor(217, 119, 6);
  doc.line(sumX, y - 1, W - M, y - 1);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(217, 119, 6);
  doc.text(T('total_label', 'TOTAL') + ':', sumX, y + 4);
  doc.text(fmtRp(order.total), W - M, y + 4, { align: 'right' });
  y += 10;

  // ─── Notes ─────────────────────────────────────────────────────────
  if (order.notes) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(120, 53, 15);
    doc.text(T('notes_label', 'Catatan') + ':', M, y);
    y += 4;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60, 60, 60);
    const nLines = doc.splitTextToSize(order.notes, W - 2 * M);
    nLines.forEach((line) => { doc.text(line, M, y); y += 3.5; });
    y += 2;
  }

  // ─── Status Badge ──────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  const statusLabel = STATUS_LABEL_ID[order.status] || order.status || '-';
  const isFinal = order.status === 'selesai';
  doc.setFillColor(isFinal ? 220 : 254, isFinal ? 252 : 243, isFinal ? 231 : 199);
  doc.setTextColor(isFinal ? 22 : 120, isFinal ? 101 : 53, isFinal ? 52 : 15);
  doc.roundedRect(M, y, 45, 5, 1, 1, 'F');
  doc.text(`Status: ${statusLabel}`, M + 2, y + 3.5);
  y += 8;

  // ─── Footer ────────────────────────────────────────────────────────
  doc.setDrawColor(217, 119, 6);
  doc.setLineDashPattern([1, 1], 0);
  doc.line(M, y, W - M, y);
  doc.setLineDashPattern([], 0);
  y += 4;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(217, 119, 6);
  doc.text(T('footer_thanks', 'Terima kasih!'), W / 2, y, { align: 'center' });
  y += 4;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(120, 53, 15);
  doc.text(T('footer_contact', 'Hubungi kami via WhatsApp jika ada keluhan'), W / 2, y, { align: 'center' });
  y += 3.5;
  doc.setFontSize(6.5);
  doc.setTextColor(140, 140, 140);
  doc.text(T('footer_disclaimer', 'Struk ini adalah bukti pembayaran sah.'), W / 2, y, { align: 'center' });

  // ─── Generate filename & save ──────────────────────────────────────
  const filename = `Invoice-${order.order_number || order.id}.pdf`;
  doc.save(filename);
}
