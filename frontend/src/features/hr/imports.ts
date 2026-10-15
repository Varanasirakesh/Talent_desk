export type ParsedResume = { text: string; fingerprint: string };

export async function fingerprintBytes(bytes: Uint8Array): Promise<string> {
  if (globalThis.crypto?.subtle) {
    const digest = await crypto.subtle.digest(
      "SHA-256",
      Uint8Array.from(bytes),
    );
    return Array.from(new Uint8Array(digest), (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("");
  }
  let hash = 2166136261;
  for (const byte of bytes) hash = Math.imul(hash ^ byte, 16777619);
  return (hash >>> 0).toString(16);
}

export async function readResume(file: File): Promise<ParsedResume> {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (!extension || !["txt", "md", "pdf", "docx"].includes(extension)) {
    throw new Error("Choose a TXT, MD, PDF or DOCX resume.");
  }
  if (file.size === 0) throw new Error("This file is empty.");
  if (file.size > 10 * 1024 * 1024)
    throw new Error("Choose a file under 10 MB.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const fingerprint = await fingerprintBytes(bytes);
  let text = "";
  try {
    if (extension === "txt" || extension === "md") {
      text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } else if (extension === "docx") {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({
        arrayBuffer: bytes.buffer,
      });
      text = result.value;
    } else {
      const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
      pdfjs.GlobalWorkerOptions.workerSrc = `${process.env.NEXT_PUBLIC_HR_BASE_PATH || ""}/pdf.worker.min.mjs`;
      const loadingTask = pdfjs.getDocument({
        data: bytes.slice(),
        useSystemFonts: true,
      });
      try {
        const document = await loadingTask.promise;
        if (document.numPages > 20)
          throw new Error(
            "PDFs are limited to 20 pages. Choose a shorter resume.",
          );
        const pages: string[] = [];
        for (
          let pageNumber = 1;
          pageNumber <= document.numPages;
          pageNumber++
        ) {
          const page = await document.getPage(pageNumber);
          const content = await page.getTextContent();
          pages.push(
            content.items
              .map((item) => ("str" in item ? item.str : ""))
              .join(" "),
          );
        }
        text = pages.join("\n");
      } finally {
        await loadingTask.destroy();
      }
    }
  } catch (error) {
    if (
      error instanceof Error &&
      /Choose a|empty|under 10 MB|limited to 20 pages/.test(error.message)
    )
      throw error;
    throw new Error(
      `Could not read ${file.name}. Try an accessible text-based file.`,
    );
  }
  text = text.replace(/\u0000/g, "").trim();
  if (!text)
    throw new Error(
      "No readable text was found. Scanned or image-only resumes need OCR before upload.",
    );
  if (text.length > 100000)
    throw new Error(
      "Extracted text is too long. Choose a shorter resume (under 100,000 characters).",
    );
  return { text, fingerprint };
}
