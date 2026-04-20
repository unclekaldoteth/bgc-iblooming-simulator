import type {
  SimulationResultExport,
  SimulationResultExportDistributionGroup,
  SimulationResultExportFlag,
  SimulationResultExportMetric,
  SimulationResultExportMilestone,
  SimulationResultExportObjective
} from "../simulation-result";

type RgbColor = [number, number, number];
type FontKey = "F1" | "F2";

const COLORS = {
  accent: [0.063, 0.725, 0.506] as RgbColor,
  accentSoft: [0.91, 0.98, 0.953] as RgbColor,
  border: [0.84, 0.88, 0.92] as RgbColor,
  borderStrong: [0.67, 0.73, 0.8] as RgbColor,
  danger: [0.839, 0.153, 0.157] as RgbColor,
  dangerSoft: [0.995, 0.93, 0.935] as RgbColor,
  heading: [0.086, 0.137, 0.231] as RgbColor,
  info: [0.149, 0.388, 0.92] as RgbColor,
  infoSoft: [0.925, 0.953, 1] as RgbColor,
  muted: [0.353, 0.431, 0.537] as RgbColor,
  page: [1, 1, 1] as RgbColor,
  panel: [0.97, 0.978, 0.986] as RgbColor,
  text: [0.102, 0.133, 0.192] as RgbColor,
  warning: [0.878, 0.541, 0.039] as RgbColor,
  warningSoft: [1, 0.968, 0.89] as RgbColor
};

function escapePdfText(value: string) {
  return value
    .replace(/[•·]/g, "-")
    .replace(/[–—]/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/[^\x20-\x7E]/g, "?");
}

function formatColor(color: RgbColor) {
  return color.map((value) => value.toFixed(3)).join(" ");
}

function wrapText(text: string, width: number, fontSize: number) {
  const normalized = text.replace(/\s+/g, " ").trim();

  if (!normalized) {
    return [""];
  }

  const maxChars = Math.max(10, Math.floor(width / (fontSize * 0.52)));
  const words = normalized.split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    if (!current) {
      current = word;
      continue;
    }

    if (`${current} ${word}`.length <= maxChars) {
      current = `${current} ${word}`;
      continue;
    }

    lines.push(current);
    current = word;
  }

  if (current) {
    lines.push(current);
  }

  return lines;
}

class PdfLayout {
  readonly pageWidth = 612;
  readonly pageHeight = 792;
  readonly marginX = 42;
  readonly topStart = 760;
  readonly bottomMargin = 38;
  readonly contentWidth = this.pageWidth - this.marginX * 2;
  readonly pages: string[][] = [];
  cursorY = this.topStart;

  constructor() {
    this.startPage();
  }

  private startPage() {
    this.pages.push([]);
    this.cursorY = this.topStart;
    this.add(`q`);
    this.add(`${formatColor(COLORS.page)} rg`);
    this.add(`0 0 ${this.pageWidth} ${this.pageHeight} re f`);
    this.add(`Q`);
  }

  private add(command: string) {
    this.pages[this.pages.length - 1]?.push(command);
  }

  ensureSpace(height: number) {
    if (this.cursorY - height < this.bottomMargin) {
      this.startPage();
    }
  }

  gap(size: number) {
    this.cursorY -= size;
  }

  drawRect(x: number, yTop: number, width: number, height: number, options?: {
    fill?: RgbColor;
    stroke?: RgbColor;
    lineWidth?: number;
  }) {
    const bottom = yTop - height;
    this.add("q");
    if (options?.lineWidth) {
      this.add(`${options.lineWidth} w`);
    }
    if (options?.fill) {
      this.add(`${formatColor(options.fill)} rg`);
    }
    if (options?.stroke) {
      this.add(`${formatColor(options.stroke)} RG`);
    }
    this.add(`${x.toFixed(2)} ${bottom.toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re`);
    if (options?.fill && options?.stroke) {
      this.add("B");
    } else if (options?.fill) {
      this.add("f");
    } else if (options?.stroke) {
      this.add("S");
    }
    this.add("Q");
  }

  drawLine(x1: number, y1: number, x2: number, y2: number, color: RgbColor, lineWidth = 1) {
    this.add("q");
    this.add(`${formatColor(color)} RG`);
    this.add(`${lineWidth} w`);
    this.add(`${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S`);
    this.add("Q");
  }

  drawTextLine(text: string, x: number, y: number, options?: {
    font?: FontKey;
    size?: number;
    color?: RgbColor;
  }) {
    const font = options?.font ?? "F1";
    const size = options?.size ?? 10;
    const color = options?.color ?? COLORS.text;
    this.add("BT");
    this.add(`/${font} ${size} Tf`);
    this.add(`${formatColor(color)} rg`);
    this.add(`${x.toFixed(2)} ${y.toFixed(2)} Td`);
    this.add(`(${escapePdfText(text)}) Tj`);
    this.add("ET");
  }

  drawParagraph(text: string, x: number, yTop: number, width: number, options?: {
    font?: FontKey;
    size?: number;
    color?: RgbColor;
    lineHeight?: number;
  }) {
    const font = options?.font ?? "F1";
    const size = options?.size ?? 10;
    const color = options?.color ?? COLORS.text;
    const lineHeight = options?.lineHeight ?? size * 1.35;
    const lines = wrapText(text, width, size);
    let y = yTop;

    for (const line of lines) {
      this.drawTextLine(line, x, y, { font, size, color });
      y -= lineHeight;
    }

    return {
      height: lines.length * lineHeight,
      lines
    };
  }

  drawBulletList(items: string[], x: number, yTop: number, width: number, options?: {
    size?: number;
    color?: RgbColor;
  }) {
    const size = options?.size ?? 9;
    const lineHeight = size * 1.35;
    let y = yTop;
    let total = 0;

    for (const item of items) {
      const bulletX = x + 12;
      this.drawRect(x + 1, y + 2, 4, 4, {
        fill: COLORS.accent
      });
      const block = this.drawParagraph(item, bulletX, y, width - 12, {
        size,
        color: options?.color ?? COLORS.text,
        lineHeight
      });
      y -= block.height + 4;
      total += block.height + 4;
    }

    return total;
  }

  measureParagraph(text: string, width: number, size: number, lineHeight = size * 1.35) {
    return wrapText(text, width, size).length * lineHeight;
  }

  drawBadge(text: string, x: number, yTop: number, tone: "accent" | "warning" | "danger" | "info") {
    const palette = tone === "warning"
      ? { fill: COLORS.warningSoft, text: COLORS.warning }
      : tone === "danger"
        ? { fill: COLORS.dangerSoft, text: COLORS.danger }
        : tone === "info"
          ? { fill: COLORS.infoSoft, text: COLORS.info }
          : { fill: COLORS.accentSoft, text: COLORS.accent };
    const width = Math.max(74, text.length * 6.4 + 18);
    const height = 20;

    this.drawRect(x, yTop + 5, width, height, {
      fill: palette.fill
    });
    this.drawTextLine(text, x + 9, yTop - 8, {
      font: "F2",
      size: 9,
      color: palette.text
    });

    return width;
  }

  serialize() {
    const objects: string[] = [];
    const pageRefs: string[] = [];

    objects.push("<< /Type /Catalog /Pages 2 0 R >>");
    objects.push("<< /Type /Pages /Kids [] /Count 0 >>");
    objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
    objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");

    this.pages.forEach((commands, pageIndex) => {
      const footer = [
        "BT",
        "/F1 8 Tf",
        `${formatColor(COLORS.muted)} rg`,
        `${this.marginX.toFixed(2)} 18 Td`,
        `(BGC Alpha Simulator - Page ${pageIndex + 1} of ${this.pages.length}) Tj`,
        "ET"
      ];
      const content = [...commands, ...footer].join("\n");
      const pageObjectIndex = objects.length + 1;
      const contentObjectIndex = objects.length + 2;
      pageRefs.push(`${pageObjectIndex} 0 R`);

      objects.push(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${this.pageWidth} ${this.pageHeight}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentObjectIndex} 0 R >>`
      );
      objects.push(`<< /Length ${Buffer.byteLength(content, "utf8")} >>\nstream\n${content}\nendstream`);
    });

    objects[1] = `<< /Type /Pages /Kids [${pageRefs.join(" ")}] /Count ${pageRefs.length} >>`;

    let pdf = "%PDF-1.4\n";
    const offsets: number[] = [0];

    for (let index = 0; index < objects.length; index += 1) {
      offsets.push(Buffer.byteLength(pdf, "utf8"));
      pdf += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`;
    }

    const xrefOffset = Buffer.byteLength(pdf, "utf8");
    pdf += `xref\n0 ${objects.length + 1}\n`;
    pdf += "0000000000 65535 f \n";

    for (let index = 1; index < offsets.length; index += 1) {
      pdf += `${offsets[index].toString().padStart(10, "0")} 00000 n \n`;
    }

    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

    return Buffer.from(pdf, "utf8");
  }
}

function toneForStatus(status: string) {
  const normalized = status.toLowerCase();

  if (normalized.includes("review") || normalized.includes("warning")) {
    return "warning" as const;
  }

  if (normalized.includes("reject") || normalized.includes("fail")) {
    return "danger" as const;
  }

  if (normalized.includes("run") || normalized.includes("queue")) {
    return "info" as const;
  }

  return "accent" as const;
}

function drawHeader(layout: PdfLayout, report: SimulationResultExport) {
  const yTop = layout.cursorY;
  const heroHeight = 98;
  layout.drawRect(layout.marginX, yTop, layout.contentWidth, heroHeight, {
    fill: COLORS.heading
  });
  layout.drawRect(layout.marginX, yTop, 10, heroHeight, {
    fill: COLORS.accent
  });
  layout.drawTextLine("Simulation Result Export", layout.marginX + 26, yTop - 28, {
    font: "F1",
    size: 11,
    color: [0.78, 0.86, 0.94]
  });
  layout.drawTextLine(report.ref, layout.marginX + layout.contentWidth - 120, yTop - 28, {
    font: "F2",
    size: 11,
    color: [0.87, 0.98, 0.94]
  });
  layout.drawParagraph(report.title, layout.marginX + 26, yTop - 50, layout.contentWidth - 52, {
    font: "F2",
    size: 21,
    color: [1, 1, 1],
    lineHeight: 25
  });
  layout.drawParagraph(
    "Full export of Summary, Distribution, Treasury, and Decision Pack for this simulation run.",
    layout.marginX + 26,
    yTop - 78,
    layout.contentWidth - 52,
    {
      size: 10,
      color: [0.8, 0.87, 0.93]
    }
  );
  layout.cursorY = yTop - heroHeight - 16;
}

function drawContextGrid(layout: PdfLayout, report: SimulationResultExport) {
  const items = [
    ["Scenario", report.scenarioName],
    ["Snapshot", report.snapshotName],
    ["Model", report.modelVersionName],
    ["Status", report.status],
    ["Created", report.createdAt],
    ["Completed", report.completedAt]
  ];
  const columns = 2;
  const gap = 12;
  const cardWidth = (layout.contentWidth - gap) / columns;
  const rowHeight = 54;
  const totalHeight = rowHeight * 3 + gap * 2;

  layout.ensureSpace(totalHeight);
  let yTop = layout.cursorY;

  items.forEach(([label, value], index) => {
    const row = Math.floor(index / columns);
    const col = index % columns;
    const x = layout.marginX + col * (cardWidth + gap);
    const top = yTop - row * (rowHeight + gap);

    layout.drawRect(x, top, cardWidth, rowHeight, {
      fill: COLORS.panel,
      stroke: COLORS.border
    });
    layout.drawTextLine(label, x + 14, top - 18, {
      font: "F2",
      size: 8.5,
      color: COLORS.muted
    });
    layout.drawParagraph(value, x + 14, top - 34, cardWidth - 28, {
      font: "F2",
      size: 11,
      color: COLORS.text,
      lineHeight: 13
    });
  });

  layout.cursorY -= totalHeight + 22;
}

function drawSectionTitle(layout: PdfLayout, title: string, subtitle?: string) {
  const required = subtitle ? 38 : 24;
  layout.ensureSpace(required);
  const yTop = layout.cursorY;
  layout.drawLine(layout.marginX, yTop - 6, layout.marginX + 18, yTop - 6, COLORS.accent, 2.5);
  layout.drawTextLine(title, layout.marginX + 24, yTop, {
    font: "F2",
    size: 15,
    color: COLORS.heading
  });
  if (subtitle) {
    layout.drawParagraph(subtitle, layout.marginX + 24, yTop - 15, layout.contentWidth - 24, {
      size: 9,
      color: COLORS.muted
    });
    layout.cursorY -= 34;
    return;
  }
  layout.cursorY -= 24;
}

function drawMetricCards(layout: PdfLayout, metrics: SimulationResultExportMetric[], columns = 2) {
  const gap = 12;
  const cardWidth = (layout.contentWidth - gap * (columns - 1)) / columns;
  const padding = 14;
  let rowMetrics: SimulationResultExportMetric[] = [];

  const measureHeight = (metric: SimulationResultExportMetric) => {
    const descriptionHeight = metric.description
      ? layout.measureParagraph(metric.description, cardWidth - padding * 2, 8)
      : 0;

    return 58 + descriptionHeight;
  };

  const drawRow = (items: SimulationResultExportMetric[]) => {
    const rowHeight = Math.max(...items.map(measureHeight));
    layout.ensureSpace(rowHeight);
    const yTop = layout.cursorY;

    items.forEach((metric, index) => {
      const x = layout.marginX + index * (cardWidth + gap);
      layout.drawRect(x, yTop, cardWidth, rowHeight, {
        fill: COLORS.panel,
        stroke: COLORS.border
      });
      layout.drawRect(x, yTop, cardWidth, 6, {
        fill: COLORS.accent
      });
      layout.drawTextLine(metric.label.toUpperCase(), x + padding, yTop - 22, {
        font: "F2",
        size: 8,
        color: COLORS.muted
      });
      layout.drawTextLine(metric.value, x + padding, yTop - 42, {
        font: "F2",
        size: 15,
        color: COLORS.heading
      });
      if (metric.description) {
        layout.drawParagraph(metric.description, x + padding, yTop - 58, cardWidth - padding * 2, {
          size: 8,
          color: COLORS.muted
        });
      }
    });

    layout.cursorY -= rowHeight + gap;
  };

  for (const metric of metrics) {
    rowMetrics.push(metric);

    if (rowMetrics.length === columns) {
      drawRow(rowMetrics);
      rowMetrics = [];
    }
  }

  if (rowMetrics.length > 0) {
    drawRow(rowMetrics);
  }
}

function drawFlagsTable(layout: PdfLayout, flags: SimulationResultExportFlag[]) {
  const headers = ["Severity", "Type", "Period", "Message"];
  const columnWidths = [80, 120, 110, layout.contentWidth - 310];
  const x = layout.marginX;
  const padding = 8;
  const headerHeight = 24;

  const drawHeader = () => {
    layout.ensureSpace(headerHeight);
    const yTop = layout.cursorY;
    let cellX = x;

    headers.forEach((header, index) => {
      layout.drawRect(cellX, yTop, columnWidths[index], headerHeight, {
        fill: COLORS.heading
      });
      layout.drawTextLine(header, cellX + padding, yTop - 16, {
        font: "F2",
        size: 8.5,
        color: [1, 1, 1]
      });
      cellX += columnWidths[index];
    });

    layout.cursorY -= headerHeight;
  };

  if (flags.length === 0) {
    layout.ensureSpace(44);
    layout.drawRect(x, layout.cursorY, layout.contentWidth, 40, {
      fill: COLORS.panel,
      stroke: COLORS.border
    });
    layout.drawTextLine("No risk flags for this run.", x + 12, layout.cursorY - 24, {
      size: 9.5,
      color: COLORS.muted
    });
    layout.cursorY -= 52;
    return;
  }

  drawHeader();

  for (const flag of flags) {
    const cells = [flag.severity, flag.type, flag.period || "All periods", flag.message];
    const lineHeights = cells.map((cell, index) =>
      layout.measureParagraph(cell, columnWidths[index] - padding * 2, 8.8, 11)
    );
    const rowHeight = Math.max(...lineHeights, 16) + padding * 2;

    if (layout.cursorY - rowHeight < layout.bottomMargin) {
      layout.gap(12);
      drawHeader();
    }

    let cellX = x;
    const yTop = layout.cursorY;

    cells.forEach((cell, index) => {
      layout.drawRect(cellX, yTop, columnWidths[index], rowHeight, {
        fill: [1, 1, 1],
        stroke: COLORS.border
      });
      layout.drawParagraph(cell, cellX + padding, yTop - 15, columnWidths[index] - padding * 2, {
        size: 8.8,
        color: index === 0 ? COLORS.heading : COLORS.text,
        font: index === 0 ? "F2" : "F1",
        lineHeight: 11
      });
      cellX += columnWidths[index];
    });

    layout.cursorY -= rowHeight;
  }

  layout.gap(16);
}

function drawDistributionGroup(layout: PdfLayout, group: SimulationResultExportDistributionGroup) {
  drawSectionTitle(layout, group.title);
  const headers = ["Segment", "Measure", "Value"];
  const widths = [150, layout.contentWidth - 250, 100];
  const x = layout.marginX;
  const padding = 8;
  const headerHeight = 24;

  const drawHeader = () => {
    layout.ensureSpace(headerHeight);
    let cellX = x;
    const yTop = layout.cursorY;

    headers.forEach((header, index) => {
      layout.drawRect(cellX, yTop, widths[index], headerHeight, {
        fill: COLORS.panel,
        stroke: COLORS.borderStrong
      });
      layout.drawTextLine(header, cellX + padding, yTop - 16, {
        font: "F2",
        size: 8.5,
        color: COLORS.heading
      });
      cellX += widths[index];
    });

    layout.cursorY -= headerHeight;
  };

  if (group.rows.length === 0) {
    layout.ensureSpace(36);
    layout.drawRect(x, layout.cursorY, layout.contentWidth, 32, {
      fill: [1, 1, 1],
      stroke: COLORS.border
    });
    layout.drawTextLine("No distribution rows.", x + 10, layout.cursorY - 20, {
      size: 9,
      color: COLORS.muted
    });
    layout.cursorY -= 44;
    return;
  }

  drawHeader();

  for (const row of group.rows) {
    const cells = [row.segment, row.measure, row.value];
    const rowHeight =
      Math.max(
        ...cells.map((cell, index) => layout.measureParagraph(cell, widths[index] - padding * 2, 8.8, 11))
      ) + padding * 2;

    if (layout.cursorY - rowHeight < layout.bottomMargin) {
      layout.gap(10);
      drawHeader();
    }

    const yTop = layout.cursorY;
    let cellX = x;

    cells.forEach((cell, index) => {
      layout.drawRect(cellX, yTop, widths[index], rowHeight, {
        fill: [1, 1, 1],
        stroke: COLORS.border
      });
      layout.drawParagraph(cell, cellX + padding, yTop - 15, widths[index] - padding * 2, {
        size: 8.8,
        color: index === 2 ? COLORS.heading : COLORS.text,
        font: index === 2 ? "F2" : "F1",
        lineHeight: 11
      });
      cellX += widths[index];
    });

    layout.cursorY -= rowHeight;
  }

  layout.gap(16);
}

function drawDecisionHero(layout: PdfLayout, report: SimulationResultExport) {
  const height = 92;
  layout.ensureSpace(height);
  const yTop = layout.cursorY;

  layout.drawRect(layout.marginX, yTop, layout.contentWidth, height, {
    fill: COLORS.panel,
    stroke: COLORS.borderStrong
  });
  layout.drawTextLine(report.decisionPack.title, layout.marginX + 16, yTop - 22, {
    font: "F2",
    size: 16,
    color: COLORS.heading
  });
  layout.drawBadge(
    report.decisionPack.verdict,
    layout.marginX + layout.contentWidth - 110,
    yTop - 12,
    toneForStatus(report.decisionPack.verdict)
  );
  layout.drawParagraph(
    report.decisionPack.recommendation,
    layout.marginX + 16,
    yTop - 48,
    layout.contentWidth - 32,
    {
      size: 10,
      color: COLORS.text,
      lineHeight: 13
    }
  );
  layout.cursorY -= height + 16;
}

function drawListCards(layout: PdfLayout, leftTitle: string, leftItems: string[], rightTitle: string, rightItems: string[]) {
  const gap = 12;
  const width = (layout.contentWidth - gap) / 2;
  const padding = 14;
  const measureCard = (title: string, items: string[]) => {
    const header = 34;
    const body = items.length === 0
      ? layout.measureParagraph("None.", width - padding * 2, 9, 12)
      : items.reduce((sum, item) => sum + layout.measureParagraph(item, width - padding * 2 - 12, 9, 12) + 4, 0);
    return header + body + padding;
  };
  const cardHeight = Math.max(measureCard(leftTitle, leftItems), measureCard(rightTitle, rightItems));

  layout.ensureSpace(cardHeight);
  const yTop = layout.cursorY;

  const drawCard = (x: number, title: string, items: string[], tone: "accent" | "danger") => {
    layout.drawRect(x, yTop, width, cardHeight, {
      fill: COLORS.panel,
      stroke: COLORS.border
    });
    layout.drawRect(x, yTop, width, 6, {
      fill: tone === "danger" ? COLORS.danger : COLORS.accent
    });
    layout.drawTextLine(title, x + padding, yTop - 24, {
      font: "F2",
      size: 12,
      color: COLORS.heading
    });

    if (items.length === 0) {
      layout.drawTextLine("None.", x + padding, yTop - 46, {
        size: 9,
        color: COLORS.muted
      });
      return;
    }

    layout.drawBulletList(items, x + padding, yTop - 46, width - padding * 2, {
      size: 9
    });
  };

  drawCard(layout.marginX, leftTitle, leftItems, "accent");
  drawCard(layout.marginX + width + gap, rightTitle, rightItems, "danger");
  layout.cursorY -= cardHeight + 18;
}

function drawObjectiveCards(layout: PdfLayout, objectives: SimulationResultExportObjective[]) {
  if (objectives.length === 0) {
    layout.ensureSpace(44);
    layout.drawRect(layout.marginX, layout.cursorY, layout.contentWidth, 40, {
      fill: COLORS.panel,
      stroke: COLORS.border
    });
    layout.drawTextLine("No strategic goals.", layout.marginX + 14, layout.cursorY - 24, {
      size: 9.5,
      color: COLORS.muted
    });
    layout.cursorY -= 52;
    return;
  }

  for (const objective of objectives) {
    const padding = 14;
    const bodyWidth = layout.contentWidth - padding * 2;
    const primaryHeight = objective.primaryMetrics.length > 0
      ? objective.primaryMetrics.reduce((sum, item) => sum + layout.measureParagraph(item, bodyWidth - 12, 8.8, 11) + 3, 0)
      : 14;
    const reasonsHeight = objective.reasons.length > 0
      ? objective.reasons.reduce((sum, item) => sum + layout.measureParagraph(item, bodyWidth - 12, 8.8, 11) + 3, 0)
      : 14;
    const height = 92 + primaryHeight + reasonsHeight;

    layout.ensureSpace(height);
    const yTop = layout.cursorY;

    layout.drawRect(layout.marginX, yTop, layout.contentWidth, height, {
      fill: COLORS.panel,
      stroke: COLORS.border
    });
    layout.drawTextLine(objective.title, layout.marginX + padding, yTop - 22, {
      font: "F2",
      size: 12.5,
      color: COLORS.heading
    });
    layout.drawBadge(
      objective.status,
      layout.marginX + layout.contentWidth - 108,
      yTop - 13,
      toneForStatus(objective.status)
    );
    layout.drawTextLine(`Evidence: ${objective.evidence}`, layout.marginX + padding, yTop - 42, {
      size: 8.8,
      color: COLORS.muted
    });
    layout.drawTextLine(`Score: ${objective.score}`, layout.marginX + 170, yTop - 42, {
      font: "F2",
      size: 8.8,
      color: COLORS.text
    });

    let bodyY = yTop - 62;
    layout.drawTextLine("Primary Metrics", layout.marginX + padding, bodyY, {
      font: "F2",
      size: 9,
      color: COLORS.heading
    });
    bodyY -= 14;
    if (objective.primaryMetrics.length === 0) {
      layout.drawTextLine("None.", layout.marginX + padding, bodyY, {
        size: 8.8,
        color: COLORS.muted
      });
      bodyY -= 16;
    } else {
      bodyY -= layout.drawBulletList(objective.primaryMetrics, layout.marginX + padding, bodyY, bodyWidth, {
        size: 8.8
      });
    }

    layout.drawTextLine("Reasons", layout.marginX + padding, bodyY, {
      font: "F2",
      size: 9,
      color: COLORS.heading
    });
    bodyY -= 14;
    if (objective.reasons.length === 0) {
      layout.drawTextLine("None.", layout.marginX + padding, bodyY, {
        size: 8.8,
        color: COLORS.muted
      });
    } else {
      layout.drawBulletList(objective.reasons, layout.marginX + padding, bodyY, bodyWidth, {
        size: 8.8
      });
    }

    layout.cursorY -= height + 14;
  }
}

function drawMilestoneTable(layout: PdfLayout, milestones: SimulationResultExportMilestone[]) {
  const headers = ["Milestone", "Status", "Pressure", "Runway", "Top 10%", "Net Delta", "Reasons"];
  const widths = [112, 70, 58, 70, 58, 82, layout.contentWidth - 450];
  const x = layout.marginX;
  const padding = 7;
  const headerHeight = 24;

  const drawHeader = () => {
    layout.ensureSpace(headerHeight);
    const yTop = layout.cursorY;
    let cellX = x;

    headers.forEach((header, index) => {
      layout.drawRect(cellX, yTop, widths[index], headerHeight, {
        fill: COLORS.heading
      });
      layout.drawTextLine(header, cellX + padding, yTop - 16, {
        font: "F2",
        size: 8,
        color: [1, 1, 1]
      });
      cellX += widths[index];
    });

    layout.cursorY -= headerHeight;
  };

  if (milestones.length === 0) {
    layout.ensureSpace(40);
    layout.drawRect(x, layout.cursorY, layout.contentWidth, 36, {
      fill: COLORS.panel,
      stroke: COLORS.border
    });
    layout.drawTextLine("No milestone checkpoints.", x + 12, layout.cursorY - 23, {
      size: 9,
      color: COLORS.muted
    });
    layout.cursorY -= 48;
    return;
  }

  drawHeader();

  for (const milestone of milestones) {
    const cells = [
      `${milestone.title} (${milestone.period})`,
      milestone.status,
      milestone.pressure,
      milestone.runway,
      milestone.topShare,
      milestone.netDelta ?? "n/a",
      milestone.reasons.join("; ")
    ];
    const rowHeight =
      Math.max(...cells.map((cell, index) => layout.measureParagraph(cell, widths[index] - padding * 2, 8, 10))) +
      padding * 2;

    if (layout.cursorY - rowHeight < layout.bottomMargin) {
      layout.gap(10);
      drawHeader();
    }

    const yTop = layout.cursorY;
    let cellX = x;

    cells.forEach((cell, index) => {
      layout.drawRect(cellX, yTop, widths[index], rowHeight, {
        fill: [1, 1, 1],
        stroke: COLORS.border
      });
      layout.drawParagraph(cell, cellX + padding, yTop - 13, widths[index] - padding * 2, {
        size: 8,
        color: index === 2 ? COLORS.heading : COLORS.text,
        font: index === 2 ? "F2" : "F1",
        lineHeight: 10
      });
      cellX += widths[index];
    });

    layout.cursorY -= rowHeight;
  }

  layout.gap(16);
}

function drawQuestionsCard(layout: PdfLayout, questions: string[]) {
  const padding = 14;
  const bodyWidth = layout.contentWidth - padding * 2;
  const bodyHeight = questions.length === 0
    ? 18
    : questions.reduce((sum, question) => sum + layout.measureParagraph(question, bodyWidth - 12, 9, 12) + 4, 0);
  const height = 44 + bodyHeight;

  layout.ensureSpace(height);
  const yTop = layout.cursorY;

  layout.drawRect(layout.marginX, yTop, layout.contentWidth, height, {
    fill: COLORS.panel,
    stroke: COLORS.border
  });
  layout.drawTextLine("Unresolved Questions", layout.marginX + padding, yTop - 22, {
    font: "F2",
    size: 12,
    color: COLORS.heading
  });

  if (questions.length === 0) {
    layout.drawTextLine("None.", layout.marginX + padding, yTop - 44, {
      size: 9,
      color: COLORS.muted
    });
  } else {
    layout.drawBulletList(questions, layout.marginX + padding, yTop - 44, bodyWidth, {
      size: 9
    });
  }

  layout.cursorY -= height + 12;
}

export function renderSimulationResultStyledPdf(report: SimulationResultExport) {
  const layout = new PdfLayout();

  drawHeader(layout, report);
  drawContextGrid(layout, report);

  drawSectionTitle(layout, "Summary", "Top-line outcome metrics for this simulation run.");
  drawMetricCards(layout, report.summary, 2);

  drawSectionTitle(layout, "Treasury", "Treasury health, pressure, and reserve durability metrics.");
  drawMetricCards(layout, report.treasury, 2);

  drawSectionTitle(layout, "Risk Flags", "Warnings and issues detected during the run.");
  drawFlagsTable(layout, report.flags);

  drawSectionTitle(layout, "Distribution", "Segment breakdowns shown in the simulation result.");
  if (report.distribution.length === 0) {
    layout.ensureSpace(42);
    layout.drawRect(layout.marginX, layout.cursorY, layout.contentWidth, 38, {
      fill: COLORS.panel,
      stroke: COLORS.border
    });
    layout.drawTextLine("No distribution groups available.", layout.marginX + 12, layout.cursorY - 22, {
      size: 9.2,
      color: COLORS.muted
    });
    layout.cursorY -= 50;
  } else {
    for (const group of report.distribution) {
      drawDistributionGroup(layout, group);
    }
  }

  drawSectionTitle(layout, "Decision Pack", "Verdict, scenario evidence, blockers, goals, and milestone checkpoints.");
  drawDecisionHero(layout, report);
  drawListCards(
    layout,
    "Evaluated Scenario Basis",
    report.decisionPack.preferredSettings,
    "Blockers / Rejection Reasons",
    report.decisionPack.rejectedSettings
  );

  drawSectionTitle(layout, "Strategic Goals");
  drawObjectiveCards(layout, report.decisionPack.strategicObjectives);

  drawSectionTitle(layout, "Milestone Checkpoints");
  drawMilestoneTable(layout, report.decisionPack.milestoneCheckpoints);

  drawQuestionsCard(layout, report.decisionPack.unresolvedQuestions);

  return layout.serialize();
}
