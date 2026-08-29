// 截图脚本 v2：视口截图 + 导航日志 + 更宽松的商品链接选择器
const puppeteer = require("puppeteer-core");
const path = require("path");

const BASE = "https://zhixuan-ai-shopping-guide.vercel.app";
const OUT = path.join(__dirname, "screenshots");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: "new",
    args: ["--proxy-server=http://127.0.0.1:7897", "--window-size=1440,900"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });

  // 1. 首页
  await page.goto(BASE + "/", { waitUntil: "networkidle2", timeout: 60000 });
  await sleep(1500);
  await page.screenshot({ path: path.join(OUT, "01-home.png") });
  console.log("01-home done");

  // 2. 对话页空态
  await page.goto(BASE + "/chat", { waitUntil: "networkidle2", timeout: 60000 });
  await sleep(2000);
  await page.screenshot({ path: path.join(OUT, "02-chat-empty.png") });
  console.log("02-chat-empty done");

  // 3. 对话页：发一轮真实推荐（最长等 150s）
  await page.type("input", "预算500以内的便携小风扇，要静音的");
  await page.click('button[type="submit"]');
  await page.waitForFunction(
    () => document.body.innerText.includes("查看全部推荐与价格拆解"),
    { timeout: 150000, polling: 1000 },
  );
  await sleep(2000);
  // 滚动消息容器到底部，视口截图（fullPage 对内层滚动容器渲染不良）
  await page.evaluate(() => {
    document.querySelectorAll("div").forEach((d) => {
      if (d.className.includes("overflow-y-auto")) d.scrollTop = d.scrollHeight;
    });
  });
  await sleep(500);
  await page.screenshot({ path: path.join(OUT, "03-chat-result.png") });
  console.log("03-chat-result done, url =", page.url());
  console.log(
    "03 degraded banner present:",
    await page.evaluate(() => document.body.innerText.includes("AI 暂时不可用")),
  );

  // 4. 推荐结果页
  const convId = new URL(page.url()).searchParams.get("conversation");
  console.log("convId =", convId);
  const resultsUrl = convId ? `${BASE}/results?conversation=${convId}` : `${BASE}/results`;
  await page.goto(resultsUrl, { waitUntil: "networkidle2", timeout: 60000 });
  await sleep(2500);
  console.log("results page url =", page.url());
  await page.screenshot({ path: path.join(OUT, "04-results.png"), fullPage: true });
  console.log("04-results done");

  // 5. 商品详情页：任意指向 /product/ 的链接
  const href = await page.evaluate(() => {
    const a = document.querySelector('a[href*="/product/"]');
    return a ? a.getAttribute("href") : null;
  });
  console.log("product href =", href);
  if (href) {
    await page.goto(BASE + href, { waitUntil: "networkidle2", timeout: 60000 });
    await sleep(2000);
    await page.screenshot({ path: path.join(OUT, "05-product.png"), fullPage: true });
    console.log("05-product done");
  }

  // 6. 移动端对话结果
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
  await page.goto(convId ? `${BASE}/chat?conversation=${convId}` : `${BASE}/chat`, {
    waitUntil: "networkidle2",
    timeout: 60000,
  });
  await sleep(3000);
  await page.evaluate(() => {
    document.querySelectorAll("div").forEach((d) => {
      if (d.className.includes("overflow-y-auto")) d.scrollTop = d.scrollHeight;
    });
  });
  await sleep(500);
  await page.screenshot({ path: path.join(OUT, "06-mobile-chat.png") });
  console.log("06-mobile-chat done");

  await browser.close();
})().catch((e) => {
  console.error("FAILED:", e.message);
  process.exit(1);
});
