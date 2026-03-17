
import { HourlyData } from '../types';

export interface OmiePrice {
  date: string; // YYYY-MM-DD
  hour: number; // 1-24
  price: number; // EUR/MWh
}

/**
 * Fetches OMIE prices for a given date range.
 * Since OMIE doesn't have a simple CORS-enabled JSON API, we simulate or 
 * use a public proxy if available. For this implementation, we'll provide 
 * a robust simulation that can be replaced with a real fetch if a proxy is set up.
 */
export const fetchOmiePrices = async (startDate: Date, endDate: Date): Promise<OmiePrice[]> => {
  const prices: OmiePrice[] = [];
  const current = new Date(startDate);
  current.setHours(0, 0, 0, 0);

  while (current <= endDate) {
    const dateStr = current.toISOString().split('T')[0];
    
    // Simulate daily price variation (base price + random noise)
    // In a real app, this would be: await fetch(`https://api.omie.es/...`)
    const basePrice = 60 + Math.random() * 40; // 60-100 EUR/MWh
    
    for (let h = 1; h <= 24; h++) {
      // Hourly profile: higher during day, lower at night
      const hourFactor = h >= 8 && h <= 22 ? 1.2 : 0.8;
      prices.push({
        date: dateStr,
        hour: h,
        price: basePrice * hourFactor + (Math.random() * 5)
      });
    }
    current.setDate(current.getDate() + 1);
  }

  return prices;
};

export const applyOmiePrices = (hourlyData: HourlyData[], omiePrices: OmiePrice[], config: { margin: number, fixedCost: number, tax: number }): HourlyData[] => {
  return hourlyData.map(hour => {
    const dateStr = hour.timestamp.toISOString().split('T')[0];
    const hourNum = hour.timestamp.getHours() + 1; // 1-24

    const omie = omiePrices.find(p => p.date === dateStr && p.hour === hourNum);
    const omiePriceMWh = omie ? omie.price : 80; // Default if not found
    const omiePriceKWh = omiePriceMWh / 1000;

    // Cost = (Energy * (OMIE + Margin) + Fixed) * (1 + Tax)
    // Energy in kWh = activeAvg (kW) * 1h
    const energy = hour.activeAvg; 
    const priceWithMargin = omiePriceKWh + config.margin;
    const costBeforeTax = (energy * priceWithMargin) + (config.fixedCost / (30 * 24)); // Distribute fixed cost hourly
    const cost = costBeforeTax * (1 + config.tax);

    return {
      ...hour,
      omiePrice: omiePriceMWh,
      cost: cost
    };
  });
};
