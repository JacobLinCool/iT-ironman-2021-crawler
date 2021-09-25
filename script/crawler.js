const process = require("process");
const fs = require("fs");
const path = require("path");
const fetch = require("node-fetch");
const { JSDOM } = require("jsdom");

process.env.TZ = "Asia/Taipei";

let DownloadT = 0,
    ParseT = 0,
    OrganizeT = 0,
    SaveT = 0;

let available = 12;
const finished = [];
function isAvailable() {
    return new Promise((resolve) => {
        if (available > 0) {
            available--;
            resolve();
        } else finished.push(resolve);
    });
}

main();

async function main() {
    const START_TIME = new Date();

    const baseURL = "https://ithelp.ithome.com.tw/2021ironman/";
    const types = ["contest", "self"];

    const results = await Promise.all(types.map((type) => crawler(baseURL + type)));
    const OT = Date.now();
    const data = results.reduce((a, b) => a.concat(b), []);
    data.sort((a, b) => b.view - a.view || b.date[1] - a.date[1] || b.date[2] - a.date[2]);
    OrganizeT += Date.now() - OT;

    const ST = Date.now();
    saveData(data);
    SaveT += Date.now() - ST;

    const END_TIME = new Date();
    console.log(`Crawled ${data.length} Articles in ${((END_TIME - START_TIME) / 1000).toFixed(2)}s`);
    console.log(
        `Download: ${(DownloadT / 1000).toFixed(3)}s, Parse: ${(ParseT / 1000).toFixed(3)}s, Organize: ${(OrganizeT / 1000).toFixed(3)}s, Save: ${(
            SaveT / 1000
        ).toFixed(3)}s`
    );
}

async function crawler(startURL) {
    const result = new Map();

    const firstPage = await task(startURL);
    firstPage.result.forEach((val, key) => result.set(key, val));
    let total = firstPage.pageCount;
    const tasks = [];
    for (let i = 2; i <= total; i++) {
        await isAvailable();
        tasks.push(
            task(startURL + "?page=" + i).then((page) => {
                page.result.forEach((val, key) => result.set(key, val));
                if (page.pageCount > total) total = page.pageCount;
            })
        );
        if (i === total) await Promise.all(tasks);
    }

    return [...result.values()];
}

async function task(url) {
    console.log(`Crawling Page: ${url}`);
    const result = new Map();
    const DT = Date.now();
    const html = await fetch(url).then((res) => res.text());
    DownloadT += Date.now() - DT;

    const PT = Date.now();
    const dom = new JSDOM(html);
    const document = dom.window.document;

    const pageCount = parseInt(document.querySelector(".pagination > li:nth-last-child(2)").textContent);

    const articles = document.querySelectorAll("li.ir-list");
    for (const article of articles) {
        const parsed = parseArticle(article);
        result.set(parsed.link, parsed);
    }
    ParseT += Date.now() - PT;

    if (finished.length > 0) {
        const resolve = finished.shift();
        resolve();
    }

    return { result, pageCount };
}

function parseArticle(article) {
    try {
        const type = article.querySelector(".group-badge__name").textContent.trim();
        const series = article.querySelector(".ir-list__group-topic > a").textContent.trim();
        const title = article.querySelector(".ir-list__title > a").textContent.trim();
        const link = article.querySelector(".ir-list__title > a").href;
        const info = article
            .querySelector(".ir-list__info")
            .textContent.trim()
            .split("\n")
            .map((x) => x.trim());
        let author, date, view, team;
        if (info.length === 4 || info.length === 8) {
            author = info[0];
            date = info[3]
                .match(/(\d{4})-(\d{2})-(\d{2})/)
                .slice(1, 4)
                .map(Number);
            view = +info[3].match(/(\d+?) 次瀏覽/)[1];

            if (info.length === 8) team = info[7].substr(2);
            else team = null;
        } else {
            throw new Error(`${title}: Invalid Article Info ${info.length}`);
        }

        return { type, series, title, link, author, date, view, team };
    } catch (err) {
        console.error("Article Parse Error", err.message);
    }
}

function saveData(data) {
    const d = new Date();
    const filename = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}-${d.getDate().toString().padStart(2, "0")}.json`;
    const filePath = path.join(__dirname, "../data", filename);

    let file = {};
    if (fs.existsSync(filePath)) file = JSON.parse(fs.readFileSync(filePath));

    const hour = d.getHours().toString().padStart(2, "0");
    file[hour] = data;

    if (!fs.existsSync(path.join(__dirname, "../data"))) fs.mkdirSync(path.join(__dirname, "../data"));
    fs.writeFileSync(filePath, JSON.stringify(file));
}
