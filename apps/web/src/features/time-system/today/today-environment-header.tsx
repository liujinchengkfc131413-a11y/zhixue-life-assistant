import { TodayWeather, type TodayWeatherSnapshot } from './today-weather.js';

/** 今日沉浸式顶部环境信息：日期、状态语句、天气状态与重排入口。 */

const compactTodayLabel = (label: string): string =>
  label.replace(/^\d{4}年/, '').replace('日星期', '日 星期');

const lunarDayNames = [
  '',
  '初一',
  '初二',
  '初三',
  '初四',
  '初五',
  '初六',
  '初七',
  '初八',
  '初九',
  '初十',
  '十一',
  '十二',
  '十三',
  '十四',
  '十五',
  '十六',
  '十七',
  '十八',
  '十九',
  '二十',
  '廿一',
  '廿二',
  '廿三',
  '廿四',
  '廿五',
  '廿六',
  '廿七',
  '廿八',
  '廿九',
  '三十',
] as const;

const lunarMonthDayLabel = (label: string): string => {
  const match = /^(\d{4})年(\d{1,2})月(\d{1,2})日/.exec(label);
  if (match === null) return '';
  const [, year, month, day] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  return new Intl.DateTimeFormat('zh-CN-u-ca-chinese', {
    month: 'long',
    day: 'numeric',
  })
    .format(date)
    .replace(/(\d+)(?:日)?$/, (_, value: string) => lunarDayNames[Number(value)] ?? value);
};

export const TodayEnvironmentHeader = ({
  todayLabel,
  statusSentence,
  weather,
}: {
  todayLabel: string;
  statusSentence: string;
  weather?: TodayWeatherSnapshot | undefined;
}) => (
  <header className="today-env">
    <div className="today-env__title">
      <h1 className="today-env__heading">今日</h1>
      <p className="today-env__date">
        {compactTodayLabel(todayLabel)} · 农历{lunarMonthDayLabel(todayLabel)}
      </p>
    </div>
    <p className="today-env__sentence">{statusSentence}</p>
    <div className="today-env__right">
      <TodayWeather weather={weather} />
    </div>
  </header>
);
