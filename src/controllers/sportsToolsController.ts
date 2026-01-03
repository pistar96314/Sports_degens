import { Request, Response } from 'express';
import { oddsApiService } from '../services/sports-tools/OddsApiService';
import { positiveEVService } from '../services/sports-tools/PositiveEVService';
import { ApiResponse } from '../types';

/**
 * Get positive EV bets
 * Query params:
 * - sport (required): Sport key (e.g., 'americanfootball_nfl')
 * - regions (optional): Comma-separated or array (e.g., 'us,eu' or ['us','eu'])
 * - minEV (optional): Minimum expected value threshold (default: 0)
 * - bookmaker (optional): Filter by bookmaker name
 * - market (optional): Filter by market type (h2h, spreads, totals)
 * - page (optional): Page number for pagination (default: 1)
 * - limit (optional): Results per page (default: 50, max: 100)
 */
export const getPositiveEV = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      sport,
      regions,
      minEV,
      bookmaker,
      market,
      page,
      limit,
    } = req.query;

    // Validate required parameters
    if (!sport || typeof sport !== 'string') {
      res.status(400).json({
        success: false,
        error: { message: 'Sport parameter is required' },
      } as ApiResponse);
      return;
    }

    // Parse pagination
    const pageNum = Math.max(1, parseInt(String(page || '1')) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(String(limit || '50')) || 50));
    const skip = (pageNum - 1) * limitNum;

    // Parse minimum EV threshold
    const minEVThreshold = minEV ? parseFloat(String(minEV)) : 0;

    // Parse regions
    let regionsArray: string[] = ['us'];
    if (regions) {
      if (Array.isArray(regions)) {
        regionsArray = regions.map(String).filter(Boolean);
      } else {
        regionsArray = String(regions).split(',').map((r) => r.trim()).filter(Boolean);
      }
    }

    // Get sport information to get group
    const sportInfo = await oddsApiService.getSportByKey(sport);
    if (!sportInfo) {
      res.status(400).json({
        success: false,
        error: { message: `Invalid sport key: ${sport}` },
      } as ApiResponse);
      return;
    }

    const sportGroup = sportInfo.group || 'Other';
    const sportTitle = sportInfo.title || sport;

    // Fetch odds from API
    const markets = market && typeof market === 'string' ? [market] : ['h2h', 'spreads', 'totals'];
    const { data: oddsData, remaining } = await oddsApiService.getOdds({
      sport,
      regions: regionsArray,
      markets,
      oddsFormat: 'american',
    });

    // Process odds to find positive EV bets
    let positiveEVBets = positiveEVService.findPositiveEVBets(
      oddsData as any[],
      sportTitle,
      sportGroup,
      regionsArray[0]
    );

    // Apply filters
    if (minEVThreshold > 0) {
      positiveEVBets = positiveEVBets.filter((bet) => bet.expectedValue >= minEVThreshold);
    }

    if (bookmaker && typeof bookmaker === 'string') {
      const bookmakerLower = bookmaker.toLowerCase();
      positiveEVBets = positiveEVBets.filter(
        (bet) => bet.bookmaker.toLowerCase().includes(bookmakerLower)
      );
    }

    // Sort by expected value (highest first)
    positiveEVBets.sort((a, b) => b.expectedValue - a.expectedValue);

    // Apply pagination
    const total = positiveEVBets.length;
    const paginatedBets = positiveEVBets.slice(skip, skip + limitNum);

    res.json({
      success: true,
      data: {
        bets: paginatedBets,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
          hasMore: skip + limitNum < total,
        },
        apiRemaining: remaining,
      },
    } as ApiResponse);
  } catch (error: any) {
    // Handle specific API errors
    if (error.response?.status === 401) {
      res.status(401).json({
        success: false,
        error: { message: 'Invalid Odds API key' },
      } as ApiResponse);
      return;
    }

    if (error.response?.status === 429) {
      res.status(429).json({
        success: false,
        error: { message: 'Odds API rate limit exceeded. Please try again later.' },
      } as ApiResponse);
      return;
    }

    res.status(500).json({
      success: false,
      error: {
        message: error.message || 'Failed to fetch positive EV bets',
        ...(process.env.NODE_ENV === 'development' && { details: error.stack }),
      },
    } as ApiResponse);
  }
};

/**
 * Get available sports
 */
export const getSports = async (_req: Request, res: Response): Promise<void> => {
  try {
    const { data: sports } = await oddsApiService.getSports();

    res.json({
      success: true,
      data: { sports },
    } as ApiResponse);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { message: error.message || 'Failed to fetch sports' },
    } as ApiResponse);
  }
};

