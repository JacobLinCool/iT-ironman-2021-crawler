const process = require("process");
const fs = require("fs");
const path = require("path");
const fetch = require("node-fetch");
const { JSDOM } = require("jsdom");

process.env.TZ = "Asia/Taipei";

main();

async function main() {
    const START_TIME = new Date();
    const baseURL = "https://ithelp.ithome.com.tw/2021ironman/";
    const types = ["contest", "self"];

    const results = await Promise.all(types.map((type) => crawler(baseURL + type)));
    const data = results.reduce((a, b) => a.concat(b), []);
    data.sort((a, b) => b.view - a.view || b.date[1] - a.date[1] || b.date[2] - a.date[2]);

    saveData(data);

    const END_TIME = new Date();
    console.log(`Crawled ${data.length} Articles in ${((END_TIME - START_TIME) / 1000).toFixed(2)}s`);
}

async function crawler(startURL) {
    const result = [];

    let nextURL = startURL;
    while (nextURL) {
        const html = await fetch(nextURL).then((res) => res.text());
        const dom = new JSDOM(html);
        const document = dom.window.document;

        const articles = document.querySelectorAll("li.ir-list");
        for (const article of articles) result.push(parseArticle(article));

        nextURL = document.querySelector(".pagination > .active")?.nextElementSibling?.querySelector("a")?.href;
    }

    return result;
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
