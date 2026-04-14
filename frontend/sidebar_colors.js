async page => {
  const results = {};

  // Sidebar background
  const sidebar = await page.$('aside, nav, [class*="sidebar"], complementary');
  if (sidebar) {
    results.sidebar_bg = await page.evaluate(el => getComputedStyle(el).backgroundColor, sidebar);
    results.sidebar_color = await page.evaluate(el => getComputedStyle(el).color, sidebar);
  }

  // Nav links
  const navLinks = await page.$$('nav a');
  const linkData = [];
  for (const link of navLinks.slice(0, 5)) {
    const text = await page.evaluate(el => el.textContent?.trim().substring(0, 30), link);
    const color = await page.evaluate(el => getComputedStyle(el).color, link);
    const bg = await page.evaluate(el => getComputedStyle(el).backgroundColor, link);
    linkData.push({ text, color, bg });
  }
  results.nav_links = linkData;

  // Topbar/header
  const header = await page.$('header');
  if (header) {
    results.header_bg = await page.evaluate(el => getComputedStyle(el).backgroundColor, header);
    results.header_color = await page.evaluate(el => getComputedStyle(el).color, header);
  }

  // Check all CSS variables in dark mode
  const cssVars = await page.evaluate(() => {
    const style = getComputedStyle(document.documentElement);
    return {
      card: style.getPropertyValue('--card'),
      background: style.getPropertyValue('--background'),
      foreground: style.getPropertyValue('--foreground'),
      sidebarBg: style.getPropertyValue('--sidebar-bg'),
      sidebarText: style.getPropertyValue('--sidebar-text'),
      sidebarTextActive: style.getPropertyValue('--sidebar-text-active'),
      fiaWhite: style.getPropertyValue('--fia-white'),
      colorWhite: style.getPropertyValue('--color-white'),
    };
  });
  results.css_vars = cssVars;

  // Page title in header
  const pageTitle = await page.evaluate(() => {
    const headings = document.querySelectorAll('h1, h2, [class*="title"]');
    for (const el of headings) {
      const text = el.textContent?.trim();
      if (text && text.length < 40 && text.length > 2) {
        return { text, color: getComputedStyle(el).color };
      }
    }
    return null;
  });
  results.page_title = pageTitle;

  // User info at bottom of sidebar
  const userInfo = await page.evaluate(() => {
    const els = document.querySelectorAll('[class*="user"], [class*="avatar"], [class*="profile"]');
    for (const el of els) {
      if (el.textContent?.trim()) {
        return {
          text: el.textContent.trim().substring(0, 50),
          color: getComputedStyle(el).color,
          bg: getComputedStyle(el).backgroundColor
        };
      }
    }
    return null;
  });
  results.user_info = userInfo;

  // Theme toggle button
  const themeBtn = await page.evaluate(() => {
    const btns = document.querySelectorAll('button');
    for (const btn of btns) {
      const text = btn.textContent?.trim().toLowerCase();
      const ariaLabel = btn.getAttribute('aria-label')?.toLowerCase() || '';
      if (text?.includes('theme') || text?.includes('dark') || text?.includes('light') || ariaLabel.includes('theme') || ariaLabel.includes('dark') || ariaLabel.includes('light')) {
        return {
          text: btn.textContent?.trim().substring(0, 30),
          ariaLabel,
          color: getComputedStyle(btn).color,
          bg: getComputedStyle(btn).backgroundColor
        };
      }
    }
    return null;
  });
  results.theme_toggle = themeBtn;

  // Notification bell
  const notifBtn = await page.evaluate(() => {
    const btns = document.querySelectorAll('button, a');
    for (const btn of btns) {
      const ariaLabel = btn.getAttribute('aria-label')?.toLowerCase() || '';
      if (ariaLabel.includes('notif') || ariaLabel.includes('bell')) {
        return {
          ariaLabel,
          color: getComputedStyle(btn).color,
          bg: getComputedStyle(btn).backgroundColor
        };
      }
    }
    return null;
  });
  results.notif_btn = notifBtn;

  return JSON.stringify(results, null, 2);
}
