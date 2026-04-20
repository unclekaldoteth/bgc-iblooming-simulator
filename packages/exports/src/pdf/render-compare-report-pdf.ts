import type {
  CompareReportExport,
  CompareReportExportCell,
  CompareReportExportRun,
  CompareReportExportTable,
  CompareReportTone
} from "../compare-report";

type RgbColor = [number, number, number];
type FontKey = "F1" | "F2";

const COLORS = {
  accent: [0.063, 0.725, 0.506] as RgbColor,
  accentSoft: [0.91, 0.98, 0.953] as RgbColor,
  accentStrong: [0.047, 0.557, 0.392] as RgbColor,
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
  panelStrong: [0.944, 0.959, 0.974] as RgbColor,
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

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function mixColor(color: RgbColor, target: RgbColor, ratio: number): RgbColor {
  return [
    color[0] + (target[0] - color[0]) * ratio,
    color[1] + (target[1] - color[1]) * ratio,
    color[2] + (target[2] - color[2]) * ratio
  ];
}

function hexToRgb(value: string): RgbColor {
  const normalized = value.replace("#", "");
  const full = normalized.length === 3
    ? normalized
        .split("")
        .map((segment) => `${segment}${segment}`)
        .join("")
    : normalized;

  return [
    Number.parseInt(full.slice(0, 2), 16) / 255,
    Number.parseInt(full.slice(2, 4), 16) / 255,
    Number.parseInt(full.slice(4, 6), 16) / 255
  ];
}

function tonePalette(tone: CompareReportTone) {
  switch (tone) {
    case "warning":
      return { fill: COLORS.warningSoft, text: COLORS.warning };
    case "danger":
      return { fill: COLORS.dangerSoft, text: COLORS.danger };
    case "info":
      return { fill: COLORS.infoSoft, text: COLORS.info };
    case "accent":
      return { fill: COLORS.accentSoft, text: COLORS.accentStrong };
    default:
      return { fill: COLORS.panelStrong, text: COLORS.muted };
  }
}

function emphasisColor(emphasis: CompareReportExportCell["emphasis"]) {
  if (emphasis === "best") {
    return COLORS.accentStrong;
  }

  if (emphasis === "worst") {
    return COLORS.danger;
  }

  return COLORS.text;
}

class PdfLayout {
  readonly pageWidth = 792;
  readonly pageHeight = 612;
  readonly marginX = 34;
  readonly topStart = 574;
  readonly bottomMargin = 28;
  readonly contentWidth = this.pageWidth - this.marginX * 2;
  readonly pages: string[][] = [];
  readonly extGStates = new Map<string, { name: string; fillAlpha: number; strokeAlpha: number }>();
  cursorY = this.topStart;

  constructor() {
    this.newPage();
  }

  private add(command: string) {
    this.pages[this.pages.length - 1]?.push(command);
  }

  newPage() {
    this.pages.push([]);
    this.cursorY = this.topStart;
    this.add("q");
    this.add(`${formatColor(COLORS.page)} rg`);
    this.add(`0 0 ${this.pageWidth} ${this.pageHeight} re f`);
    this.add("Q");
  }

  ensureSpace(height: number) {
    if (this.cursorY - height < this.bottomMargin) {
      this.newPage();
      return true;
    }

    return false;
  }

  gap(size: number) {
    this.cursorY -= size;
  }

  drawRect(x: number, yTop: number, width: number, height: number, options?: {
    fill?: RgbColor;
    stroke?: RgbColor;
    lineWidth?: number;
    fillAlpha?: number;
    strokeAlpha?: number;
  }) {
    const bottom = yTop - height;
    this.add("q");
    const stateName = this.getExtGStateName(options?.fillAlpha, options?.strokeAlpha);
    if (stateName) {
      this.add(`/${stateName} gs`);
    }
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
    const stateName = this.getExtGStateName(undefined, 1);
    if (stateName) {
      this.add(`/${stateName} gs`);
    }
    this.add(`${formatColor(color)} RG`);
    this.add(`${lineWidth} w`);
    this.add(`${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S`);
    this.add("Q");
  }

  drawPolygon(points: Array<{ x: number; y: number }>, options?: {
    fill?: RgbColor;
    stroke?: RgbColor;
    lineWidth?: number;
    fillAlpha?: number;
    strokeAlpha?: number;
  }) {
    if (points.length < 2) {
      return;
    }

    this.add("q");
    const stateName = this.getExtGStateName(options?.fillAlpha, options?.strokeAlpha);
    if (stateName) {
      this.add(`/${stateName} gs`);
    }
    if (options?.lineWidth) {
      this.add(`${options.lineWidth} w`);
    }
    if (options?.fill) {
      this.add(`${formatColor(options.fill)} rg`);
    }
    if (options?.stroke) {
      this.add(`${formatColor(options.stroke)} RG`);
    }
    this.add(`${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)} m`);
    points.slice(1).forEach((point) => {
      this.add(`${point.x.toFixed(2)} ${point.y.toFixed(2)} l`);
    });
    this.add("h");
    if (options?.fill && options?.stroke) {
      this.add("B");
    } else if (options?.fill) {
      this.add("f");
    } else if (options?.stroke) {
      this.add("S");
    }
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

  private getExtGStateName(fillAlpha?: number, strokeAlpha?: number) {
    const normalizedFill = fillAlpha ?? 1;
    const normalizedStroke = strokeAlpha ?? 1;

    if (
      Math.abs(normalizedFill - 1) < Number.EPSILON &&
      Math.abs(normalizedStroke - 1) < Number.EPSILON
    ) {
      return null;
    }

    const key = `${normalizedFill.toFixed(3)}:${normalizedStroke.toFixed(3)}`;
    const existing = this.extGStates.get(key);

    if (existing) {
      return existing.name;
    }

    const name = `GS${this.extGStates.size + 1}`;
    this.extGStates.set(key, {
      name,
      fillAlpha: normalizedFill,
      strokeAlpha: normalizedStroke
    });

    return name;
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

  measureParagraph(text: string, width: number, size: number, lineHeight = size * 1.35) {
    return wrapText(text, width, size).length * lineHeight;
  }

  drawTonePill(text: string, x: number, yTop: number, tone: CompareReportTone, maxWidth = 130) {
    const palette = tonePalette(tone);
    const width = clamp(Math.max(52, text.length * 5.7 + 18), 52, maxWidth);
    const height = 18;

    this.drawRect(x, yTop, width, height, {
      fill: palette.fill
    });
    this.drawTextLine(text, x + 8, yTop - 12, {
      font: "F2",
      size: 8,
      color: palette.text
    });

    return {
      width,
      height
    };
  }

  serialize() {
    const objects: string[] = [];
    const pageRefs: string[] = [];
    const extGStateRefs = new Map<string, string>();

    objects.push("<< /Type /Catalog /Pages 2 0 R >>");
    objects.push("<< /Type /Pages /Kids [] /Count 0 >>");
    objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
    objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");

    Array.from(this.extGStates.values()).forEach((state) => {
      const objectRef = `${objects.length + 1} 0 R`;
      extGStateRefs.set(state.name, objectRef);
      objects.push(
        `<< /Type /ExtGState /ca ${state.fillAlpha.toFixed(3)} /CA ${state.strokeAlpha.toFixed(3)} >>`
      );
    });

    const extGStateResource = extGStateRefs.size > 0
      ? `/ExtGState << ${Array.from(extGStateRefs.entries())
          .map(([name, ref]) => `/${name} ${ref}`)
          .join(" ")} >> `
      : "";

    this.pages.forEach((commands, pageIndex) => {
      const footer = [
        "BT",
        "/F1 8 Tf",
        `${formatColor(COLORS.muted)} rg`,
        `${this.marginX.toFixed(2)} 18 Td`,
        `(BGC Alpha Simulator - Compare Export - Page ${pageIndex + 1} of ${this.pages.length}) Tj`,
        "ET"
      ];
      const content = [...commands, ...footer].join("\n");
      const pageObjectIndex = objects.length + 1;
      const contentObjectIndex = objects.length + 2;
      pageRefs.push(`${pageObjectIndex} 0 R`);

      objects.push(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${this.pageWidth} ${this.pageHeight}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> ${extGStateResource}>> /Contents ${contentObjectIndex} 0 R >>`
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

function drawSectionTitle(layout: PdfLayout, title: string, subtitle?: string) {
  const titleSize = 13;
  const subtitleSize = 8.4;
  const subtitleLineHeight = 10.2;
  const subtitleHeight = subtitle
    ? layout.measureParagraph(subtitle, layout.contentWidth - 24, subtitleSize, subtitleLineHeight)
    : 0;
  const required = subtitle ? 18 + subtitleHeight + 12 : 24;
  layout.ensureSpace(required);
  const yTop = layout.cursorY;
  layout.drawLine(layout.marginX, yTop - 6, layout.marginX + 18, yTop - 6, COLORS.accent, 2.5);
  layout.drawTextLine(title, layout.marginX + 24, yTop, {
    font: "F2",
    size: titleSize,
    color: COLORS.heading
  });

  if (subtitle) {
    layout.drawParagraph(subtitle, layout.marginX + 24, yTop - 15, layout.contentWidth - 24, {
      size: subtitleSize,
      color: COLORS.muted,
      lineHeight: subtitleLineHeight
    });
    layout.cursorY -= 18 + subtitleHeight + 12;
    return;
  }

  layout.cursorY -= 24;
}

function drawHeader(layout: PdfLayout, report: CompareReportExport) {
  const yTop = layout.cursorY;
  const heroHeight = 92;

  layout.drawRect(layout.marginX, yTop, layout.contentWidth, heroHeight, {
    fill: COLORS.heading
  });
  layout.drawRect(layout.marginX, yTop, 10, heroHeight, {
    fill: COLORS.accent
  });
  layout.drawTextLine("Compare Report Export", layout.marginX + 24, yTop - 24, {
    font: "F1",
    size: 10,
    color: [0.79, 0.86, 0.94]
  });
  layout.drawTextLine(report.generatedAt, layout.marginX + layout.contentWidth - 150, yTop - 24, {
    font: "F1",
    size: 9,
    color: [0.79, 0.86, 0.94]
  });
  layout.drawParagraph(report.title, layout.marginX + 24, yTop - 44, layout.contentWidth - 160, {
    font: "F2",
    size: 21,
    color: [1, 1, 1],
    lineHeight: 24
  });
  layout.drawParagraph(report.subtitle, layout.marginX + 24, yTop - 74, layout.contentWidth - 160, {
    size: 9.5,
    color: [0.82, 0.88, 0.94]
  });
  layout.drawTonePill(`${report.runs.length} scenario${report.runs.length === 1 ? "" : "s"}`, layout.marginX + layout.contentWidth - 116, yTop - 52, "accent", 90);
  layout.cursorY = yTop - heroHeight - 16;
}

function drawSelectionSummary(layout: PdfLayout, runs: CompareReportExportRun[]) {
  drawSectionTitle(
    layout,
    "Selected Scenarios",
    "This export mirrors the active selection in the Compare tab."
  );

  const cardHeight = 22;
  const rowGap = 10;
  const columnGap = 8;
  const yTop = layout.cursorY;
  let x = layout.marginX;
  let currentTop = yTop;

  for (const run of runs) {
    const width = clamp(Math.max(128, run.label.length * 6.2 + 42), 128, 230);

    if (x + width > layout.marginX + layout.contentWidth) {
      x = layout.marginX;
      currentTop -= cardHeight + rowGap;
    }

    layout.ensureSpace(yTop - currentTop + cardHeight + 20);
    layout.drawRect(x, currentTop, width, cardHeight, {
      fill: COLORS.panel,
      stroke: COLORS.border
    });
    layout.drawRect(x + 8, currentTop - 6, 6, 6, {
      fill: hexToRgb(run.color)
    });
    layout.drawTextLine(run.label, x + 20, currentTop - 14, {
      font: "F2",
      size: 8.2,
      color: COLORS.text
    });
    x += width + columnGap;
  }

  const totalHeight = yTop - currentTop + cardHeight;
  layout.cursorY = yTop - totalHeight - 20;

  if (totalHeight < 20) {
    layout.gap(12);
  }
}

function drawRadarCard(layout: PdfLayout, report: CompareReportExport) {
  drawSectionTitle(
    layout,
    "Scenario Comparison",
    "Visual overlay of the selected scenarios. Use the cashflow tables as the financial decision source of truth."
  );

  const legendColumns = report.runs.length > 4 ? 2 : 1;
  const legendRows = Math.ceil(report.runs.length / legendColumns);
  const legendHeight = legendRows * 52 + 24;
  const chartHeight = 250;
  const cardHeight = Math.max(chartHeight, legendHeight) + 24;

  layout.ensureSpace(cardHeight);
  const x = layout.marginX;
  const yTop = layout.cursorY;
  const cardWidth = layout.contentWidth;
  const chartWidth = 446;
  const legendX = x + chartWidth + 18;
  const legendWidth = cardWidth - chartWidth - 32;

  layout.drawRect(x, yTop, cardWidth, cardHeight, {
    fill: COLORS.panel,
    stroke: COLORS.border
  });

  const centerX = x + 188;
  const centerY = yTop - cardHeight / 2 + 8;
  const radius = 104;
  const levels = 5;
  const dimensionCount = report.radar.dimensions.length;
  const angleStep = (Math.PI * 2) / Math.max(1, dimensionCount);
  const startAngle = -Math.PI / 2;

  for (let level = 1; level <= levels; level += 1) {
    const ratio = level / levels;
    const points = report.radar.dimensions.map((_, index) => {
      const angle = startAngle + angleStep * index;
      return {
        x: centerX + Math.cos(angle) * radius * ratio,
        y: centerY + Math.sin(angle) * radius * ratio
      };
    });

    layout.drawPolygon(points, {
      stroke: level === levels ? COLORS.borderStrong : COLORS.border,
      lineWidth: level === levels ? 1.1 : 0.6
    });
  }

  report.radar.dimensions.forEach((dimension, index) => {
    const angle = startAngle + angleStep * index;
    const axisX = centerX + Math.cos(angle) * radius;
    const axisY = centerY + Math.sin(angle) * radius;
    layout.drawLine(centerX, centerY, axisX, axisY, COLORS.borderStrong, 0.9);

    const labelWidth = 84;
    const labelX = Math.cos(angle) >= 0 ? axisX + 8 : axisX - labelWidth - 8;
    const labelY = Math.sin(angle) >= 0.4 ? axisY - 6 : axisY + 14;
    layout.drawParagraph(dimension.name, labelX, labelY, labelWidth, {
      font: "F2",
      size: 8,
      color: COLORS.muted,
      lineHeight: 9.2
    });
  });

  report.radar.series.forEach((series, index) => {
    const stroke = hexToRgb(series.color);
    const points = series.values.map((value, pointIndex) => {
      const max = report.radar.dimensions[pointIndex]?.max ?? 1;
      const ratio = clamp(max === 0 ? 0 : value / max, 0, 1);
      const angle = startAngle + angleStep * pointIndex;
      return {
        x: centerX + Math.cos(angle) * radius * ratio,
        y: centerY + Math.sin(angle) * radius * ratio
      };
    });

    layout.drawPolygon(points, {
      fill: stroke,
      stroke,
      lineWidth: index === 0 ? 2 : 1.4,
      fillAlpha: report.radar.series.length <= 3 ? 0.125 : 0.08,
      strokeAlpha: 1
    });

    points.forEach((point) => {
      layout.drawRect(point.x - 2.5, point.y + 2.5, 5, 5, {
        fill: stroke
      });
    });
  });

  layout.drawTextLine("Composite radar uses the same normalization as the Compare tab.", legendX, yTop - 22, {
    size: 8.5,
    color: COLORS.muted
  });

  const legendGap = 10;
  const legendCardWidth = legendColumns === 2
    ? (legendWidth - legendGap) / 2
    : legendWidth;

  report.runs.forEach((run, index) => {
    const column = legendColumns === 2 ? index % legendColumns : 0;
    const row = legendColumns === 2 ? Math.floor(index / legendColumns) : index;
    const cardX = legendX + column * (legendCardWidth + legendGap);
    const cardTop = yTop - 42 - row * 52;
    const color = hexToRgb(run.color);

    layout.drawRect(cardX, cardTop, legendCardWidth, 42, {
      fill: [1, 1, 1],
      stroke: COLORS.border
    });
    layout.drawRect(cardX, cardTop, 4, 42, {
      fill: color
    });
    layout.drawTextLine(run.label, cardX + 12, cardTop - 14, {
      font: "F2",
      size: 8.5,
      color: COLORS.text
    });
    layout.drawTextLine(run.ref, cardX + 12, cardTop - 26, {
      size: 8,
      color: COLORS.muted
    });
    layout.drawTonePill(run.verdict, cardX + 12, cardTop - 30, run.verdictTone, Math.max(66, legendCardWidth - 24));
  });

  layout.cursorY -= cardHeight + 18;
}

function measureTableCell(layout: PdfLayout, cell: CompareReportExportCell, width: number) {
  const padding = 8;
  const contentWidth = width - padding * 2;
  let height = padding * 2;

  if (cell.tone && !cell.muted) {
    height += 18;
  } else {
    height += layout.measureParagraph(cell.primary, contentWidth, 8.8, 10.8);
  }

  if (cell.secondary) {
    height += 12;
  }

  return Math.max(28, height);
}

function drawTableHeader(
  layout: PdfLayout,
  runs: CompareReportExportRun[],
  rowLabel: string,
  x: number,
  yTop: number,
  labelWidth: number,
  cellWidth: number
) {
  const padding = 8;
  const cellHeights = runs.map((run) =>
    Math.max(26, layout.measureParagraph(run.label, cellWidth - padding * 2 - 12, 8.2, 10) + 14)
  );
  const headerHeight = Math.max(28, ...cellHeights);

  layout.drawRect(x, yTop, labelWidth, headerHeight, {
    fill: COLORS.heading
  });
  layout.drawTextLine(rowLabel, x + padding, yTop - 18, {
    font: "F2",
    size: 8.5,
    color: [1, 1, 1]
  });

  runs.forEach((run, index) => {
    const cellX = x + labelWidth + index * cellWidth;
    layout.drawRect(cellX, yTop, cellWidth, headerHeight, {
      fill: COLORS.heading
    });
    layout.drawRect(cellX + 8, yTop - 7, 6, 6, {
      fill: hexToRgb(run.color)
    });
    layout.drawParagraph(run.label, cellX + 18, yTop - 15, cellWidth - 26, {
      font: "F2",
      size: 8.2,
      color: [1, 1, 1],
      lineHeight: 10
    });
  });

  layout.cursorY -= headerHeight;
  return headerHeight;
}

function drawComparisonTable(layout: PdfLayout, runs: CompareReportExportRun[], table: CompareReportExportTable) {
  drawSectionTitle(layout, table.title, table.subtitle);

  const labelWidth = table.rowLabel === "Milestone" ? 180 : 164;
  const minCellWidth = table.rowLabel === "Milestone" ? 112 : 104;
  const maxColumns = Math.max(1, Math.floor((layout.contentWidth - labelWidth) / minCellWidth));
  const groups: Array<{ start: number; end: number; runs: CompareReportExportRun[] }> = [];

  for (let start = 0; start < runs.length; start += maxColumns) {
    groups.push({
      start,
      end: Math.min(runs.length, start + maxColumns),
      runs: runs.slice(start, start + maxColumns)
    });
  }

  groups.forEach((group, groupIndex) => {
    if (groups.length > 1) {
      layout.ensureSpace(18);
      layout.drawTextLine(
        `Scenarios ${group.start + 1}-${group.end} of ${runs.length}`,
        layout.marginX,
        layout.cursorY - 2,
        {
          size: 8.5,
          color: COLORS.muted
        }
      );
      layout.cursorY -= 16;
    }

    const x = layout.marginX;
    const cellWidth = (layout.contentWidth - labelWidth) / group.runs.length;
    let needsHeader = true;

    table.rows.forEach((row, rowIndex) => {
      const groupCells = row.cells.slice(group.start, group.end);
      const labelHeight = layout.measureParagraph(row.label, labelWidth - 16, 9, 11);
      const cellHeight = Math.max(...groupCells.map((cell) => measureTableCell(layout, cell, cellWidth)));
      const rowHeight = Math.max(labelHeight + 16, cellHeight);

      const startedNewPage = layout.ensureSpace(rowHeight + (needsHeader ? 38 : 0));
      if (startedNewPage) {
        needsHeader = true;
      }

      if (needsHeader) {
        drawTableHeader(layout, group.runs, table.rowLabel, x, layout.cursorY, labelWidth, cellWidth);
        needsHeader = false;
      }

      const yTop = layout.cursorY;
      const background = rowIndex % 2 === 0 ? [1, 1, 1] as RgbColor : COLORS.panel;
      layout.drawRect(x, yTop, labelWidth, rowHeight, {
        fill: background,
        stroke: COLORS.border
      });
      layout.drawParagraph(row.label, x + 8, yTop - 14, labelWidth - 16, {
        font: "F2",
        size: 9,
        color: COLORS.text,
        lineHeight: 11
      });

      groupCells.forEach((cell, cellIndex) => {
        const cellX = x + labelWidth + cellIndex * cellWidth;
        const textColor = cell.muted
          ? COLORS.muted
          : cell.tone
            ? tonePalette(cell.tone).text
            : emphasisColor(cell.emphasis);

        layout.drawRect(cellX, yTop, cellWidth, rowHeight, {
          fill: background,
          stroke: COLORS.border
        });

        if (cell.tone && !cell.muted) {
          layout.drawTonePill(cell.primary, cellX + 8, yTop - 8, cell.tone, cellWidth - 16);
          if (cell.secondary) {
            layout.drawTextLine(cell.secondary, cellX + 8, yTop - 31, {
              font: "F2",
              size: 8,
              color: COLORS.text
            });
          }
        } else {
          const primaryBlock = layout.drawParagraph(cell.primary, cellX + 8, yTop - 14, cellWidth - 16, {
            font: cell.emphasis === "default" || cell.muted ? "F1" : "F2",
            size: 8.8,
            color: textColor,
            lineHeight: 10.8
          });

          if (cell.secondary) {
            layout.drawTextLine(cell.secondary, cellX + 8, yTop - 18 - primaryBlock.height, {
              font: "F1",
              size: 8,
              color: COLORS.muted
            });
          }
        }
      });

      layout.cursorY -= rowHeight;
    });

    layout.cursorY -= 14;
  });
}

function drawRunContextTable(layout: PdfLayout, runs: CompareReportExportRun[]) {
  drawSectionTitle(
    layout,
    "Run Context",
    "Reference, source scenario, source snapshot, and completion status for each selected run."
  );

  const widths = [90, 180, 170, 110, layout.contentWidth - 550];
  const headers = ["Reference", "Scenario", "Data", "Status", "Finished"];
  const x = layout.marginX;
  const padding = 8;
  let needsHeader = true;

  const drawHeader = () => {
    const yTop = layout.cursorY;
    let cellX = x;
    headers.forEach((header, index) => {
      layout.drawRect(cellX, yTop, widths[index], 24, {
        fill: COLORS.heading
      });
      layout.drawTextLine(header, cellX + padding, yTop - 16, {
        font: "F2",
        size: 8.5,
        color: [1, 1, 1]
      });
      cellX += widths[index];
    });
    layout.cursorY -= 24;
  };

  runs.forEach((run, rowIndex) => {
    const cells = [
      run.ref,
      run.scenarioName,
      run.snapshotName,
      run.status,
      run.completedAt
    ];
    const rowHeights = cells.map((cell, index) =>
      index === 3
        ? 20
        : layout.measureParagraph(cell, widths[index] - padding * 2, 8.7, 10.5)
    );
    const rowHeight = Math.max(32, ...rowHeights.map((height) => height + 12));
    const startedNewPage = layout.ensureSpace(rowHeight + (needsHeader ? 24 : 0));

    if (startedNewPage) {
      needsHeader = true;
    }

    if (needsHeader) {
      drawHeader();
      needsHeader = false;
    }

    const yTop = layout.cursorY;
    let cellX = x;
    const background = rowIndex % 2 === 0 ? [1, 1, 1] as RgbColor : COLORS.panel;

    cells.forEach((cell, index) => {
      layout.drawRect(cellX, yTop, widths[index], rowHeight, {
        fill: background,
        stroke: COLORS.border
      });

      if (index === 3) {
        layout.drawTonePill(cell, cellX + 8, yTop - 7, run.statusTone, widths[index] - 16);
      } else {
        layout.drawParagraph(cell, cellX + 8, yTop - 14, widths[index] - 16, {
          font: index === 0 ? "F2" : "F1",
          size: 8.7,
          color: index === 0 ? COLORS.heading : COLORS.text,
          lineHeight: 10.5
        });
      }

      cellX += widths[index];
    });

    layout.cursorY -= rowHeight;
  });

  layout.cursorY -= 12;
}

export function renderCompareReportStyledPdf(report: CompareReportExport) {
  const layout = new PdfLayout();

  drawHeader(layout, report);
  drawSelectionSummary(layout, report.runs);
  drawRadarCard(layout, report);
  report.comparisonTables.forEach((table) => {
    drawComparisonTable(layout, report.runs, table);
  });
  drawRunContextTable(layout, report.runs);

  return layout.serialize();
}
