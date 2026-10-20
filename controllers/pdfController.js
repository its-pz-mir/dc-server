const PDFDocument = require('pdfkit');

const COLORS = {
  navy: '#17352B',
  green: '#285641',
  gold: '#C49A53',
  ink: '#26352D',
  muted: '#718078',
  line: '#E4EAE5',
  pale: '#F5F8F5',
  white: '#FFFFFF',
  highlight: '#EEF5EF'
};

function numericValue(value, fallback = 0) {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number(String(value).replaceAll(',', ''));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatCurrency(value) {
  return `PKR ${new Intl.NumberFormat('en-PK', {
    maximumFractionDigits: 0
  }).format(value)}`;
}

exports.generateRegistryPdf = async (req, res) => {
  try {
    const {
      property_area,
      revenue_circle,
      tehsil,
      classification,
      marla_size,
      sqft_size,
      rate_per_marla,
      construction_rate_sqft,
      total_land_value,
      total_construction_value,
      total_property_value
    } = req.body;

    const marla = numericValue(marla_size);
    const sqft = numericValue(sqft_size);
    const rateMarla = numericValue(rate_per_marla);
    const rateSqft = numericValue(construction_rate_sqft);
    const landVal = numericValue(total_land_value, marla * rateMarla);
    const constructionVal = numericValue(total_construction_value, sqft * rateSqft);
    const totalVal = numericValue(total_property_value, landVal + constructionVal);

    const estamp = Math.round((totalVal * 0.01) + 1000);
    const corporation = Math.round(totalVal * 0.01);
    const plra = 3300;
    const commissionAndComparison = 6100 + 5100;
    const purchaserFilerTax = Math.round(totalVal * 0.0125);
    const purchaserInactiveTax = Math.round(totalVal * 0.045);
    const sellerFilerTax = Math.round(totalVal * 0.0275);
    const sellerInactiveTax = Math.round(totalVal * 0.115);
    const legalFees = 35000;

    const purchaserFilerTotal =
      estamp + corporation + plra + commissionAndComparison + purchaserFilerTax + legalFees;
    const purchaserInactiveTotal =
      estamp + corporation + plra + commissionAndComparison + purchaserInactiveTax + legalFees;

    const safePropertyName = String(property_area || 'Property')
      .replace(/[^\w.-]+/g, '_')
      .slice(0, 80);
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 36, bottom: 38, left: 42, right: 42 },
      info: {
        Title: 'Property Transfer and Registry Expenditure',
        Author: 'Al Aahad Associates',
        Subject: 'Property valuation and estimated registry costs'
      }
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=Registry_Expenditure_${safePropertyName}.pdf`
    );
    doc.pipe(res);

    const pageWidth = doc.page.width;
    const left = doc.page.margins.left;
    const right = pageWidth - doc.page.margins.right;
    const contentWidth = right - left;

    function sectionHeading(title, subtitle) {
      const y = doc.y;
      doc.fillColor(COLORS.green)
        .roundedRect(left, y, 4, 28, 2)
        .fill();
      doc.fillColor(COLORS.ink)
        .font('Helvetica-Bold')
        .fontSize(12)
        .text(title, left + 13, y + 1);
      if (subtitle) {
        doc.fillColor(COLORS.muted)
          .font('Helvetica')
          .fontSize(8)
          .text(subtitle, left + 13, y + 16);
      }
      doc.y = y + 36;
    }

    function drawRows(rows, options = {}) {
      const rowHeight = options.rowHeight ?? 23;
      rows.forEach((row, index) => {
        const y = doc.y;
        const isTotal = row.total === true;
        if (isTotal) {
          doc.save()
            .fillColor(COLORS.highlight)
            .roundedRect(left, y, contentWidth, rowHeight, 4)
            .fill()
            .restore();
        } else if (index % 2 === 0) {
          doc.save()
            .fillColor(COLORS.pale)
            .rect(left, y, contentWidth, rowHeight)
            .fill()
            .restore();
        }

        doc.fillColor(isTotal ? COLORS.green : COLORS.ink)
          .font(isTotal ? 'Helvetica-Bold' : 'Helvetica')
          .fontSize(isTotal ? 9.5 : 9)
          .text(row.label, left + 10, y + 6, {
            width: contentWidth - 180,
            lineBreak: false
          })
          .text(formatCurrency(row.amount), right - 160, y + 6, {
            width: 150,
            align: 'right',
            lineBreak: false
          });

        doc.y = y + rowHeight;
      });
      doc.moveDown(0.7);
    }

    function drawProfileCell(label, value, x, y, width) {
      doc.fillColor(COLORS.muted)
        .font('Helvetica-Bold')
        .fontSize(7.5)
        .text(label.toUpperCase(), x, y, { width });
      doc.fillColor(COLORS.ink)
        .font('Helvetica-Bold')
        .fontSize(9)
        .text(String(value || 'Not provided'), x, y + 12, {
          width,
          height: 24,
          ellipsis: true
        });
    }

    const headerHeight = 106;
    doc.save().fillColor(COLORS.navy).rect(0, 0, pageWidth, headerHeight).fill().restore();
    doc.save().fillColor(COLORS.gold).rect(0, headerHeight - 4, pageWidth, 4).fill().restore();
    doc.fillColor(COLORS.gold)
      .font('Helvetica-Bold')
      .fontSize(9)
      .text('AL AAHAD ASSOCIATES', left, 27, { characterSpacing: 1.5 });
    doc.fillColor(COLORS.white)
      .font('Helvetica-Bold')
      .fontSize(19)
      .text('Property Transfer Estimate', left, 46);
    doc.fillColor('#D5E2D9')
      .font('Helvetica')
      .fontSize(9)
      .text('Registry expenditure and valuation statement', left, 73);
    doc.save()
      .fillColor('#315747')
      .roundedRect(right - 112, 33, 112, 26, 13)
      .fill()
      .restore();
    doc.fillColor(COLORS.white)
      .font('Helvetica-Bold')
      .fontSize(8)
      .text('VALUATION REPORT', right - 102, 42, {
        width: 92,
        align: 'center',
        lineBreak: false
      });

    doc.y = headerHeight + 20;
    sectionHeading('Property profile', 'Matched official area and submitted property details');

    const profileY = doc.y;
    const profileHeight = 68;
    doc.save()
      .fillColor(COLORS.white)
      .roundedRect(left, profileY, contentWidth, profileHeight, 7)
      .fill()
      .lineWidth(0.8)
      .strokeColor(COLORS.line)
      .roundedRect(left, profileY, contentWidth, profileHeight, 7)
      .stroke()
      .restore();

    const cellGap = 15;
    const cellWidth = (contentWidth - 24 - cellGap * 2) / 3;
    drawProfileCell('Property area', property_area, left + 12, profileY + 11, cellWidth);
    drawProfileCell('Revenue circle', revenue_circle, left + 12 + cellWidth + cellGap, profileY + 11, cellWidth);
    drawProfileCell('Tehsil', tehsil, left + 12 + (cellWidth + cellGap) * 2, profileY + 11, cellWidth);
    drawProfileCell('Classification', classification || 'Residential', left + 12, profileY + 39, cellWidth);
    drawProfileCell('Land area', `${marla.toLocaleString('en-PK')} Marla`, left + 12 + cellWidth + cellGap, profileY + 39, cellWidth);
    drawProfileCell('Covered area', sqft > 0 ? `${sqft.toLocaleString('en-PK')} Sq. Ft.` : 'Not applicable', left + 12 + (cellWidth + cellGap) * 2, profileY + 39, cellWidth);
    doc.y = profileY + profileHeight + 17;

    sectionHeading('Property valuation', 'Official DC rates applied to the property size');
    const valuationRows = [
      { label: `Land rate (${marla.toLocaleString('en-PK')} Marla x ${formatCurrency(rateMarla)} / Marla)`, amount: landVal },
    ];
    if (sqft > 0) {
      valuationRows.push(
        { label: `Construction rate (${sqft.toLocaleString('en-PK')} Sq. Ft. x ${formatCurrency(rateSqft)} / Sq. Ft.)`, amount: constructionVal }
      );
    }
    valuationRows.push({ label: 'TOTAL PROPERTY VALUATION', amount: totalVal, total: true });
    drawRows(valuationRows, { rowHeight: 25 });

    sectionHeading('Estimated purchaser registry costs', 'Estimated government, professional and filing charges');
    drawRows([
      { label: 'E-Stamp duty (1% of value + PKR 1,000)', amount: estamp },
      { label: 'Corporation / TMA fee (1%)', amount: corporation },
      { label: 'PLRA fee', amount: plra },
      { label: 'Local commission and comparison fee', amount: commissionAndComparison },
      { label: 'FBR 236-K - active filer (1.25%)', amount: purchaserFilerTax },
      { label: 'Wakeel fees and miscellaneous expenses', amount: legalFees },
      { label: 'ESTIMATED TOTAL - ACTIVE FILER', amount: purchaserFilerTotal, total: true },
      { label: 'FBR 236-K - inactive filer (4.5%)', amount: purchaserInactiveTax },
      { label: 'ESTIMATED TOTAL - INACTIVE FILER', amount: purchaserInactiveTotal, total: true }
    ], { rowHeight: 22 });

    sectionHeading('Estimated seller tax', 'FBR 236-C estimates; seller charges are separate from purchaser costs');
    drawRows([
      { label: 'FBR 236-C - active filer (2.75%)', amount: sellerFilerTax },
      { label: 'FBR 236-C - inactive filer (11.5%)', amount: sellerInactiveTax }
    ], { rowHeight: 22 });

    const footerY = Math.min(doc.y + 2, doc.page.height - 49);
    doc.save()
      .strokeColor(COLORS.line)
      .lineWidth(0.8)
      .moveTo(left, footerY)
      .lineTo(right, footerY)
      .stroke()
      .restore();
    doc.fillColor(COLORS.muted)
      .font('Helvetica')
      .fontSize(7.5)
      .text('This estimate is for guidance only. Actual duties and charges may vary based on applicable rules and official assessment.', left, footerY + 8, {
        width: contentWidth,
        align: 'center'
      });
    doc.fillColor(COLORS.green)
      .font('Helvetica-Bold')
      .fontSize(8.5)
      .text('Made with Usman from Al Aahad Associates', left, footerY + 22, {
        width: contentWidth,
        align: 'center'
      });

    doc.end();
  } catch (error) {
    console.error('PDF Generation error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to generate PDF expenditure report.' });
    } else {
      res.destroy(error);
    }
  }
};
