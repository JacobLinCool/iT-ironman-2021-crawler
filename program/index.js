const fs = require("fs");

const firstFilename = process.argv[2];
const secondFilename = process.argv[3];

if (firstFilename && secondFilename) {
    const [date1, date2] = [getDate(firstFilename), getDate(secondFilename)];
    const [d1, d2] = [getLatest(firstFilename), getLatest(secondFilename)];
    const result = calcDiff(d1, d2);
    const report = genReport(result, date1, date2);
    console.log(report);
} else {
    console.log("Usage: node index.js [day1 file path] [day2 file path]");
}

////////////////////////////////////////////////////////////////////////////////
function getDate(filename) {
    const name = filename.split(/[\\/]/).pop().split(".")[0];
    const [year, month, day] = name.split("-");
    return [year, month, day];
}

function getLatest(filename) {
    const file = fs.readFileSync(filename, "utf8");
    const json = JSON.parse(file);
    const [time, data] = Object.entries(json).sort(([k1, v1], [k2, v2]) => v2.length - v1.length)[0];

    return { time, data };
}

function calcDiff(d1, d2) {
    const { data: data1, time: time1 } = d1;
    const { data: data2, time: time2 } = d2;

    const _index = data1.reduce((acc, curr, idx) => {
        acc[curr.link] = idx;
        return acc;
    }, {});

    const diff = data2.map((item) => {
        const d = _index[item.link] !== undefined ? item.view - data1[_index[item.link]].view : item.view;
        return { ...item, diff: d };
    });

    return { data: diff.sort((a, b) => b.diff - a.diff), time: [time1, time2] };
}

function genReport(result, date1, date2) {
    const { data, time } = result;
    const articles = data.splice(0, 10);

    let report = `-----\n## 每日鐵人賽熱門 Top 10 (${date1[1]}${date1[2]})\n以 ${+date1[1]}/${date1[2]} ${time[0]}:00 ~ ${+date2[1]}/${date2[2]} ${
        time[1]
    }:00 文章觀看數增加值排名\n\n`;
    articles.forEach((item, idx) => {
        report += `${idx + 1}. \`+${item.diff}\` [${item.title}](${item.link})\n    * 作者： ${item.author}\n    * 系列：${item.series}\n`;
    });

    return report;
}
