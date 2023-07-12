import "dotenv/config";
import { input } from "@inquirer/prompts";
import chalk from "chalk";
import got from "got";
import { createSpinner } from "nanospinner";

const gqlEndpoint = "https://api.github.com/graphql";
const daysOfWeek = ["S", "M", "T", "W", "T", "F", "S"];
const monthsOfYear = [
  "J",
  "F",
  "M",
  "A",
  "M",
  "J",
  "J",
  "A",
  "S",
  "O",
  "N",
  "D",
];

function heatMapColor(level) {
  const CL = {
    NONE: "NONE",
    FIRST_QUARTILE: "FIRST_QUARTILE",
    SECOND_QUARTILE: "SECOND_QUARTILE",
    THIRD_QUARTILE: "THIRD_QUARTILE",
    FOURTH_QUARTILE: "FOURTH_QUARTILE",
  };
  if (level === CL.NONE) return "#161b22";
  if (level === CL.FIRST_QUARTILE) return "#0e4429";
  if (level === CL.SECOND_QUARTILE) return "#006d32";
  if (level === CL.THIRD_QUARTILE) return "#26a641";
  if (level === CL.FOURTH_QUARTILE) return "#39d353";
  return "#000000";
}

function createBox(colorHex = "#000000") {
  const width = 1;
  const height = 1;

  // Generate the box contents
  const boxContents = [];
  for (let i = 0; i < height; i++) {
    const row = [];
    for (let j = 0; j < width; j++) {
      row.push("  ");
    }
    boxContents.push(row);
  }

  let boxString = "";

  boxContents.forEach((box) => {
    box.forEach((item) => {
      boxString += chalk.bgHex(colorHex)(item);
    });
  });
  return boxString;
}

function createEmptyGrid(numRows, numCols) {
  let grid = "";
  for (let i = 0; i < numRows; i++) {
    for (let j = 0; j < numCols; j++) {
      grid += createBox();
    }
  }
  return grid;
}

function createCommitHeatMap(data) {
  let res = "";

  const tempWeeks = data.weeks.map((week) => {
    return {
      contributionDays: week.contributionDays.map((day) => ({
        ...day,
        dayIndex: new Date(day.date).getDay(),
      })),
    };
  });
  const weeks = tempWeeks.map((week) => {
    const contributionDays = week.contributionDays;
    const existingDayIndexes = contributionDays.map((day) => day.dayIndex);

    for (let dayIndex = 0; dayIndex <= 6; dayIndex++) {
      if (!existingDayIndexes.includes(dayIndex)) {
        contributionDays.push({
          dayIndex: dayIndex,
        });
      }
    }
    contributionDays.sort((a, b) => {
      return a.dayIndex - b.dayIndex;
    });

    return week;
  });

  console.log(createEmptyGrid(1, data.weeks.length + 3));
  let monthLable = "    ";
  let lastMonth;
  data.weeks.forEach((data, i) => {
    const month = new Date(data.contributionDays[0]?.date).getMonth();
    if (lastMonth !== month) monthLable += monthsOfYear[month] + " ";
    else monthLable += createBox();
    lastMonth = month;
  });
  console.log(chalk.bgBlack(monthLable + "  "));

  daysOfWeek.forEach((day, i) => {
    res += createBox();
    res += chalk.bgBlack(day + " ");
    weeks.forEach((data) => {
      res += createBox(
        heatMapColor(data.contributionDays[i]?.contributionLevel)
      );
    });
    res += createBox();
    if (i < daysOfWeek.length - 1) res += "\n";
  });

  console.log(res);
  console.log(createEmptyGrid(1, data.weeks.length + 3));
}

async function init() {
  const username = await input({ message: "Enter your github username?" });
  const query = `
    query {
      user(login: "${username}") {
        contributionsCollection {
          contributionYears
          contributionCalendar{
            totalContributions
                weeks {
                    contributionDays {
                        contributionCount
                        date
                        color
                        contributionLevel
                    }
                }
            }
        }
      }
    }
  `;
  const spinner = createSpinner("Fetching your Contributions...").start();
  try {
    const response = await got.post(gqlEndpoint, {
      json: {
        query: query,
      },
      responseType: "json",
      headers: {
        Authorization: `Bearer ${process.env.GITHUB_API_TOKEN}`,
      },
    });
    if (response.body.data.user === null)
      throw new Error("404 : Username Not Found");
    const data =
      response.body.data.user.contributionsCollection.contributionCalendar;

    spinner.success();
    console.log(
      chalk.blue("Your Total Contirbution in the Last Year : ") +
        chalk.yellow(data.totalContributions)
    );
    createCommitHeatMap(data);
  } catch (error) {
    spinner.error({
      text: chalk.red(error.message),
    });
    process.exit(1);
  }
}

await init();

// query variable formate if you want to filter by year
const qv = {
  from: "2023-01-01T00:00:00.000Z",
  to: "2023-12-31T00:00:00.000Z",
};
