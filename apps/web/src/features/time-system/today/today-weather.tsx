import { CloudOff, CloudSun } from 'lucide-react';

export interface TodayWeatherSnapshot {
  readonly temperatureCelsius: number;
  readonly description: string;
}

/** 当前没有获授权的外部天气源时，明确显示不可用，绝不伪造实时天气。 */
export const TodayWeather = ({ weather }: { weather?: TodayWeatherSnapshot | undefined }) =>
  weather === undefined ? (
    <div className="today-weather" aria-label="天气暂不可用">
      <CloudOff aria-hidden="true" size={16} strokeWidth={1.8} />
      <span className="today-weather__state">天气 · 暂不可用</span>
    </div>
  ) : (
    <div
      className="today-weather"
      aria-label={`天气：${weather.description}，${String(weather.temperatureCelsius)} 摄氏度`}
    >
      <CloudSun aria-hidden="true" size={16} strokeWidth={1.8} />
      <span className="today-weather__temperature">{weather.temperatureCelsius}°</span>
      <span className="today-weather__state">{weather.description}</span>
    </div>
  );
