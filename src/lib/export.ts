import { FONT_SIZE } from "../types";
import type { ProjectState } from "../types";

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function getSvgElement(): SVGSVGElement | null {
  return document.getElementById("tree-svg") as SVGSVGElement | null;
}

function cloneSvgWithStyles(svg: SVGSVGElement): SVGSVGElement {
  const clone = svg.cloneNode(true) as SVGSVGElement;

  const bbox = svg.getBBox();
  const margin = FONT_SIZE * 0.75;
  const w = bbox.width + margin * 2;
  const h = bbox.height + margin * 2;
  clone.setAttribute("width", String(w));
  clone.setAttribute("height", String(h));
  clone.setAttribute(
    "viewBox",
    `${bbox.x - margin} ${bbox.y - margin} ${w} ${h}`,
  );

  clone.setAttribute(
    "style",
    "background-color: white; " + (clone.getAttribute("style") || ""),
  );

  const styleEl = document.createElementNS("http://www.w3.org/2000/svg", "style");
  styleEl.textContent = `
    text {
      font-family: 'Geist', 'Geist Mono', system-ui, -apple-system, sans-serif;
    }
  `;
  clone.insertBefore(styleEl, clone.firstChild);

  return clone;
}

export function exportSvg(name = "tree-stump") {
  const svg = getSvgElement();
  if (!svg) return;

  const clone = cloneSvgWithStyles(svg);
  const serializer = new XMLSerializer();
  const svgString = serializer.serializeToString(clone);
  const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
  download(blob, `${name}.svg`);
}

export function exportPng(name = "tree-stump", scale = 2) {
  const svg = getSvgElement();
  if (!svg) return;

  const clone = cloneSvgWithStyles(svg);
  const serializer = new XMLSerializer();
  const svgString = serializer.serializeToString(clone);

  const width = parseFloat(clone.getAttribute("width") || "0");
  const height = parseFloat(clone.getAttribute("height") || "0");

  const canvas = document.createElement("canvas");
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const img = new Image();
  const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  img.onload = () => {
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(url);

    canvas.toBlob((pngBlob) => {
      if (pngBlob) download(pngBlob, `${name}.png`);
    }, "image/png");
  };

  img.src = url;
}

export function exportProject(state: ProjectState) {
  const data = JSON.stringify(state, null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const name = state.projectName?.trim() || "tree-stump";
  download(blob, `${name}.treestump`);
}

export function importProject(file: File): Promise<ProjectState> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string) as ProjectState;
        if (!data.bracketText || !data.settings) {
          reject(new Error("Invalid project file"));
          return;
        }
        resolve(data);
      } catch {
        reject(new Error("Failed to parse project file"));
      }
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsText(file);
  });
}
