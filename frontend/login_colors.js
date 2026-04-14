async page => {
  const results = {};

  const h1 = await page.$('h1');
  if (h1) results.h1_color = await page.evaluate(el => getComputedStyle(el).color, h1);

  const paragraphs = await page.$$('p');
  const paraColors = [];
  for (const p of paragraphs.slice(0, 5)) {
    const text = await page.evaluate(el => el.textContent?.trim().substring(0, 50), p);
    const color = await page.evaluate(el => getComputedStyle(el).color, p);
    paraColors.push({ text, color });
  }
  results.paragraphs = paraColors;

  const inputs = await page.$$('input');
  if (inputs[0]) {
    results.input0_bg = await page.evaluate(el => getComputedStyle(el).backgroundColor, inputs[0]);
    results.input0_color = await page.evaluate(el => getComputedStyle(el).color, inputs[0]);
    results.input0_border = await page.evaluate(el => getComputedStyle(el).borderTopColor, inputs[0]);
  }
  if (inputs[1]) {
    results.input1_bg = await page.evaluate(el => getComputedStyle(el).backgroundColor, inputs[1]);
    results.input1_color = await page.evaluate(el => getComputedStyle(el).color, inputs[1]);
    results.input1_border = await page.evaluate(el => getComputedStyle(el).borderTopColor, inputs[1]);
  }

  const allButtons = await page.$$('button');
  for (const btn of allButtons) {
    const text = await page.evaluate(el => el.textContent?.trim(), btn);
    if (text && text.includes('Secure Sign In')) {
      results.submit_text = text;
      results.submit_bg = await page.evaluate(el => getComputedStyle(el).backgroundColor, btn);
      results.submit_color = await page.evaluate(el => getComputedStyle(el).color, btn);
    }
  }

  results.body_bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  results.html_bg = await page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor);
  results.dark_class = await page.evaluate(() => document.documentElement.className);

  // Check all elements with non-transparent backgrounds for cards
  const cardBgs = await page.evaluate(() => {
    const results = [];
    const allEls = document.querySelectorAll('div, section, main');
    for (const el of allEls) {
      const bg = getComputedStyle(el).backgroundColor;
      const cls = el.className || '';
      if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent' && cls.includes('rounded')) {
        results.push({ cls: cls.substring(0, 80), bg });
        if (results.length >= 5) break;
      }
    }
    return results;
  });
  results.card_bgs = cardBgs;

  // Check footer text color
  const footerEl = await page.evaluate(() => {
    const els = document.querySelectorAll('*');
    for (const el of els) {
      if (el.textContent?.includes('Restricted government')) {
        return { text: el.textContent.trim().substring(0, 60), color: getComputedStyle(el).color };
      }
    }
    return null;
  });
  results.footer = footerEl;

  // Check checkbox label
  const checkboxLabel = await page.evaluate(() => {
    const labels = document.querySelectorAll('label, [class*="checkbox"]');
    for (const el of labels) {
      if (el.textContent?.includes('Keep me signed')) {
        return { color: getComputedStyle(el).color, bg: getComputedStyle(el).backgroundColor };
      }
    }
    return null;
  });
  results.checkbox_label = checkboxLabel;

  // Forgot password link
  const forgotLink = await page.evaluate(() => {
    const links = document.querySelectorAll('a');
    for (const el of links) {
      if (el.textContent?.includes('Forgot password')) {
        return { color: getComputedStyle(el).color };
      }
    }
    return null;
  });
  results.forgot_password = forgotLink;

  return JSON.stringify(results, null, 2);
}
