import axios from 'axios';
import { logger } from '../../utils/logger';

export class OddsApiService {
  private apiKey: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = process.env.ODDS_API_KEY || '';
    this.baseUrl = process.env.ODDS_API_BASE_URL || 'https://api.the-odds-api.com/v4';
    
    if (!this.apiKey) {
      logger.warn('ODDS_API_KEY not configured');
    }
  }

  /**
   * Fetch odds for a specific sport
   */
  async getOdds(params: {
    sport: string;
    regions?: string[];
    markets?: string[];
    oddsFormat?: 'american' | 'decimal' | 'hongkong';
  }) {
    try {
      const { sport, regions = ['us'], markets = ['h2h', 'spreads', 'totals'], oddsFormat = 'american' } = params;
      
      const response = await axios.get(`${this.baseUrl}/sports/${sport}/odds`, {
        params: {
          apiKey: this.apiKey,
          regions: regions.join(','),
          markets: markets.join(','),
          oddsFormat,
        },
      });

      return {
        data: response.data,
        remaining: parseInt(response.headers['x-requests-remaining'] || '0'),
      };
    } catch (error) {
      logger.error('Error fetching odds:', error);
      throw error;
    }
  }

  /**
   * Get available sports
   */
  async getSports() {
    try {
      const response = await axios.get(`${this.baseUrl}/sports`, {
        params: {
          apiKey: this.apiKey,
        },
      });

      return {
        data: response.data,
        remaining: parseInt(response.headers['x-requests-remaining'] || '0'),
      };
    } catch (error) {
      logger.error('Error fetching sports:', error);
      throw error;
    }
  }

  /**
   * Get sport by key (for getting group information)
   */
  async getSportByKey(sportKey: string) {
    try {
      const { data: sports } = await this.getSports();
      const sport = (sports as any[]).find((s) => s.key === sportKey);
      return sport || null;
    } catch (error) {
      logger.error('Error getting sport by key:', error);
      return null;
    }
  }
}

export const oddsApiService = new OddsApiService();

