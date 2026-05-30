import chalk from 'chalk';

export interface Theme {
  primary: typeof chalk;
  secondary: typeof chalk;
  accent: typeof chalk;
  success: typeof chalk;
  warning: typeof chalk;
  error: typeof chalk;
  muted: typeof chalk;
  text: typeof chalk;
  bg: {
    primary: typeof chalk;
    surface: typeof chalk;
    highlight: typeof chalk;
  };
  border: {
    color: typeof chalk;
    horizontal: string;
    vertical: string;
    topLeft: string;
    topRight: string;
    bottomLeft: string;
    bottomRight: string;
    teeLeft: string;
    teeRight: string;
  };
}

export const darkTheme: Theme = {
  primary: chalk.cyan,
  secondary: chalk.blue,
  accent: chalk.magenta,
  success: chalk.green,
  warning: chalk.yellow,
  error: chalk.red,
  muted: chalk.gray,
  text: chalk.white,
  bg: {
    primary: chalk.bgCyan,
    surface: chalk.bgGray,
    highlight: chalk.bgYellow,
  },
  border: {
    color: chalk.dim.gray,
    horizontal: '─',
    vertical: '│',
    topLeft: '╭',
    topRight: '╮',
    bottomLeft: '╰',
    bottomRight: '╯',
    teeLeft: '├',
    teeRight: '┤',
  },
};

export const lightTheme: Theme = {
  primary: chalk.blue,
  secondary: chalk.cyan,
  accent: chalk.magenta,
  success: chalk.green,
  warning: chalk.hex('#B8860B'),
  error: chalk.red,
  muted: chalk.gray,
  text: chalk.black,
  bg: {
    primary: chalk.bgBlue,
    surface: chalk.bgWhite,
    highlight: chalk.bgYellow,
  },
  border: {
    color: chalk.dim.gray,
    horizontal: '─',
    vertical: '│',
    topLeft: '╭',
    topRight: '╮',
    bottomLeft: '╰',
    bottomRight: '╯',
    teeLeft: '├',
    teeRight: '┤',
  },
};
