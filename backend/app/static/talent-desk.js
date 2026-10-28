(() => {
  const storageKey = "talent-desk-theme";
  const themes = new Set(["light", "dark"]);

  const savedTheme = () => {
    try {
      const saved = window.localStorage.getItem(storageKey);
      return themes.has(saved) ? saved : "dark";
    } catch (_) {
      return "dark";
    }
  };

  const applyTheme = (theme) => {
    const activeTheme = themes.has(theme) ? theme : "dark";
    document.documentElement.dataset.theme = activeTheme;

    document.querySelectorAll("[data-theme-toggle]").forEach((toggle) => {
      const isDark = activeTheme === "dark";
      const label = toggle.querySelector("[data-theme-label]");
      const icon = toggle.querySelector("[data-theme-icon]");
      toggle.setAttribute("aria-pressed", String(isDark));
      toggle.setAttribute("aria-label", isDark ? "Switch to light mode" : "Switch to dark mode");
      if (label) label.textContent = isDark ? "Light mode" : "Dark mode";
      if (icon) icon.textContent = isDark ? "☀" : "☾";
    });
  };

  const setTheme = (theme) => {
    applyTheme(theme);
    try {
      window.localStorage.setItem(storageKey, document.documentElement.dataset.theme);
    } catch (_) {
      // Keep the selected theme for this page even when storage is unavailable.
    }
  };

  applyTheme(savedTheme());

  document.querySelectorAll("[data-theme-toggle]").forEach((toggle) => {
    toggle.addEventListener("click", () => {
      setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
    });
  });
})();
