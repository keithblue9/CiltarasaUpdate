// Thermal-receipt style PDF (mirip struk kasir kecil) — pakai jsPDF.
// Berbeda dari invoice A5 — ini struk kasir simple dengan border zigzag.
import { jsPDF } from 'jspdf';

const fmtNum = (n) => Number(n || 0).toLocaleString('id-ID');

function fmtDate(iso) {
  if (!iso) return '-';
  try {
    const d = new Date(iso);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} - ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  } catch { return iso; }
}

const PAYMENT_LABEL = { transfer: 'Transfer', qris: 'QRIS', cod: 'COD', ewallet: 'E-Wallet' };

export function generateReceiptPdf(order, storeConfig) {
  // Pull configurable wording (with safe defaults)
  const rt = (storeConfig && storeConfig.receipt_texts) || {};
  const T = {
    date_label: rt.date_label || 'Tanggal',
    cashier_label: rt.cashier_label || 'Kasir',
    customer_label: rt.customer_label || 'Pelanggan',
    payment_method_label: rt.payment_method_label || 'Metode Bayar',
    delivery_fee_label: rt.delivery_fee_label || 'Ongkir',
    total_label: rt.total_label || 'Total',
    paid_label: rt.paid_label || 'DiBayar',
    notes_label: rt.notes_label || 'Catatan',
    transfer_section_title: rt.transfer_section_title || 'Pembayaran Transfer',
    footer_thanks: rt.footer_thanks || 'Terimakasih',
  };

  // Thermal-style: 80mm wide x dynamic height
  const W = 80; // mm
  // Estimate height: header(35) + items*8 + footer(50)
  const itemCount = (order.items || []).length;
  const H = 80 + itemCount * 8;

  const doc = new jsPDF({ unit: 'mm', format: [W, H], orientation: 'portrait' });
  const M = 4;
  let y = 8;

  // Header — store name
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(0, 0, 0);
  doc.text(storeConfig?.name || 'Ciltarasa', W / 2, y, { align: 'center' });
  y += 5;
  if (storeConfig?.tagline) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(storeConfig.tagline.slice(0, 40), W / 2, y, { align: 'center' });
    y += 4;
  }
  y += 1;

  // Meta info
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.text(T.date_label, M, y);
  doc.text(fmtDate(order.created_at), W - M, y, { align: 'right' });
  y += 3.5;
  doc.text(T.cashier_label, M, y);
  doc.text((storeConfig?.name || 'Seller').split(' ')[0], W - M, y, { align: 'right' });
  y += 3.5;
  doc.text(T.customer_label, M, y);
  doc.text((order.customer_name || '-').slice(0, 20), W - M, y, { align: 'right' });
  y += 3;

  // Divider (dashed)
  for (let x = M; x < W - M; x += 1.5) {
    doc.line(x, y, x + 0.8, y);
  }
  y += 3;

  // Items
  doc.setFontSize(8);
  for (const it of (order.items || [])) {
    doc.setFont('helvetica', 'normal');
    const name = (it.product_name || '-') + ', pack';
    doc.text(name.slice(0, 36), M, y);
    y += 3.5;
    const qtyLine = `  ${it.quantity} x ${fmtNum(it.price)}`;
    const subtotal = fmtNum(it.subtotal);
    doc.text(qtyLine, M, y);
    doc.text(subtotal, W - M, y, { align: 'right' });
    y += 4;
  }

  // Divider
  for (let x = M; x < W - M; x += 1.5) {
    doc.line(x, y, x + 0.8, y);
  }
  y += 3;

  // Totals
  doc.setFontSize(8);
  doc.text(T.payment_method_label, M, y);
  doc.text(PAYMENT_LABEL[order.payment_method] || order.payment_method || '-', W - M, y, { align: 'right' });
  y += 3.5;
  if (order.delivery_fee && order.delivery_fee > 0) {
    doc.text(T.delivery_fee_label, M, y);
    doc.text(fmtNum(order.delivery_fee), W - M, y, { align: 'right' });
    y += 3.5;
  }
  doc.setFont('helvetica', 'bold');
  doc.text(T.total_label, M, y);
  doc.text(fmtNum(order.total), W - M, y, { align: 'right' });
  y += 3.5;
  doc.text(T.paid_label, M, y);
  doc.text(fmtNum(order.total), W - M, y, { align: 'right' });
  y += 3.5;

  for (let x = M; x < W - M; x += 1.5) {
    doc.line(x, y, x + 0.8, y);
  }
  y += 3;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(`${T.notes_label} : ${(order.notes || '').slice(0, 30)}`, M, y);
  y += 5;

  // Payment info — bank accounts
  const banks = storeConfig?.bank_accounts || [];
  if (banks.length > 0 && order.payment_method === 'transfer') {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text(T.transfer_section_title, W / 2, y, { align: 'center' });
    y += 3.5;
    doc.setFont('helvetica', 'normal');
    for (const b of banks.slice(0, 3)) {
      doc.text(`${b.bank} : ${b.number} a.n ${b.name}`, W / 2, y, { align: 'center' });
      y += 3.5;
    }
    y += 1;
  }

  // Footer
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(T.footer_thanks, W / 2, y, { align: 'center' });

  const filename = `Resi-${order.order_number || order.id}.pdf`;
  doc.save(filename);
}
