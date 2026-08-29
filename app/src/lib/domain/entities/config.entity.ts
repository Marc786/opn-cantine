export type WeatherTheme = 'default' | 'sunny' | 'rainy' | 'snow' | 'storm' | 'sunset';

export interface AppConfig {
  theme: WeatherTheme;
}

export const DEFAULT_CONFIG: AppConfig = {
  theme: 'default',
};
