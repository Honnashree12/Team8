(function attachDysAssistReadability(global) {
  class DysAssistReadability {
    constructor(documentRef) {
      this.document = documentRef;
    }

    parse() {
      const candidates = Array.from(this.document.querySelectorAll([
        "article",
        "main",
        "[role='main']",
        ".article",
        ".content",
        ".post",
        ".entry",
        "p",
        "h1",
        "h2",
        "h3",
        "h4",
        "li",
        "blockquote"
      ].join(",")))
        .map(element => ({
          element,
          score: this.scoreElement(element)
        }))
        .filter(candidate => candidate.score > 18)
        .sort((a, b) => b.score - a.score);

      return {
        title: this.document.title || "",
        candidates,
        textContent: candidates
          .slice(0, 80)
          .map(candidate => candidate.element.innerText || candidate.element.textContent || "")
          .join("\n\n")
          .trim()
      };
    }

    scoreElement(element) {
      const text = (element.innerText || element.textContent || "").replace(/\s+/g, " ").trim();
      const words = text ? text.split(" ").length : 0;
      if (words < 8) return 0;

      const linkText = Array.from(element.querySelectorAll("a"))
        .map(link => link.innerText || link.textContent || "")
        .join(" ");
      const linkDensity = text.length ? linkText.length / text.length : 0;
      const punctuationBonus = (text.match(/[.,;:!?]/g) || []).length;
      const paragraphBonus = element.matches("p,li,blockquote") ? 20 : 0;
      const containerBonus = element.matches("article,main,[role='main']") ? 35 : 0;

      return words + punctuationBonus + paragraphBonus + containerBonus - linkDensity * 80;
    }
  }

  global.DysAssistReadability = DysAssistReadability;
})(globalThis);
